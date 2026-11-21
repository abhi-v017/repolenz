/**
 * AST Parser Engine for RepoMap
 *
 * Wraps web-tree-sitter (WASM) to provide cross-platform, fast, error-tolerant
 * parsing for JavaScript, TypeScript, and Python without native C++ compilation dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import Parser from 'web-tree-sitter';
import { getFileExtension } from '../utils/path-utils.js';

/**
 * Mapping from file extension to Tree-sitter grammar identifier.
 * @type {Record<string, string>}
 */
const EXTENSION_TO_GRAMMAR = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python'
};

export class CodeParser {
  constructor() {
    /** @type {boolean} */
    this.isInitialized = false;

    /** @type {Map<string, any>} Grammar name -> Tree-sitter Language instance */
    this.languages = new Map();

    /** @type {Parser|null} */
    this.parser = null;

    /** @type {string} */
    this.wasmDirPath = this._findWasmDirectory();
  }

  /**
   * Resolves the path to the directory containing precompiled .wasm grammars.
   * Looks inside node_modules/tree-sitter-wasms/out.
   * @private
   */
  _findWasmDirectory() {
    const candidates = [
      path.resolve(process.cwd(), 'node_modules/tree-sitter-wasms/out'),
      path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../node_modules/tree-sitter-wasms/out')
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }

    return path.resolve(process.cwd(), 'node_modules/tree-sitter-wasms/out');
  }

  /**
   * Initializes the WebAssembly Tree-sitter runtime.
   * Must be called once before parsing.
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    await Parser.init();
    this.parser = new Parser();
    this.isInitialized = true;
  }

  /**
   * Loads and caches a specific language grammar WASM.
   *
   * @param {string} grammarName - 'javascript', 'typescript', 'tsx', 'python'
   * @returns {Promise<any>} Tree-sitter Language instance
   */
  async loadLanguage(grammarName) {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.languages.has(grammarName)) {
      return this.languages.get(grammarName);
    }

    const wasmFile = `tree-sitter-${grammarName}.wasm`;
    const wasmPath = path.join(this.wasmDirPath, wasmFile);

    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Grammar WASM not found for language "${grammarName}" at: ${wasmPath}`);
    }

    try {
      const language = await Parser.Language.load(wasmPath);
      this.languages.set(grammarName, language);
      return language;
    } catch (err) {
      throw new Error(`Failed to load Tree-sitter language "${grammarName}": ${err.message}`);
    }
  }

  /**
   * Resolves grammar identifier from either language name or file extension.
   *
   * @param {string} langOrExt - E.g. "javascript", ".tsx", "file.ts"
   * @returns {string} Grammar name (e.g., "javascript", "typescript", "tsx", "python")
   */
  resolveGrammar(langOrExt) {
    if (!langOrExt) return 'javascript';

    const lower = langOrExt.toLowerCase();

    // Check direct grammar name
    if (['javascript', 'typescript', 'tsx', 'python'].includes(lower)) {
      return lower;
    }

    // Check extension
    const ext = lower.startsWith('.') ? lower : getFileExtension(lower);
    return EXTENSION_TO_GRAMMAR[ext] || 'javascript';
  }

  /**
   * Parses source code string into an Abstract Syntax Tree.
   *
   * @param {string} sourceCode - Source code content
   * @param {string} [langOrExt='javascript'] - Language name or file extension
   * @returns {Promise<{ tree: any, rootNode: any, hasErrors: boolean, language: string }>}
   */
  async parse(sourceCode, langOrExt = 'javascript') {
    if (!this.isInitialized) {
      await this.init();
    }

    const grammar = this.resolveGrammar(langOrExt);
    const language = await this.loadLanguage(grammar);

    this.parser.setLanguage(language);
    const tree = this.parser.parse(sourceCode || '');
    const rootNode = tree.rootNode;

    // Check if the tree contains syntax errors (ERROR or MISSING nodes)
    const hasErrors = rootNode.hasError();

    return {
      tree,
      rootNode,
      hasErrors,
      language: grammar
    };
  }

  /**
   * Parses a file directly from the filesystem.
   *
   * @param {string} filePath - Path to file
   * @returns {Promise<{ tree: any, rootNode: any, hasErrors: boolean, language: string, content: string }>}
   */
  async parseFile(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const ext = path.extname(filePath);
    const result = await this.parse(content, ext);

    return {
      ...result,
      content
    };
  }
}
