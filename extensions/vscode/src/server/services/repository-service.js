/**
 * Repository Application Service for RepoMap
 *
 * Coordinates analysis, storage, graph construction, and search
 * across the local repository workspace.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Database } from '../../storage/database.js';
import { RepositoryStore } from '../../storage/repository-store.js';
import { IncrementalIndexer } from '../../core/indexer.js';
import { analyzeRepository } from '../../index.js';
import { SymbolSearch } from '../../search/symbol-search.js';
import { CodeSearch } from '../../search/code-search.js';
import { CodebaseQA } from '../../qa/codebase-qa.js';
import { normalizePath, isSafePath } from '../../utils/path-utils.js';

const RECENTS_FILE = fs.existsSync(path.resolve(process.cwd(), '.repomap/recents.json'))
  ? path.resolve(process.cwd(), '.repomap/recents.json')
  : path.resolve(process.cwd(), '.repolenz/recents.json');

export class RepositoryService {
  /**
   * @param {string} [initialPath] - Initial repository path
   * @param {string} [dbRelativePath]
   */
  constructor(initialPath = process.cwd(), dbRelativePath = null) {
    this.rootPath = normalizePath(path.resolve(initialPath));
    if (!dbRelativePath) {
      this.dbRelativePath = fs.existsSync(path.resolve(this.rootPath, '.repomap/repomap.db'))
        ? '.repomap/repomap.db'
        : '.repolenz/repolenz.db';
    } else {
      this.dbRelativePath = dbRelativePath;
    }
    this.db = null;
    this.store = null;
    this.indexer = null;
    this.cachedAnalysis = null;

    this._initDatabase();
    this._recordRecentRepository(this.rootPath);
  }

  /**
   * Reads the list of recently opened repositories.
   * @returns {Array<{ path: string, name: string, lastOpened: number }>}
   */
  getRecentRepositories() {
    try {
      if (fs.existsSync(RECENTS_FILE)) {
        const raw = fs.readFileSync(RECENTS_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return [{ path: this.rootPath, name: path.basename(this.rootPath), lastOpened: Date.now() }];
  }

  /**
   * Records a repository path to recent list.
   * @private
   */
  _recordRecentRepository(repoPath) {
    try {
      const recents = this.getRecentRepositories().filter((r) => r.path !== repoPath);
      recents.unshift({
        path: repoPath,
        name: path.basename(repoPath) || repoPath,
        lastOpened: Date.now()
      });
      const dir = path.dirname(RECENTS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(RECENTS_FILE, JSON.stringify(recents.slice(0, 10), null, 2));
    } catch {
      // ignore
    }
  }

  /**
   * Initializes or points the SQLite database to the active repository.
   * @private
   */
  _initDatabase() {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
    }

    const fullDbPath = path.resolve(this.rootPath, this.dbRelativePath);
    this.db = new Database(fullDbPath);
    this.store = new RepositoryStore(this.db);
    this.indexer = new IncrementalIndexer(this.db, this.store);
  }

  /**
   * Switches the active repository root. Supports local paths or git URLs.
   *
   * @param {string} newPath - Target directory or git URL
   */
  async setRepository(newPath) {
    if (typeof newPath === 'string') {
      let trimmed = newPath.trim();
      // Support GitHub shorthand like 'facebook/react' or 'github.com/facebook/react'
      if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
        trimmed = `https://github.com/${trimmed}`;
      } else if (trimmed.startsWith('github.com/')) {
        trimmed = `https://${trimmed}`;
      }

      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('git@')) {
        const parts = trimmed.replace(/\.git$/, '').split('/').filter(Boolean);
        const repoIdentifier = parts.slice(-2).join('_').replace(/[^a-zA-Z0-9_-]/g, '_') || 'cloned-repo';
        const clonesDir = path.resolve(process.cwd(), '.repolenz/clones');
        const targetDir = path.join(clonesDir, repoIdentifier);

        if (!fs.existsSync(clonesDir)) {
          fs.mkdirSync(clonesDir, { recursive: true });
        }

        if (!fs.existsSync(targetDir)) {
          try {
            const { execFile } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const execFileAsync = promisify(execFile);
            await execFileAsync('git', ['clone', '--depth', '1', trimmed, targetDir], { timeout: 120000 });
          } catch (err) {
            if (fs.existsSync(targetDir)) {
              try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch {}
            }
            throw new Error(`Failed to clone git repository (${trimmed}). Please ensure the repository is public and accessible.`);
          }
        }
        newPath = targetDir;
      } else {
        newPath = trimmed;
      }
    }

    // Check if user is attempting to pass a Windows drive path on a Linux cloud container
    if (process.platform !== 'win32' && typeof newPath === 'string' && (/^[A-Za-z]:/.test(newPath) || newPath.includes(':'))) {
      throw new Error(`Cannot access local drive path "${newPath}" on cloud server. Please enter a public GitHub repository link (e.g. https://github.com/expressjs/express).`);
    }

    const resolved = normalizePath(path.resolve(newPath));
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Directory not found: "${resolved}". Please enter a valid GitHub repository URL.`);
    }

    this.rootPath = resolved;
    this.cachedAnalysis = null;
    this._initDatabase();
    this._recordRecentRepository(resolved);
    await this.getOrRunAnalysis(true);
  }

  /**
   * Saves uploaded project files into a local uploads directory and switches repository.
   *
   * @param {string} repoName
   * @param {Array<{ path: string, content: string }>} files
   * @returns {Promise<string>}
   */
  async saveUploadedFiles(repoName, files) {
    const sanitizedName = (repoName || 'uploaded-project').replace(/[^a-zA-Z0-9_-]/g, '_');
    const uploadBaseDir = path.resolve(process.cwd(), '.repolenz/uploads', sanitizedName);

    // Clean or create target directory
    if (fs.existsSync(uploadBaseDir)) {
      fs.rmSync(uploadBaseDir, { recursive: true, force: true });
    }
    fs.mkdirSync(uploadBaseDir, { recursive: true });

    const uploadDirWithSep = uploadBaseDir.endsWith(path.sep) ? uploadBaseDir : uploadBaseDir + path.sep;

    // Write all uploaded files
    for (const f of files) {
      if (!f.path || typeof f.content !== 'string') continue;
      
      let relPath = f.path.replace(/^[/\\]+/, '');
      const segments = relPath.split(/[/\\]/);
      // Strip initial root folder name from webkitRelativePath if it matches repoName or sanitizedName
      if (segments.length > 1 && (segments[0] === repoName || segments[0] === sanitizedName)) {
        relPath = segments.slice(1).join('/');
      }
      
      const targetFilePath = path.resolve(uploadBaseDir, relPath);

      // Security check: ensure path does not escape uploadBaseDir
      if (!targetFilePath.startsWith(uploadDirWithSep) && targetFilePath !== uploadBaseDir) continue;

      const fileDir = path.dirname(targetFilePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      fs.writeFileSync(targetFilePath, f.content, 'utf8');
    }

    // Switch active repository to the uploaded directory
    await this.setRepository(uploadBaseDir);
    // Pre-run analysis so codebase graph is immediately primed
    await this.getOrRunAnalysis(true);
    return this.rootPath;
  }

  /**
   * Runs complete repository scanning, AST parsing, and graph construction.
   * Caches results in memory for rapid repeated querying.
   *
   * @param {boolean} [forceRefresh=false]
   */
  async getOrRunAnalysis(forceRefresh = false) {
    if (!this.cachedAnalysis || forceRefresh) {
      this.cachedAnalysis = await analyzeRepository(this.rootPath, {
        buildGraph: true,
        extractSymbols: true
      });
    }
    return this.cachedAnalysis;
  }

  /**
   * Runs incremental indexing into SQLite.
   */
  async runIncrementalIndex() {
    const summary = await this.indexer.index(this.rootPath);
    // Refresh cached analysis
    await this.getOrRunAnalysis(true);
    return summary;
  }

  /**
   * Returns current status and metadata of active repository.
   */
  async getStatus() {
    const repo = this.store.getOrCreateRepository(this.rootPath);
    const metrics = this.store.getRepoMetrics(repo.id);

    return {
      repoId: repo.id,
      name: repo.name,
      rootPath: this.rootPath,
      lastIndexedAt: repo.last_indexed_at,
      metrics
    };
  }

  /**
   * Returns discovered files and hierarchical directory tree.
   */
  async getFiles() {
    const { scanResult, stats } = await this.getOrRunAnalysis();

    // Build directory tree
    const tree = { name: path.basename(this.rootPath), type: 'directory', children: {} };

    for (const f of scanResult.files) {
      const parts = f.relativePath.split('/');
      let curr = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (isFile) {
          curr.children[part] = {
            name: part,
            type: 'file',
            path: f.relativePath,
            language: f.language,
            lineCount: f.lineCount,
            sizeBytes: f.sizeBytes
          };
        } else {
          if (!curr.children[part]) {
            curr.children[part] = {
              name: part,
              type: 'directory',
              children: {}
            };
          }
          curr = curr.children[part];
        }
      }
    }

    return {
      files: scanResult.files,
      stats,
      tree
    };
  }

  /**
   * Reads file content safely from disk with line-by-line annotations.
   *
   * @param {string} relativePath
   */
  async getFileContent(relativePath) {
    const fullPath = path.resolve(this.rootPath, relativePath);

    if (!isSafePath(this.rootPath, fullPath)) {
      throw new Error(`Access denied: path escapes repository root`);
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new Error(`File not found: ${relativePath}`);
    }

    const content = await fs.promises.readFile(fullPath, 'utf8');
    const lines = content.split(/\r\n|\r|\n/);

    // Get symbols for this file if available in DB
    const repo = this.store.getOrCreateRepository(this.rootPath);
    const symbols = this.store.searchSymbols(repo.id, '', { filePattern: relativePath });

    return {
      relativePath: normalizePath(relativePath),
      lineCount: lines.length,
      content,
      symbols
    };
  }

  /**
   * Returns React Flow graph representation.
   */
  async getGraph() {
    const { graph, cycles } = await this.getOrRunAnalysis();
    const flowData = graph.toReactFlow();

    return {
      ...flowData,
      externalPackages: Array.from(graph.externalPackages.keys()),
      cycles: cycles || []
    };
  }

  /**
   * Computes change impact blast radius for a file.
   *
   * @param {string} relativePath
   */
  async getImpact(relativePath) {
    const { graph } = await this.getOrRunAnalysis();
    return graph.getImpactRadius(relativePath);
  }

  /**
   * Searches symbols in SQLite.
   *
   * @param {string} query
   * @param {Object} [options]
   */
  searchSymbols(query, options = {}) {
    const repo = this.store.getOrCreateRepository(this.rootPath);
    const searcher = new SymbolSearch(this.store);
    return searcher.search(repo.id, query, options);
  }

  /**
   * Searches code text across scanned files.
   *
   * @param {string} query
   * @param {Object} [options]
   */
  async searchCode(query, options = {}) {
    const { scanResult } = await this.getOrRunAnalysis();
    const relativePaths = scanResult.files.map((f) => f.relativePath);
    const searcher = new CodeSearch(this.rootPath);

    return searcher.search(relativePaths, query, options);
  }

  /**
   * Asks a source-grounded question about the repository.
   *
   * @param {string} question
   */
  async askQuestion(question) {
    const repo = this.store.getOrCreateRepository(this.rootPath);
    const storedFiles = this.store.getStoredFiles(repo.id);

    // If repo hasn't been indexed into SQLite yet, run incremental indexing
    if (storedFiles.size === 0) {
      await this.runIncrementalIndex();
    }

    const { scanResult } = await this.getOrRunAnalysis();
    const availableFiles = scanResult.files.map((f) => f.relativePath);

    const qa = new CodebaseQA({
      store: this.store,
      rootPath: this.rootPath,
      repoId: repo.id
    });

    return qa.ask(question, availableFiles);
  }

  /**
   * Closes database on shutdown.
   */
  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
    }
  }
}
