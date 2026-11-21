import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { RepositoryScanner } from '../src/core/repository-scanner.js';

describe('RepositoryScanner', () => {
  const fixturePath = path.resolve('tests/fixtures/sample-repo');

  it('should scan fixture repository, indexing valid source files and ignoring irrelevant files', async () => {
    const scanner = new RepositoryScanner();
    const result = await scanner.scan(fixturePath);

    expect(result.files.length).toBe(3); // app.js, userService.ts, metrics.py

    const filePaths = result.files.map((f) => f.relativePath).sort();
    expect(filePaths).toEqual([
      'scripts/metrics.py',
      'src/app.js',
      'src/services/userService.ts'
    ]);

    // Check that node_modules was skipped at the directory level
    expect(result.skippedDirectories).toContain('node_modules');

    // Check that ignored files were captured in skippedFiles
    const skippedNames = result.skippedFiles.map((s) => s.relativePath);
    expect(skippedNames).toContain('.env');
    expect(skippedNames).toContain('package-lock.json');

    // Verify file descriptor properties
    const appFile = result.files.find((f) => f.relativePath === 'src/app.js');
    expect(appFile).toBeDefined();
    expect(appFile.language).toBe('javascript');
    expect(appFile.lineCount).toBeGreaterThan(0);
    expect(appFile.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(appFile.sizeBytes).toBeGreaterThan(0);
  });

  it('should throw an informative error when path does not exist', async () => {
    const scanner = new RepositoryScanner();
    await expect(scanner.scan('non-existent-directory-xyz')).rejects.toThrow(
      /Repository path does not exist/
    );
  });
});
