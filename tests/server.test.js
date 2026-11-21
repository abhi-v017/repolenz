import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/server/app.js';

/**
 * Lightweight in-memory HTTP dispatcher for testing Express apps without TCP sockets.
 */
function request(app, method, url, body = null) {
  return new Promise((resolve) => {
    const [pathPart, queryPart] = url.split('?');
    const query = {};
    if (queryPart) {
      new URLSearchParams(queryPart).forEach((v, k) => {
        query[k] = v;
      });
    }

    const req = {
      method,
      url,
      path: pathPart,
      query,
      body: body || {},
      headers: {}
    };

    const res = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(k, v) {
        this.headers[k] = v;
        return this;
      },
      json(data) {
        this.body = data;
        resolve(this);
      },
      send(data) {
        this.body = data;
        resolve(this);
      },
      end() {
        resolve(this);
      }
    };

    app(req, res, (err) => {
      if (err) {
        res.statusCode = err.status || 500;
        res.body = { error: err.message };
        resolve(res);
      }
    });
  });
}

describe('RepoMap Express API Server (In-Memory)', () => {
  let app;
  let service;

  beforeAll(() => {
    const appBundle = createApp(process.cwd());
    app = appBundle.app;
    service = appBundle.service;
  });

  afterAll(() => {
    service.close();
  });

  it('GET /api/repository/status should return repository status and metrics', async () => {
    const res = await request(app, 'GET', '/api/repository/status');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('repoId');
    expect(res.body).toHaveProperty('rootPath');
    expect(res.body).toHaveProperty('metrics');
  });

  it('GET /api/repository/recents should return recent repositories list', async () => {
    const res = await request(app, 'GET', '/api/repository/recents');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.recents)).toBe(true);
    expect(res.body.recents.length).toBeGreaterThan(0);
  });

  it('GET /api/repository/files should return discovered files and directory tree', async () => {
    const res = await request(app, 'GET', '/api/repository/files');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(res.body.files.length).toBeGreaterThan(0);
    expect(res.body.tree).toHaveProperty('type', 'directory');
    expect(res.body.tree).toHaveProperty('children');
  });

  it('GET /api/repository/file should return file content and line count', async () => {
    const res = await request(app, 'GET', '/api/repository/file?path=src/utils/path-utils.js');
    expect(res.statusCode).toBe(200);
    expect(res.body.relativePath).toBe('src/utils/path-utils.js');
    expect(res.body.lineCount).toBeGreaterThan(0);
    expect(res.body.content).toContain('normalizePath');
  });

  it('GET /api/repository/file should reject path traversal attempts', async () => {
    const res = await request(app, 'GET', '/api/repository/file?path=../../etc/passwd');
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('escapes repository root');
  });

  it('GET /api/graph should return React Flow nodes and edges', async () => {
    const res = await request(app, 'GET', '/api/graph');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
    expect(res.body.nodes.length).toBeGreaterThan(0);
    expect(res.body.edges.length).toBeGreaterThan(0);
  });

  it('GET /api/graph/impact should calculate change blast radius', async () => {
    const res = await request(app, 'GET', '/api/graph/impact?file=src/utils/path-utils.js');
    expect(res.statusCode).toBe(200);
    expect(res.body.targetFile).toBe('src/utils/path-utils.js');
    expect(res.body.totalImpacted).toBeGreaterThan(0);
    expect(Array.isArray(res.body.impactedFiles)).toBe(true);
  });

  it('GET /api/search/symbols should return symbol search results', async () => {
    // Run incremental index first
    await request(app, 'POST', '/api/repository/index');

    const res = await request(app, 'GET', '/api/search/symbols?q=CodeParser');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.symbols[0].name).toBe('CodeParser');
  });

  it('GET /api/search/code should return text matches with snippets', async () => {
    const res = await request(app, 'GET', '/api/search/code?q=normalizePath');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.matches[0]).toHaveProperty('filePath');
    expect(res.body.matches[0]).toHaveProperty('lineNumber');
    expect(res.body.matches[0]).toHaveProperty('contextLines');
  });

  it('POST /api/qa/ask should answer questions with source citations', async () => {
    const res = await request(app, 'POST', '/api/qa/ask', {
      question: 'Where is CodeParser implemented?'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.hasSufficientEvidence).toBe(true);
    expect(res.body.answer).toContain('CodeParser');
    expect(res.body.citations.length).toBeGreaterThan(0);
    expect(res.body.citations[0].filePath).toContain('parser.js');
  });
});
