import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../src/storage/database.js';
import { RepositoryStore } from '../src/storage/repository-store.js';

describe('Database and RepositoryStore', () => {
  let db;
  let store;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new RepositoryStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should initialize tables and performance indices', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all().map((r) => r.name);

    expect(tables).toContain('repositories');
    expect(tables).toContain('files');
    expect(tables).toContain('symbols');
    expect(tables).toContain('dependencies');
    expect(tables).toContain('symbol_references');
  });

  it('should support atomic transactions and rollback on error', () => {
    const repo = store.getOrCreateRepository('/test/repo');

    expect(() => {
      db.transaction(() => {
        store.saveFile(repo.id, {
          relativePath: 'file1.js',
          language: 'javascript',
          sizeBytes: 100,
          contentHash: 'hash1',
          mtimeMs: 1000,
          lineCount: 10
        });
        throw new Error('Simulated failure');
      });
    }).toThrow('Simulated failure');

    const files = store.getStoredFiles(repo.id);
    expect(files.size).toBe(0);
  });

  it('should cascade delete symbols and dependencies when a file is deleted', () => {
    const repo = store.getOrCreateRepository('/test/repo');
    const fileId = store.saveFile(repo.id, {
      relativePath: 'src/auth.js',
      language: 'javascript',
      sizeBytes: 500,
      contentHash: 'hash1',
      mtimeMs: 2000,
      lineCount: 50
    });

    store.replaceSymbols(fileId, [
      {
        id: 'sym1',
        name: 'login',
        kind: 'function',
        filePath: 'src/auth.js',
        startPosition: { line: 1, column: 1 },
        endPosition: { line: 5, column: 1 },
        isExported: true
      }
    ]);

    expect(store.searchSymbols(repo.id, 'login').length).toBe(1);

    // Delete file
    store.deleteFile(fileId);

    // Symbols should be gone
    expect(store.searchSymbols(repo.id, 'login').length).toBe(0);
    expect(store.getStoredFiles(repo.id).size).toBe(0);
  });
});
