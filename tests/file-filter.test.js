import { describe, it, expect } from 'vitest';
import { FileFilter } from '../src/core/file-filter.js';

describe('FileFilter', () => {
  it('should ignore default internal and dependency directories', () => {
    const filter = new FileFilter();

    expect(filter.shouldIgnoreDirectory('node_modules', 'node_modules')).toBe(true);
    expect(filter.shouldIgnoreDirectory('.git', '.git')).toBe(true);
    expect(filter.shouldIgnoreDirectory('dist', 'dist')).toBe(true);
    expect(filter.shouldIgnoreDirectory('.repomap', '.repomap')).toBe(true);
    expect(filter.shouldIgnoreDirectory('src', 'src')).toBe(false);
  });

  it('should ignore sensitive secret files and credentials', () => {
    const filter = new FileFilter();

    expect(filter.shouldIgnoreFile('.env', '.env').ignored).toBe(true);
    expect(filter.shouldIgnoreFile('.env.local', '.env.local').ignored).toBe(true);
    expect(filter.shouldIgnoreFile('id_rsa', 'id_rsa').ignored).toBe(true);
    expect(filter.shouldIgnoreFile('server.key', 'certs/server.key').ignored).toBe(true);
  });

  it('should ignore lockfiles and minified bundles', () => {
    const filter = new FileFilter();

    expect(filter.shouldIgnoreFile('package-lock.json', 'package-lock.json').ignored).toBe(true);
    expect(filter.shouldIgnoreFile('app.min.js', 'dist/app.min.js').ignored).toBe(true);
  });

  it('should ignore unsupported file formats', () => {
    const filter = new FileFilter();

    expect(filter.shouldIgnoreFile('image.png', 'assets/image.png').ignored).toBe(true);
    expect(filter.shouldIgnoreFile('styles.css', 'styles.css').ignored).toBe(true);
  });

  it('should allow supported source files', () => {
    const filter = new FileFilter();

    expect(filter.shouldIgnoreFile('index.js', 'src/index.js').ignored).toBe(false);
    expect(filter.shouldIgnoreFile('App.tsx', 'src/App.tsx').ignored).toBe(false);
    expect(filter.shouldIgnoreFile('main.py', 'scripts/main.py').ignored).toBe(false);
  });

  it('should reject files exceeding max file size', () => {
    const filter = new FileFilter({ maxFileSizeBytes: 1000 });

    const normal = filter.shouldIgnoreFile('app.js', 'app.js', 500);
    expect(normal.ignored).toBe(false);

    const oversized = filter.shouldIgnoreFile('huge.js', 'huge.js', 1500);
    expect(oversized.ignored).toBe(true);
    expect(oversized.reason).toContain('Exceeds max file size');
  });
});
