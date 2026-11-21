import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Database } from '../src/storage/database.js';
import { RepositoryStore } from '../src/storage/repository-store.js';
import { IncrementalIndexer } from '../src/core/indexer.js';

describe('IncrementalIndexer', () => {
  let db;
  let store;
  let indexer;
  const tempDir = path.resolve('tests/fixtures/temp-indexer-repo');

  beforeEach(() => {
    // Setup clean temporary test repository
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(tempDir, 'src', 'auth.js'),
      'export function login(user) { return true; }\n'
    );
    fs.writeFileSync(
      path.join(tempDir, 'src', 'server.js'),
      'import { login } from "./auth.js";\nexport function start() { login("alice"); }\n'
    );

    db = new Database(':memory:');
    store = new RepositoryStore(db);
    indexer = new IncrementalIndexer(db, store);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should perform initial indexing and populate SQLite tables', async () => {
    const result = await indexer.index(tempDir);

    expect(result.totalFiles).toBe(2);
    expect(result.addedCount).toBe(2);
    expect(result.modifiedCount).toBe(0);
    expect(result.unchangedCount).toBe(0);

    const metrics = store.getRepoMetrics(result.repoId);
    expect(metrics.filesCount).toBe(2);
    expect(metrics.symbolsCount).toBeGreaterThanOrEqual(2);
  });

  it('should skip parsing on subsequent run when files are unchanged', async () => {
    // First run
    await indexer.index(tempDir);

    // Second run with zero changes
    const secondResult = await indexer.index(tempDir);

    expect(secondResult.totalFiles).toBe(2);
    expect(secondResult.addedCount).toBe(0);
    expect(secondResult.modifiedCount).toBe(0);
    expect(secondResult.unchangedCount).toBe(2);
    expect(secondResult.durationMs).toBeLessThan(500);
  });

  it('should detect and re-index only modified files', async () => {
    await indexer.index(tempDir);

    // Modify auth.js
    fs.appendFileSync(
      path.join(tempDir, 'src', 'auth.js'),
      'export function logout() { return false; }\n'
    );

    const result = await indexer.index(tempDir);

    expect(result.addedCount).toBe(0);
    expect(result.modifiedCount).toBe(1);
    expect(result.unchangedCount).toBe(1); // server.js was untouched!

    // Verify new symbol exists
    const symbols = store.searchSymbols(result.repoId, 'logout');
    expect(symbols.length).toBe(1);
    expect(symbols[0].name).toBe('logout');
  });

  it('should detect deleted files and remove them from SQLite', async () => {
    await indexer.index(tempDir);

    // Delete auth.js
    fs.unlinkSync(path.join(tempDir, 'src', 'auth.js'));

    const result = await indexer.index(tempDir);

    expect(result.deletedCount).toBe(1);
    expect(result.unchangedCount).toBe(1); // server.js remains

    // auth.js symbols should be gone
    const symbols = store.searchSymbols(result.repoId, 'login');
    expect(symbols.length).toBe(0);
  });
});
