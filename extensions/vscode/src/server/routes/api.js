/**
 * Express REST API Routes for RepoMap
 */

import { Router } from 'express';

/**
 * Creates API router bound to a RepositoryService instance.
 *
 * @param {import('../services/repository-service.js').RepositoryService} service
 * @returns {Router}
 */
export function createApiRouter(service) {
  const router = Router();

  // 1. Repository Management
  router.post('/repository/select', async (req, res, next) => {
    try {
      const { path: targetPath } = req.body;
      if (!targetPath) {
        return res.status(400).json({ error: 'Field "path" is required in request body' });
      }
      await service.setRepository(targetPath);
      res.json({ message: 'Repository path updated', path: service.rootPath });
    } catch (err) {
      next(err);
    }
  });

  // 1b. Upload Project Files (Enables local project analysis on cloud-hosted instances)
  router.post('/repository/upload', async (req, res, next) => {
    try {
      const { name, files } = req.body;
      if (!name || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Valid repository "name" and "files" array are required' });
      }

      const uploadedPath = await service.saveUploadedFiles(name, files);
      res.json({ message: 'Files uploaded and indexed successfully', path: uploadedPath });
    } catch (err) {
      next(err);
    }
  });

  router.get('/repository/recents', (req, res, next) => {
    try {
      const recents = service.getRecentRepositories();
      res.json({ recents, activePath: service.rootPath });
    } catch (err) {
      next(err);
    }
  });

  router.get('/repository/status', async (req, res, next) => {
    try {
      const status = await service.getStatus();
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  router.post('/repository/index', async (req, res, next) => {
    try {
      const summary = await service.runIncrementalIndex();
      res.json({ message: 'Indexing completed', summary });
    } catch (err) {
      next(err);
    }
  });

  router.get('/repository/files', async (req, res, next) => {
    try {
      const result = await service.getFiles();
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/repository/file', async (req, res, next) => {
    try {
      const { path: filePath } = req.query;
      if (!filePath) {
        return res.status(400).json({ error: 'Query parameter "path" is required' });
      }
      const fileData = await service.getFileContent(String(filePath));
      res.json(fileData);
    } catch (err) {
      next(err);
    }
  });

  // 2. Dependency Graph & Impact Analysis
  router.get('/graph', async (req, res, next) => {
    try {
      const graphData = await service.getGraph();
      res.json(graphData);
    } catch (err) {
      next(err);
    }
  });

  router.get('/graph/impact', async (req, res, next) => {
    try {
      const { file } = req.query;
      if (!file) {
        return res.status(400).json({ error: 'Query parameter "file" is required' });
      }
      const impact = await service.getImpact(String(file));
      res.json(impact);
    } catch (err) {
      next(err);
    }
  });

  // 3. Search Endpoints
  router.get('/search/symbols', (req, res, next) => {
    try {
      const { q = '', kind, exported, file } = req.query;
      const isExported = exported === 'true' ? true : (exported === 'false' ? false : undefined);

      const symbols = service.searchSymbols(String(q), {
        kind: kind ? String(kind) : undefined,
        isExported,
        filePattern: file ? String(file) : undefined
      });

      res.json({ query: q, count: symbols.length, symbols });
    } catch (err) {
      next(err);
    }
  });

  router.get('/search/code', async (req, res, next) => {
    try {
      const { q = '', regex = 'false', ext } = req.query;
      if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const extensions = ext ? String(ext).split(',').map((e) => e.trim()) : undefined;
      const matches = await service.searchCode(String(q), {
        isRegex: regex === 'true',
        extensions
      });

      res.json({ query: q, count: matches.length, matches });
    } catch (err) {
      next(err);
    }
  });

  // 4. Source-Grounded Codebase Q&A
  router.post('/qa/ask', async (req, res, next) => {
    try {
      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ error: 'Field "question" is required in request body' });
      }

      const answerData = await service.askQuestion(String(question));
      res.json(answerData);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
