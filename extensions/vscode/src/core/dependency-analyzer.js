/**
 * Dependency Analyzer and Module Resolver for RepoMap
 *
 * Resolves raw import specifiers (ESM, CommonJS, dynamic imports, re-exports)
 * into canonical local repository file paths or external package references.
 */

import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { normalizePath, toRelativePath } from '../utils/path-utils.js';

/**
 * Pre-populated set of Node.js built-in modules (both bare and node: prefixed).
 * @type {Set<string>}
 */
const BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`)
]);

/**
 * Candidate extensions to test when resolving extensionless imports.
 */
const RESOLUTION_EXTENSIONS = [
  '',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.mjs',
  '.cjs',
  '.py'
];

/**
 * @typedef {Object} ResolvedDependency
 * @property {string} sourceFile - Normalized relative path of importing file
 * @property {string} rawSpecifier - Original specifier string in code
 * @property {string|null} targetFile - Normalized relative path of resolved file, or null if external
 * @property {boolean} isExternal - True if external npm package or built-in
 * @property {boolean} isBuiltin - True if Node.js standard library
 * @property {boolean} isResolved - True if target was successfully resolved on disk
 * @property {string} sourceType - 'esm_import' | 'cjs_require' | 'dynamic_import' | 'export_from'
 * @property {string[]} importedSymbols - Names of imported symbols
 * @property {number} line - 1-indexed line number in source file
 */

export class DependencyAnalyzer {
  /**
   * @param {string} rootPath - Absolute path to repository root
   * @param {Set<string>} [knownFiles] - Set of known normalized relative paths in the repo
   */
  constructor(rootPath, knownFiles = new Set()) {
    this.rootPath = path.resolve(rootPath);
    this.knownFiles = knownFiles;
  }

  /**
   * Determines if a specifier is a relative or absolute local filesystem import.
   *
   * @param {string} specifier - E.g. "./utils", "../core/parser.js", "express"
   * @returns {boolean} True if relative local path
   */
  isRelativeImport(specifier) {
    if (!specifier || typeof specifier !== 'string') return false;
    return specifier.startsWith('./') || specifier.startsWith('../') || specifier === '.' || specifier === '..';
  }

  /**
   * Checks if a specifier is a Node.js standard library module.
   *
   * @param {string} specifier
   * @returns {boolean}
   */
  isBuiltinModule(specifier) {
    if (!specifier) return false;
    return BUILTINS.has(specifier);
  }

  /**
   * Resolves a single import specifier from a source file into a local repository path
   * or marks it as an external package / built-in.
   *
   * @param {string} sourceRelativePath - Normalized relative path of the file containing the import
   * @param {import('./symbol-extractor.js').ImportDeclaration} importDecl - Extracted import metadata
   * @returns {ResolvedDependency}
   */
  resolveImport(sourceRelativePath, importDecl) {
    const rawSpecifier = importDecl.rawSpecifier;
    const normSource = normalizePath(sourceRelativePath);

    // 1. Check for Node.js built-in module
    if (this.isBuiltinModule(rawSpecifier)) {
      return {
        sourceFile: normSource,
        rawSpecifier,
        targetFile: null,
        isExternal: true,
        isBuiltin: true,
        isResolved: true,
        sourceType: importDecl.sourceType,
        importedSymbols: importDecl.importedSymbols,
        line: importDecl.line
      };
    }

    // 2. Check for external npm package (non-relative)
    if (!this.isRelativeImport(rawSpecifier)) {
      return {
        sourceFile: normSource,
        rawSpecifier,
        targetFile: null,
        isExternal: true,
        isBuiltin: false,
        isResolved: true,
        sourceType: importDecl.sourceType,
        importedSymbols: importDecl.importedSymbols,
        line: importDecl.line
      };
    }

    // 3. Resolve relative local file
    const sourceDir = path.dirname(path.join(this.rootPath, normSource));
    const basePath = path.resolve(sourceDir, rawSpecifier);

    const resolvedTarget = this._resolveFilePath(basePath);

    if (resolvedTarget) {
      const relTarget = normalizePath(toRelativePath(this.rootPath, resolvedTarget));
      return {
        sourceFile: normSource,
        rawSpecifier,
        targetFile: relTarget,
        isExternal: false,
        isBuiltin: false,
        isResolved: true,
        sourceType: importDecl.sourceType,
        importedSymbols: importDecl.importedSymbols,
        line: importDecl.line
      };
    }

    // 4. Local import could not be resolved on disk (broken import, dynamic, or unindexed file)
    return {
      sourceFile: normSource,
      rawSpecifier,
      targetFile: null,
      isExternal: false,
      isBuiltin: false,
      isResolved: false,
      sourceType: importDecl.sourceType,
      importedSymbols: importDecl.importedSymbols,
      line: importDecl.line
    };
  }

  /**
   * Helper that tests candidates for file paths, extensions, and directory index files.
   *
   * @param {string} basePath - Candidate absolute base path
   * @returns {string|null} Absolute resolved path, or null if not found
   * @private
   */
  _resolveFilePath(basePath) {
    // 1. Check direct path + extension candidates
    for (const ext of RESOLUTION_EXTENSIONS) {
      const candidate = basePath + ext;
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // ignore I/O errors and continue
      }
    }

    // 2. Check if candidate is a directory containing an index file
    try {
      if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
        for (const ext of RESOLUTION_EXTENSIONS.filter(Boolean)) {
          const indexCandidate = path.join(basePath, `index${ext}`);
          if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
            return indexCandidate;
          }
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * Batch resolves all imports across all scanned files.
   *
   * @param {Array<{ filePath: string, imports: import('./symbol-extractor.js').ImportDeclaration[] }>} filesWithImports
   * @returns {ResolvedDependency[]}
   */
  resolveAll(filesWithImports) {
    const results = [];
    for (const item of filesWithImports) {
      for (const imp of item.imports) {
        results.push(this.resolveImport(item.filePath, imp));
      }
    }
    return results;
  }
}
