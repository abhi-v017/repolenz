import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { CodeSearch } from '../src/search/code-search.js';

describe('CodeSearch', () => {
  const rootPath = path.resolve('tests/fixtures/sample-repo');
  const codeSearch = new CodeSearch(rootPath);
  const files = [
    'src/app.js',
    'src/services/userService.ts',
    'scripts/metrics.py'
  ];

  it('should find text matches with line numbers and snippet context', async () => {
    const matches = await codeSearch.search(files, 'UserService');

    expect(matches.length).toBe(3); // 2 in app.js, 1 in userService.ts

    const appMatches = matches.filter((m) => m.filePath === 'src/app.js');
    expect(appMatches.length).toBe(2);
    expect(appMatches[0].lineNumber).toBeGreaterThan(0);
    expect(appMatches[0].lineContent).toContain('UserService');
    expect(appMatches[0].contextLines.length).toBeGreaterThanOrEqual(2);

    const tsMatch = matches.find((m) => m.filePath === 'src/services/userService.ts');
    expect(tsMatch).toBeDefined();
    expect(tsMatch.lineContent).toContain('export class UserService');
  });

  it('should support regex pattern searching', async () => {
    const matches = await codeSearch.search(files, 'def calculate_[a-z]+', {
      isRegex: true
    });

    expect(matches.length).toBe(1);
    expect(matches[0].filePath).toBe('scripts/metrics.py');
    expect(matches[0].lineContent).toContain('def calculate_metrics');
  });

  it('should filter by file extensions', async () => {
    const matches = await codeSearch.search(files, 'function', {
      extensions: ['.js']
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.filePath.endsWith('.js'))).toBe(true);
  });

  it('should return empty array for non-matching queries', async () => {
    const matches = await codeSearch.search(files, 'completely_unknown_token_xyz');
    expect(matches.length).toBe(0);
  });
});
