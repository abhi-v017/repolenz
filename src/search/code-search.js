/**
 * Text & Regex Code Search Engine for RepoMap
 *
 * Scans files on disk to find code matches with line numbers and surrounding context.
 */

import fs from 'node:fs';
import path from 'node:path';
import { normalizePath, getFileExtension } from '../utils/path-utils.js';

/**
 * @typedef {Object} SearchMatch
 * @property {string} filePath - Normalized relative path
 * @property {number} lineNumber - 1-indexed line number
 * @property {string} lineContent - Full matching line content
 * @property {number} matchIndex - Column index of match start
 * @property {number} matchLength - Length of matched substring
 * @property {string[]} contextLines - Up to 2 lines before and after match
 */

export class CodeSearch {
  /**
   * @param {string} rootPath - Absolute repository root path
   */
  constructor(rootPath) {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * Searches for a text pattern or regular expression across an array of files.
   *
   * @param {string[]} relativeFiles - List of relative file paths to search
   * @param {string} query - Text or regex string
   * @param {Object} [options]
   * @param {boolean} [options.isRegex=false] - Treat query as regex
   * @param {boolean} [options.caseSensitive=false] - Case sensitive search
   * @param {string[]} [options.extensions] - Filter extensions, e.g. ['.js', '.ts']
   * @param {number} [options.maxMatches=100] - Cutoff limit
   * @returns {Promise<SearchMatch[]>}
   */
  async search(relativeFiles, query, options = {}) {
    if (!query || query.length === 0) return [];

    const isRegex = options.isRegex || false;
    const caseSensitive = options.caseSensitive || false;
    const maxMatches = options.maxMatches || 100;
    const allowedExts = options.extensions
      ? new Set(options.extensions.map((e) => e.toLowerCase()))
      : null;

    let regex;
    try {
      if (isRegex) {
        regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } else {
        // Escape special regex characters for plain text substring match
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
      }
    } catch (err) {
      throw new Error(`Invalid search pattern: ${err.message}`);
    }

    const matches = [];

    for (const relFile of relativeFiles) {
      if (matches.length >= maxMatches) break;

      if (allowedExts && !allowedExts.has(getFileExtension(relFile))) {
        continue;
      }

      const fullPath = path.join(this.rootPath, relFile);
      let content;
      try {
        content = await fs.promises.readFile(fullPath, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split(/\r\n|\r|\n/);

      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= maxMatches) break;

        const line = lines[i];
        regex.lastIndex = 0;
        const match = regex.exec(line);

        if (match) {
          // Collect context (1 line before, 1 line after)
          const contextStart = Math.max(0, i - 1);
          const contextEnd = Math.min(lines.length - 1, i + 1);
          const contextLines = lines.slice(contextStart, contextEnd + 1);

          matches.push({
            filePath: normalizePath(relFile),
            lineNumber: i + 1,
            lineContent: line.trimEnd(),
            matchIndex: match.index,
            matchLength: match[0].length,
            contextLines
          });
        }
      }
    }

    return matches;
  }
}
