import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { Database } from '../src/storage/database.js';
import { RepositoryStore } from '../src/storage/repository-store.js';
import { IncrementalIndexer } from '../src/core/indexer.js';
import { CodebaseQA } from '../src/qa/codebase-qa.js';

describe('CodebaseQA Engine', () => {
  let db;
  let store;
  let qa;
  const fixturePath = path.resolve('tests/fixtures/sample-repo');

  beforeEach(async () => {
    db = new Database(':memory:');
    store = new RepositoryStore(db);

    const indexer = new IncrementalIndexer(db, store);
    const summary = await indexer.index(fixturePath);

    qa = new CodebaseQA({
      store,
      rootPath: fixturePath,
      repoId: summary.repoId
    });
  });

  afterEach(() => {
    db.close();
  });

  it('should extract meaningful keywords filtering out common stop words', () => {
    const keywords = qa.extractKeywords('Where is the UserService defined and implemented?');
    expect(keywords).toContain('UserService');
    expect(keywords).not.toContain('Where');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('is');
  });

  it('should retrieve accurate citations and answer questions about existing code', async () => {
    const result = await qa.ask('Where is UserService implemented?', [
      'src/app.js',
      'src/services/userService.ts',
      'scripts/metrics.py'
    ]);

    expect(result.hasSufficientEvidence).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);

    const citationPaths = result.citations.map((c) => c.filePath);
    expect(citationPaths).toContain('src/services/userService.ts');

    expect(result.answer).toContain('UserService');
    expect(result.answer).toContain('src/services/userService.ts');
  });

  it('should answer questions about function definitions with exact line numbers', async () => {
    const result = await qa.ask('Which function calculates metrics?', [
      'scripts/metrics.py'
    ]);

    expect(result.hasSufficientEvidence).toBe(true);
    const metricsCitation = result.citations.find((c) => c.filePath === 'scripts/metrics.py');
    expect(metricsCitation).toBeDefined();
    expect(metricsCitation.line).toBeGreaterThan(0);
  });

  it('should report insufficient evidence when no matching code exists', async () => {
    const result = await qa.ask('How does the quantum blockchain consensus work?', [
      'src/app.js'
    ]);

    expect(result.hasSufficientEvidence).toBe(false);
    expect(result.citations.length).toBe(0);
    expect(result.answer).toContain('No direct code evidence was found');
  });
});
