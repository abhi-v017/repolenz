import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../src/storage/database.js';
import { RepositoryStore } from '../src/storage/repository-store.js';
import { SymbolSearch } from '../src/search/symbol-search.js';

describe('SymbolSearch', () => {
  let db;
  let store;
  let searchEngine;
  let repoId;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new RepositoryStore(db);
    searchEngine = new SymbolSearch(store);

    const repo = store.getOrCreateRepository('/test/repo');
    repoId = repo.id;

    const file1 = store.saveFile(repoId, {
      relativePath: 'src/services/userService.ts',
      language: 'typescript',
      sizeBytes: 1000,
      contentHash: 'hash1',
      mtimeMs: 1000,
      lineCount: 50
    });

    const file2 = store.saveFile(repoId, {
      relativePath: 'src/controllers/userController.ts',
      language: 'typescript',
      sizeBytes: 800,
      contentHash: 'hash2',
      mtimeMs: 1000,
      lineCount: 40
    });

    store.replaceSymbols(file1, [
      {
        id: 'sym1',
        name: 'UserService',
        kind: 'class',
        filePath: 'src/services/userService.ts',
        startPosition: { line: 10, column: 1 },
        endPosition: { line: 40, column: 1 },
        isExported: true,
        superClass: 'BaseService'
      },
      {
        id: 'sym2',
        name: 'getUser',
        kind: 'method',
        parentSymbolName: 'UserService',
        filePath: 'src/services/userService.ts',
        startPosition: { line: 15, column: 3 },
        endPosition: { line: 20, column: 3 },
        isExported: true,
        parameters: ['id']
      }
    ]);

    store.replaceSymbols(file2, [
      {
        id: 'sym3',
        name: 'handleGetUser',
        kind: 'function',
        filePath: 'src/controllers/userController.ts',
        startPosition: { line: 5, column: 1 },
        endPosition: { line: 15, column: 1 },
        isExported: false,
        parameters: ['req', 'res']
      }
    ]);
  });

  afterEach(() => {
    db.close();
  });

  it('should find symbols by name substring', () => {
    const results = searchEngine.search(repoId, 'User');
    expect(results.length).toBe(3); // UserService, getUser, handleGetUser
  });

  it('should filter symbols by kind', () => {
    const classes = searchEngine.search(repoId, '', { kind: 'class' });
    expect(classes.length).toBe(1);
    expect(classes[0].name).toBe('UserService');
    expect(classes[0].super_class).toBe('BaseService');

    const methods = searchEngine.search(repoId, '', { kind: 'method' });
    expect(methods.length).toBe(1);
    expect(methods[0].name).toBe('getUser');
    expect(methods[0].parameters).toEqual(['id']);
  });

  it('should filter symbols by exported status', () => {
    const exportedOnly = searchEngine.search(repoId, '', { isExported: true });
    expect(exportedOnly.length).toBe(2);
    expect(exportedOnly.some((s) => s.name === 'handleGetUser')).toBe(false);
  });

  it('should filter symbols by file pattern', () => {
    const serviceSymbols = searchEngine.search(repoId, '', { filePattern: 'services' });
    expect(serviceSymbols.length).toBe(2);
    expect(serviceSymbols.every((s) => s.relative_path.includes('services'))).toBe(true);
  });
});
