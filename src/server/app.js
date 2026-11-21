/**
 * RepoMap Express Server
 *
 * Exposes REST API endpoints for repository analysis, graph visualization,
 * symbol search, and static web dashboard.
 */

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { RepositoryService } from './services/repository-service.js';
import { createApiRouter } from './routes/api.js';

export function createApp(initialRepoPath = process.cwd()) {
  const app = express();
  const service = new RepositoryService(initialRepoPath);

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Mount API routes
  app.use('/api', createApiRouter(service));

  // Serve compiled React frontend if present (resolve relative to package and cwd)
  const packageDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
  const distInPackage = path.join(packageDir, 'web/dist');
  const distInCwd = path.resolve(process.cwd(), 'web/dist');
  const clientDistPath = fs.existsSync(distInPackage) ? distInPackage : distInCwd;

  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(clientDistPath, 'index.html'));
      }
      next();
    });
  }

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error(`[RepoLenz Server Error] ${req.method} ${req.url}:`, err.message);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error'
    });
  });

  return { app, service };
}

/**
 * Starts the standalone server.
 */
export async function startServer(port = 3001, initialRepoPath = process.cwd()) {
  const { app, service } = createApp(initialRepoPath);

  return new Promise((resolve) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`\n🚀 RepoLenz API Server running at http://0.0.0.0:${port}`);
      console.log(`📂 Active repository: ${service.rootPath}\n`);
      resolve({ server, service });
    });
  });
}

// Auto-start when executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  const repoPath = process.argv[2] || process.cwd();
  startServer(port, repoPath);
}
