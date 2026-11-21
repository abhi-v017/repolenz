/**
 * File Filtering and Ignore Engine for RepoMap
 *
 * Implements intelligent repository filtering:
 * 1. Fast directory exclusion BEFORE recursing.
 * 2. .gitignore and .repomapignore pattern compliance via the 'ignore' engine.
 * 3. File size limits (protects against huge bundles/minified code).
 * 4. Sensitive file & secret exclusion (.env, keys, certificates).
 * 5. Supported language extension validation.
 */

import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import {
  normalizePath,
  isSupportedSourceFile,
  getLanguageFromExtension
} from '../utils/path-utils.js';

/**
 * Standard directories that should always be ignored across all repositories.
 * Checked before entering to avoid massive wasted I/O.
 */
export const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'coverage',
  '.nyc_output',
  '.repomap',
  '.repolenz',
  '.idea',
  'vendor',
  'bower_components'
]);

/**
 * Patterns for files that should never be indexed (binaries, secrets, lockfiles).
 */
export const DEFAULT_IGNORED_PATTERNS = [
  // Secrets and environment files
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  '*.crt',
  '*.cert',
  'id_rsa',
  'id_ed25519',

  // Lockfiles (large JSON/YAML without useful AST symbols)
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',

  // Minified and source map files
  '*.min.js',
  '*.min.mjs',
  '*.bundle.js',
  '*.map',

  // OS artifacts
  '.DS_Store',
  'Thumbs.db',

  // Local helper binaries
  'powershell.exe'
];

/**
 * Default maximum file size in bytes to index (500 KB).
 * Prevents parser hanging on massive single-line generated files.
 */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 500 * 1024;

export class FileFilter {
  /**
   * @param {Object} [options]
   * @param {string} [options.rootPath] - Absolute path to repository root
   * @param {string[]} [options.customIgnorePatterns] - Extra glob patterns to ignore
   * @param {number} [options.maxFileSizeBytes] - Maximum file size cutoff
   */
  constructor(options = {}) {
    this.rootPath = options.rootPath ? path.resolve(options.rootPath) : process.cwd();
    this.maxFileSizeBytes = options.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE_BYTES;

    // Initialize the ignore instance
    this.ig = ignore();

    // Add default ignore patterns
    this.ig.add(DEFAULT_IGNORED_PATTERNS);

    // Add custom patterns if provided
    if (Array.isArray(options.customIgnorePatterns)) {
      this.ig.add(options.customIgnorePatterns);
    }

    // Load .gitignore and .repomapignore if rootPath is available
    this._loadIgnoreFiles();
  }

  /**
   * Loads .gitignore and .repomapignore from the root repository directory if they exist.
   * @private
   */
  _loadIgnoreFiles() {
    const gitignorePath = path.join(this.rootPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        this.ig.add(content);
      } catch (err) {
        // Soft-fail: warn but don't break scanning
        console.warn(`[RepoMap] Could not read .gitignore at ${gitignorePath}:`, err.message);
      }
    }

    const repomapIgnorePath = path.join(this.rootPath, '.repomapignore');
    const repolenzIgnorePath = path.join(this.rootPath, '.repolenzignore');
    const ignoreFile = fs.existsSync(repolenzIgnorePath) ? repolenzIgnorePath : repomapIgnorePath;
    if (fs.existsSync(ignoreFile)) {
      try {
        const content = fs.readFileSync(ignoreFile, 'utf8');
        this.ig.add(content);
      } catch (err) {
        console.warn(`[RepoLenz] Could not read ${path.basename(ignoreFile)}:`, err.message);
      }
    }
  }

  /**
   * Fast check to determine if a directory should be completely skipped.
   * Checks both static directory names and gitignore patterns.
   *
   * @param {string} dirName - Single folder name (e.g., "node_modules")
   * @param {string} relativeDirPath - Normalized path from root (e.g., "packages/app/node_modules")
   * @returns {boolean} True if directory should be skipped
   */
  shouldIgnoreDirectory(dirName, relativeDirPath) {
    if (DEFAULT_IGNORED_DIRS.has(dirName)) {
      return true;
    }

    if (!relativeDirPath) {
      return false;
    }

    // Normalize with trailing slash for gitignore directory matching
    const normalized = normalizePath(relativeDirPath) + '/';
    return this.ig.ignores(normalized);
  }

  /**
   * Determines if a file should be ignored during indexing.
   *
   * @param {string} fileName - Bare file name (e.g., "auth.js")
   * @param {string} relativeFilePath - Normalized relative path from root
   * @param {number} [sizeBytes] - File size in bytes if already known
   * @returns {{ ignored: boolean, reason?: string }}
   */
  shouldIgnoreFile(fileName, relativeFilePath, sizeBytes) {
    const normalized = normalizePath(relativeFilePath);

    // 1. Check size limit
    if (typeof sizeBytes === 'number' && sizeBytes > this.maxFileSizeBytes) {
      return {
        ignored: true,
        reason: `Exceeds max file size limit (${Math.round(sizeBytes / 1024)} KB > ${Math.round(this.maxFileSizeBytes / 1024)} KB)`
      };
    }

    // 2. Check gitignore / ignore patterns
    if (this.ig.ignores(normalized)) {
      return {
        ignored: true,
        reason: 'Matched ignore rule (.gitignore or default ignore)'
      };
    }

    // 3. Check language support
    if (!isSupportedSourceFile(fileName)) {
      return {
        ignored: true,
        reason: 'Unsupported file extension or language'
      };
    }

    return { ignored: false };
  }

  /**
   * Helper to check if a file has a supported programming language.
   *
   * @param {string} filePath - Path to file
   * @returns {string|null} Language name or null
   */
  getLanguage(filePath) {
    return getLanguageFromExtension(filePath);
  }
}
