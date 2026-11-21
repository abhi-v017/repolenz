/**
 * SQLite Database Connection and Schema Manager for RepoMap
 *
 * Uses Node.js built-in DatabaseSync (node:sqlite) for embedded, zero-dependency,
 * synchronous SQLite persistence with WAL mode enabled.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * SQL DDL Statements for RepoMap Schema.
 */
const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  last_indexed_at INTEGER
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  language TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  mtime_ms INTEGER NOT NULL,
  line_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'indexed',
  UNIQUE(repo_id, relative_path)
);

CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  parent_symbol_name TEXT,
  start_line INTEGER NOT NULL,
  start_col INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  end_col INTEGER NOT NULL,
  is_exported INTEGER NOT NULL DEFAULT 0,
  super_class TEXT,
  parameters TEXT
);

CREATE TABLE IF NOT EXISTS dependencies (
  id TEXT PRIMARY KEY,
  source_file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  raw_specifier TEXT NOT NULL,
  resolved_file_id TEXT REFERENCES files(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL,
  imported_symbols TEXT,
  line_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS symbol_references (
  id TEXT PRIMARY KEY,
  source_file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  caller_symbol_name TEXT NOT NULL,
  callee_name TEXT NOT NULL,
  line_number INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_repo ON files(repo_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(repo_id, relative_path);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_deps_source ON dependencies(source_file_id);
CREATE INDEX IF NOT EXISTS idx_deps_resolved ON dependencies(resolved_file_id);
CREATE INDEX IF NOT EXISTS idx_refs_source ON symbol_references(source_file_id);
CREATE INDEX IF NOT EXISTS idx_refs_callee ON symbol_references(callee_name);
`;

export class Database {
  /**
   * @param {string} [dbPath=':memory:'] - Path to SQLite file or ':memory:'
   */
  constructor(dbPath = ':memory:') {
    this.dbPath = dbPath;

    // Ensure parent directory exists for file-backed database
    if (dbPath !== ':memory:') {
      const dir = path.dirname(path.resolve(dbPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.rawDb = new DatabaseSync(dbPath);

    // Enable WAL mode for disk files for high concurrent performance
    if (dbPath !== ':memory:') {
      try {
        this.rawDb.exec('PRAGMA journal_mode = WAL;');
      } catch {
        // In-memory or restricted environments may skip WAL
      }
    }

    this._initializeSchema();
  }

  /**
   * Executes DDL to create schema and performance indices.
   * @private
   */
  _initializeSchema() {
    this.rawDb.exec(SCHEMA_SQL);
  }

  /**
   * Executes a SQL command directly.
   * @param {string} sql
   */
  exec(sql) {
    return this.rawDb.exec(sql);
  }

  /**
   * Prepares a SQL statement.
   * @param {string} sql
   * @returns {import('node:sqlite').StatementSync}
   */
  prepare(sql) {
    return this.rawDb.prepare(sql);
  }

  /**
   * Runs a function inside an immediate database transaction.
   * Rolls back automatically if an error is thrown.
   *
   * @template T
   * @param {function(): T} callback
   * @returns {T}
   */
  transaction(callback) {
    this.rawDb.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = callback();
      this.rawDb.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        this.rawDb.exec('ROLLBACK;');
      } catch {
        // Rollback failure is ignored
      }
      throw err;
    }
  }

  /**
   * Closes database connection.
   */
  close() {
    this.rawDb.close();
  }
}
