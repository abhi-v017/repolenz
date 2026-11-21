/**
 * Repository Scanner for RepoMap
 *
 * Traverses a repository directory, applies filtering rules, extracts file metadata,
 * and produces a structured manifest of indexable source files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { FileFilter } from './file-filter.js';
import { normalizePath, toRelativePath, isSafePath } from '../utils/path-utils.js';
import { computeFileHash } from '../utils/hash-utils.js';

/**
 * @typedef {Object} FileDescriptor
 * @property {string} path - Absolute path to file
 * @property {string} relativePath - Normalized relative path from repository root
 * @property {string} name - File name with extension
 * @property {string} extension - File extension with leading dot
 * @property {string} language - Canonical language name (e.g. 'javascript')
 * @property {number} sizeBytes - File size in bytes
 * @property {number} mtimeMs - Modification timestamp in milliseconds
 * @property {number} lineCount - Total lines of code in the file
 * @property {string} contentHash - SHA-256 hash of file content
 */

/**
 * @typedef {Object} ScanResult
 * @property {string} rootPath - Absolute path scanned
 * @property {FileDescriptor[]} files - Valid, indexable source files
 * @property {Array<{ relativePath: string, reason: string }>} skippedFiles - Files excluded by filters
 * @property {string[]} skippedDirectories - Ignored directory paths
 * @property {number} totalDiscoveredFiles - Total files encountered on disk
 * @property {number} durationMs - Scan time in milliseconds
 */

export class RepositoryScanner {
  /**
   * @param {Object} [options]
   * @param {string[]} [options.customIgnorePatterns] - Extra ignore patterns
   * @param {number} [options.maxFileSizeBytes] - Maximum file size cutoff
   * @param {boolean} [options.computeHashes=true] - Whether to calculate SHA-256 hashes
   * @param {boolean} [options.countLines=true] - Whether to count lines of code
   * @param {function(FileDescriptor): void} [options.onProgress] - Optional progress callback
   */
  constructor(options = {}) {
    this.options = {
      computeHashes: true,
      countLines: true,
      ...options
    };
  }

  /**
   * Counts the number of newline characters in a file buffer.
   * Handles LF (\n) and CRLF (\r\n) cleanly.
   *
   * @param {string} filePath - Path to file
   * @returns {Promise<number>} Number of lines
   */
  async _countLines(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      if (content.length === 0) return 0;
      // Split on newline to get line count
      return content.split(/\r\n|\r|\n/).length;
    } catch {
      return 0;
    }
  }

  /**
   * Scans a repository directory recursively.
   *
   * @param {string} targetDir - Repository path to scan
   * @returns {Promise<ScanResult>} Discovered source files and scanning metadata
   */
  async scan(targetDir) {
    const startTime = Date.now();
    const resolvedRoot = path.resolve(targetDir);

    // 1. Verify directory exists and is a directory
    let stat;
    try {
      stat = await fs.promises.stat(resolvedRoot);
    } catch (err) {
      throw new Error(`Repository path does not exist: "${resolvedRoot}" (${err.message})`);
    }

    if (!stat.isDirectory()) {
      throw new Error(`Repository path is not a directory: "${resolvedRoot}"`);
    }

    // 2. Initialize filter with repository context
    const filter = new FileFilter({
      rootPath: resolvedRoot,
      customIgnorePatterns: this.options.customIgnorePatterns,
      maxFileSizeBytes: this.options.maxFileSizeBytes
    });

    /** @type {FileDescriptor[]} */
    const files = [];
    /** @type {Array<{ relativePath: string, reason: string }>} */
    const skippedFiles = [];
    /** @type {string[]} */
    const skippedDirectories = [];
    let totalDiscoveredFiles = 0;

    /**
     * Recursive directory walker
     * @param {string} currentDir - Current absolute directory path
     */
    const walk = async (currentDir) => {
      let entries;
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (err) {
        console.warn(`[RepoMap] Permission denied or unreadable directory: ${currentDir} (${err.message})`);
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = toRelativePath(resolvedRoot, fullPath);

        // Security check: ensure path does not escape root
        if (!isSafePath(resolvedRoot, fullPath)) {
          console.warn(`[RepoMap] Path traversal detected, skipping: ${fullPath}`);
          continue;
        }

        if (entry.isDirectory()) {
          // Check directory ignore rules BEFORE recursing
          if (filter.shouldIgnoreDirectory(entry.name, relPath)) {
            skippedDirectories.push(relPath);
            continue;
          }
          await walk(fullPath);
        } else if (entry.isFile()) {
          totalDiscoveredFiles++;

          let fileStat;
          try {
            fileStat = await fs.promises.stat(fullPath);
          } catch {
            skippedFiles.push({ relativePath: relPath, reason: 'Failed to stat file' });
            continue;
          }

          const filterResult = filter.shouldIgnoreFile(entry.name, relPath, fileStat.size);
          if (filterResult.ignored) {
            skippedFiles.push({ relativePath: relPath, reason: filterResult.reason });
            continue;
          }

          const language = filter.getLanguage(entry.name);
          const extension = path.extname(entry.name).toLowerCase();

          // Calculate content hash and line count if enabled
          let contentHash = '';
          if (this.options.computeHashes) {
            try {
              contentHash = await computeFileHash(fullPath);
            } catch (err) {
              console.warn(`[RepoMap] Could not hash file ${relPath}: ${err.message}`);
            }
          }

          let lineCount = 0;
          if (this.options.countLines) {
            lineCount = await this._countLines(fullPath);
          }

          /** @type {FileDescriptor} */
          const descriptor = {
            path: fullPath,
            relativePath: normalizePath(relPath),
            name: entry.name,
            extension,
            language,
            sizeBytes: fileStat.size,
            mtimeMs: fileStat.mtimeMs,
            lineCount,
            contentHash
          };

          files.push(descriptor);

          if (typeof this.options.onProgress === 'function') {
            this.options.onProgress(descriptor);
          }
        }
      }
    };

    await walk(resolvedRoot);

    const durationMs = Date.now() - startTime;

    return {
      rootPath: normalizePath(resolvedRoot),
      files,
      skippedFiles,
      skippedDirectories,
      totalDiscoveredFiles,
      durationMs
    };
  }
}
