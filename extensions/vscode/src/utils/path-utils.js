/**
 * Path Utilities for RepoMap
 * Provides cross-platform, consistent POSIX-style path handling.
 */

import path from 'node:path';

/**
 * Mapping of supported file extensions to canonical language identifiers.
 * @type {Record<string, string>}
 */
export const SUPPORTED_EXTENSIONS = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.py': 'python'
};

/**
 * Normalizes any filesystem path into a canonical POSIX-style path with forward slashes.
 * Resolves dot segments and collapses multiple slashes.
 *
 * @param {string} filePath - Path to normalize
 * @returns {string} Normalized POSIX-style path
 */
export function normalizePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }

  // Replace Windows backslashes with forward slashes
  let normalized = filePath.replace(/\\/g, '/');

  // Strip trailing slashes unless it's the root (e.g. "/" or "C:/")
  if (normalized.length > 1 && normalized.endsWith('/') && !/^[A-Za-z]:\/$/.test(normalized)) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Computes a normalized relative path from a repository root to a target path.
 * The returned path uses forward slashes and never has a leading slash.
 *
 * @param {string} rootPath - Absolute path to repository root
 * @param {string} targetPath - Absolute or relative path to file/directory
 * @returns {string} Normalized relative path (e.g., "src/core/scanner.js")
 */
export function toRelativePath(rootPath, targetPath) {
  const normRoot = path.resolve(rootPath);
  const normTarget = path.resolve(targetPath);
  const rel = path.relative(normRoot, normTarget);
  return normalizePath(rel);
}

/**
 * Validates that a target path resides within the root path to prevent path traversal attacks.
 *
 * @param {string} rootPath - Absolute path to repository root
 * @param {string} targetPath - Target path to validate
 * @returns {boolean} True if targetPath is safely inside rootPath
 */
export function isSafePath(rootPath, targetPath) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);

  // An exact match is allowed (the root itself)
  if (resolvedRoot === resolvedTarget) {
    return true;
  }

  // Target must start with root + path separator
  const rootWithSep = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;

  return resolvedTarget.startsWith(rootWithSep);
}

/**
 * Extracts the file extension in lowercase.
 *
 * @param {string} filePath - Path to file
 * @returns {string} Lowercase extension including dot (e.g., ".jsx"), or "" if none
 */
export function getFileExtension(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }
  return path.extname(filePath).toLowerCase();
}

/**
 * Detects the language associated with a file path based on its extension.
 *
 * @param {string} filePath - Path to file
 * @returns {string|null} Canonical language name (e.g., 'javascript', 'typescript') or null
 */
export function getLanguageFromExtension(filePath) {
  const ext = getFileExtension(filePath);
  return SUPPORTED_EXTENSIONS[ext] || null;
}

/**
 * Checks if a file has a supported source-code extension.
 *
 * @param {string} filePath - Path to file
 * @returns {boolean} True if supported
 */
export function isSupportedSourceFile(filePath) {
  return getLanguageFromExtension(filePath) !== null;
}
