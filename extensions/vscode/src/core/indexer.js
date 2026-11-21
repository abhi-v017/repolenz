/**
 * Incremental Indexing Engine for RepoMap
 *
 * Compares repository filesystem state against SQLite records:
 * - Skips unchanged files (0ms parsing overhead on subsequent runs).
 * - Re-indexes modified files and atomic transaction updates.
 * - Prunes deleted files and their cascading relationships.
 */

import path from 'node:path';
import { RepositoryScanner } from './repository-scanner.js';
import { CodeParser } from './parser.js';
import { SymbolExtractor } from './symbol-extractor.js';
import { DependencyAnalyzer } from './dependency-analyzer.js';
import { normalizePath } from '../utils/path-utils.js';

/**
 * @typedef {Object} IndexingSummary
 * @property {string} repoId - Unique repository ID
 * @property {string} rootPath - Normalized repository root path
 * @property {number} totalFiles - Total source files in repository
 * @property {number} addedCount - Newly discovered files
 * @property {number} modifiedCount - Files re-indexed due to hash changes
 * @property {number} unchangedCount - Unchanged files skipped
 * @property {number} deletedCount - Deleted files purged from database
 * @property {number} durationMs - Total indexing duration in milliseconds
 */

export class IncrementalIndexer {
  /**
   * @param {import('../storage/database.js').Database} db
   * @param {import('../storage/repository-store.js').RepositoryStore} store
   */
  constructor(db, store) {
    this.db = db;
    this.store = store;
    this.parser = new CodeParser();
  }

  /**
   * Runs an incremental indexing cycle on a repository directory.
   *
   * @param {string} targetDir - Directory path
   * @param {Object} [options]
   * @param {string[]} [options.customIgnorePatterns]
   * @param {number} [options.maxFileSizeBytes]
   * @param {function(string, number, number): void} [options.onProgress]
   * @returns {Promise<IndexingSummary>}
   */
  async index(targetDir, options = {}) {
    const startTime = Date.now();
    const resolvedRoot = normalizePath(path.resolve(targetDir));

    // 1. Get or register repository in SQLite
    const repo = this.store.getOrCreateRepository(resolvedRoot);
    const repoId = repo.id;

    // 2. Scan repository on disk
    const scanner = new RepositoryScanner({
      customIgnorePatterns: options.customIgnorePatterns,
      maxFileSizeBytes: options.maxFileSizeBytes,
      computeHashes: true,
      countLines: true
    });
    const scanResult = await scanner.scan(resolvedRoot);
    const diskFiles = scanResult.files;

    // 3. Fetch current database state
    const storedFilesMap = this.store.getStoredFiles(repoId);

    // 4. Categorize files into added, modified, unchanged, deleted
    const diskPathsSet = new Set();
    const toIndex = [];
    let unchangedCount = 0;

    for (const diskFile of diskFiles) {
      diskPathsSet.add(diskFile.relativePath);
      const stored = storedFilesMap.get(diskFile.relativePath);

      if (!stored) {
        toIndex.push({ file: diskFile, type: 'added' });
      } else if (stored.content_hash !== diskFile.contentHash) {
        toIndex.push({ file: diskFile, type: 'modified' });
      } else {
        unchangedCount++;
      }
    }

    // Identify deleted files
    const deletedFiles = [];
    for (const [relPath, stored] of storedFilesMap.entries()) {
      if (!diskPathsSet.has(relPath)) {
        deletedFiles.push(stored);
      }
    }

    const addedCount = toIndex.filter((item) => item.type === 'added').length;
    const modifiedCount = toIndex.filter((item) => item.type === 'modified').length;
    const deletedCount = deletedFiles.length;

    // 5. Parse and extract only added and modified files
    if (toIndex.length > 0) {
      await this.parser.init();
    }

    const analyzer = new DependencyAnalyzer(resolvedRoot, diskPathsSet);
    const parsedData = [];

    for (let i = 0; i < toIndex.length; i++) {
      const { file } = toIndex[i];
      if (typeof options.onProgress === 'function') {
        options.onProgress(file.relativePath, i + 1, toIndex.length);
      }

      try {
        const { rootNode } = await this.parser.parseFile(file.path);
        const extracted = SymbolExtractor.extract(rootNode, file.relativePath);

        // Resolve dependencies
        const resolvedDeps = extracted.imports.map((imp) =>
          analyzer.resolveImport(file.relativePath, imp)
        );

        parsedData.push({
          file,
          symbols: extracted.symbols,
          dependencies: resolvedDeps,
          calls: extracted.calls
        });
      } catch (err) {
        console.warn(`[RepoMap Indexer] Failed to parse ${file.relativePath}: ${err.message}`);
      }
    }

    // 6. Build a complete relativePath -> fileId map for resolving foreign keys
    const relativePathToFileIdMap = new Map();
    for (const f of diskFiles) {
      relativePathToFileIdMap.set(f.relativePath, `${repoId}:${f.relativePath}`);
    }

    // 7. Apply updates to SQLite inside an atomic transaction
    this.db.transaction(() => {
      // Delete removed files
      for (const del of deletedFiles) {
        this.store.deleteFile(del.id);
      }

      // 1. Upsert all newly discovered / modified files first
      for (const item of parsedData) {
        this.store.saveFile(repoId, item.file);
      }

      // 2. Save symbols, dependencies, and call references
      for (const item of parsedData) {
        const fileId = `${repoId}:${item.file.relativePath}`;
        this.store.replaceSymbols(fileId, item.symbols);
        this.store.replaceDependencies(fileId, item.dependencies, relativePathToFileIdMap);
        this.store.replaceReferences(fileId, item.calls);
      }

      // Update repo timestamp
      this.store.updateLastIndexed(repoId);
    });

    const durationMs = Date.now() - startTime;

    return {
      repoId,
      rootPath: resolvedRoot,
      totalFiles: diskFiles.length,
      addedCount,
      modifiedCount,
      unchangedCount,
      deletedCount,
      durationMs
    };
  }
}
