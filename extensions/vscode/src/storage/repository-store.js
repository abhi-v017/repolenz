/**
 * Repository Store for RepoMap
 *
 * Provides repository, file, symbol, and dependency persistence
 * on top of the DatabaseSync SQLite layer.
 */

import crypto from 'node:crypto';
import { normalizePath } from '../utils/path-utils.js';

export class RepositoryStore {
  /**
   * @param {import('./database.js').Database} db
   */
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  /**
   * Compiles frequently executed SQL statements.
   * @private
   */
  _prepareStatements() {
    this.stmtGetRepoByPath = this.db.prepare(
      'SELECT * FROM repositories WHERE root_path = ?'
    );
    this.stmtInsertRepo = this.db.prepare(
      'INSERT INTO repositories (id, name, root_path, created_at, last_indexed_at) VALUES (?, ?, ?, ?, ?)'
    );
    this.stmtUpdateRepoIndexed = this.db.prepare(
      'UPDATE repositories SET last_indexed_at = ? WHERE id = ?'
    );
    this.stmtGetFilesByRepo = this.db.prepare(
      'SELECT id, relative_path, language, size_bytes, content_hash, mtime_ms, line_count, status FROM files WHERE repo_id = ?'
    );
    this.stmtInsertFile = this.db.prepare(
      `INSERT INTO files (id, repo_id, relative_path, language, size_bytes, content_hash, mtime_ms, line_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(repo_id, relative_path) DO UPDATE SET
         language = excluded.language,
         size_bytes = excluded.size_bytes,
         content_hash = excluded.content_hash,
         mtime_ms = excluded.mtime_ms,
         line_count = excluded.line_count,
         status = excluded.status`
    );
    this.stmtDeleteFile = this.db.prepare(
      'DELETE FROM files WHERE id = ?'
    );
    this.stmtDeleteSymbolsByFile = this.db.prepare(
      'DELETE FROM symbols WHERE file_id = ?'
    );
    this.stmtDeleteDepsByFile = this.db.prepare(
      'DELETE FROM dependencies WHERE source_file_id = ?'
    );
    this.stmtDeleteRefsByFile = this.db.prepare(
      'DELETE FROM symbol_references WHERE source_file_id = ?'
    );
    this.stmtInsertSymbol = this.db.prepare(
      `INSERT INTO symbols (id, file_id, name, kind, parent_symbol_name, start_line, start_col, end_line, end_col, is_exported, super_class, parameters)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.stmtInsertDep = this.db.prepare(
      `INSERT INTO dependencies (id, source_file_id, raw_specifier, resolved_file_id, dependency_type, imported_symbols, line_number)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    this.stmtInsertRef = this.db.prepare(
      `INSERT INTO symbol_references (id, source_file_id, caller_symbol_name, callee_name, line_number)
       VALUES (?, ?, ?, ?, ?)`
    );
  }

  /**
   * Retrieves an existing repository record or registers a new one.
   *
   * @param {string} rootPath - Absolute path
   * @param {string} [repoName] - Optional display name
   * @returns {{ id: string, name: string, root_path: string, created_at: number, last_indexed_at: number|null }}
   */
  getOrCreateRepository(rootPath, repoName = '') {
    const normPath = normalizePath(rootPath);
    let repo = this.stmtGetRepoByPath.get(normPath);

    if (!repo) {
      const id = crypto.createHash('sha256').update(normPath).digest('hex').slice(0, 16);
      const name = repoName || normPath.split('/').pop() || 'repository';
      const now = Date.now();

      this.stmtInsertRepo.run(id, name, normPath, now, null);
      repo = { id, name, root_path: normPath, created_at: now, last_indexed_at: null };
    }

    return repo;
  }

  /**
   * Updates last indexed timestamp for a repository.
   *
   * @param {string} repoId
   * @param {number} [timestamp]
   */
  updateLastIndexed(repoId, timestamp = Date.now()) {
    this.stmtUpdateRepoIndexed.run(timestamp, repoId);
  }

  /**
   * Retrieves all tracked files for a repository as a Map keyed by relative path.
   *
   * @param {string} repoId
   * @returns {Map<string, { id: string, relative_path: string, content_hash: string, mtime_ms: number, size_bytes: number, line_count: number, language: string }>}
   */
  getStoredFiles(repoId) {
    const rows = this.stmtGetFilesByRepo.all(repoId);
    const map = new Map();
    for (const r of rows) {
      map.set(r.relative_path, r);
    }
    return map;
  }

  /**
   * Inserts or updates a file record.
   *
   * @param {string} repoId
   * @param {import('../core/repository-scanner.js').FileDescriptor} file
   * @returns {string} File ID
   */
  saveFile(repoId, file) {
    const fileId = `${repoId}:${file.relativePath}`;
    this.stmtInsertFile.run(
      fileId,
      repoId,
      file.relativePath,
      file.language,
      file.sizeBytes,
      file.contentHash,
      Math.floor(file.mtimeMs),
      file.lineCount,
      'indexed'
    );
    return fileId;
  }

  /**
   * Deletes a file and all associated symbols and dependencies.
   *
   * @param {string} fileId
   */
  deleteFile(fileId) {
    this.stmtDeleteFile.run(fileId);
  }

  /**
   * Replaces symbols for a specific file.
   *
   * @param {string} fileId
   * @param {import('../core/symbol-extractor.js').CodeSymbol[]} symbols
   */
  replaceSymbols(fileId, symbols) {
    this.stmtDeleteSymbolsByFile.run(fileId);
    for (const s of symbols) {
      this.stmtInsertSymbol.run(
        s.id,
        fileId,
        s.name,
        s.kind,
        s.parentSymbolName || null,
        s.startPosition.line,
        s.startPosition.column,
        s.endPosition.line,
        s.endPosition.column,
        s.isExported ? 1 : 0,
        s.superClass || null,
        s.parameters ? JSON.stringify(s.parameters) : null
      );
    }
  }

  /**
   * Replaces dependencies for a specific file.
   *
   * @param {string} fileId
   * @param {import('../core/dependency-analyzer.js').ResolvedDependency[]} dependencies
   * @param {Map<string, string>} relativePathToFileIdMap
   */
  replaceDependencies(fileId, dependencies, relativePathToFileIdMap) {
    this.stmtDeleteDepsByFile.run(fileId);
    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i];
      const depId = `${fileId}:dep:${i}`;
      let resolvedFileId = null;
      if (dep.targetFile && relativePathToFileIdMap && relativePathToFileIdMap.has(dep.targetFile)) {
        resolvedFileId = relativePathToFileIdMap.get(dep.targetFile);
      }

      this.stmtInsertDep.run(
        depId,
        fileId,
        dep.rawSpecifier,
        resolvedFileId,
        dep.sourceType,
        JSON.stringify(dep.importedSymbols || []),
        dep.line || 0
      );
    }
  }

  /**
   * Replaces call references for a specific file.
   *
   * @param {string} fileId
   * @param {import('../core/symbol-extractor.js').CallReference[]} calls
   */
  replaceReferences(fileId, calls) {
    this.stmtDeleteRefsByFile.run(fileId);
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const refId = `${fileId}:ref:${i}`;
      this.stmtInsertRef.run(
        refId,
        fileId,
        call.callerSymbolName,
        call.calleeName,
        call.line
      );
    }
  }

  /**
   * Searches symbols by name, kind, export flag, and file pattern.
   *
   * @param {string} repoId
   * @param {string} query - Symbol name or search substring
   * @param {Object} [options]
   * @param {string} [options.kind] - 'function', 'class', 'method', 'interface'
   * @param {boolean} [options.isExported]
   * @param {string} [options.filePattern]
   * @param {number} [options.limit=50]
   * @returns {Array<Object>}
   */
  searchSymbols(repoId, query = '', options = {}) {
    let sql = `
      SELECT
        s.id, s.name, s.kind, s.parent_symbol_name,
        s.start_line, s.start_col, s.end_line, s.end_col,
        s.is_exported, s.super_class, s.parameters,
        f.relative_path, f.language
      FROM symbols s
      JOIN files f ON s.file_id = f.id
      WHERE f.repo_id = ?
    `;

    const params = [repoId];

    if (query) {
      sql += ' AND s.name LIKE ?';
      params.push(`%${query}%`);
    }

    if (options.kind) {
      sql += ' AND s.kind = ?';
      params.push(options.kind);
    }

    if (typeof options.isExported === 'boolean') {
      sql += ' AND s.is_exported = ?';
      params.push(options.isExported ? 1 : 0);
    }

    if (options.filePattern) {
      sql += ' AND f.relative_path LIKE ?';
      params.push(`%${options.filePattern}%`);
    }

    sql += ' ORDER BY s.name ASC LIMIT ?';
    params.push(options.limit || 50);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((r) => ({
      ...r,
      is_exported: Boolean(r.is_exported),
      parameters: r.parameters ? JSON.parse(r.parameters) : []
    }));
  }

  /**
   * Returns aggregated repository metrics directly from SQLite.
   *
   * @param {string} repoId
   * @returns {{ filesCount: number, symbolsCount: number, totalLOC: number, totalBytes: number }}
   */
  getRepoMetrics(repoId) {
    const fileRow = this.db.prepare(`
      SELECT COUNT(*) as filesCount, COALESCE(SUM(line_count), 0) as totalLOC, COALESCE(SUM(size_bytes), 0) as totalBytes
      FROM files WHERE repo_id = ?
    `).get(repoId);

    const symbolRow = this.db.prepare(`
      SELECT COUNT(*) as symbolsCount
      FROM symbols s
      JOIN files f ON s.file_id = f.id
      WHERE f.repo_id = ?
    `).get(repoId);

    return {
      filesCount: Number(fileRow.filesCount),
      totalLOC: Number(fileRow.totalLOC),
      totalBytes: Number(fileRow.totalBytes),
      symbolsCount: Number(symbolRow.symbolsCount)
    };
  }
}
