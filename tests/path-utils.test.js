import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  normalizePath,
  toRelativePath,
  isSafePath,
  getFileExtension,
  getLanguageFromExtension,
  isSupportedSourceFile
} from '../src/utils/path-utils.js';

describe('Path Utilities', () => {
  describe('normalizePath', () => {
    it('should convert Windows backslashes to forward slashes', () => {
      expect(normalizePath('src\\core\\scanner.js')).toBe('src/core/scanner.js');
      expect(normalizePath('C:\\Users\\test\\repo')).toBe('C:/Users/test/repo');
    });

    it('should remove trailing slashes except for root drives', () => {
      expect(normalizePath('src/core/')).toBe('src/core');
      expect(normalizePath('C:/')).toBe('C:/');
      expect(normalizePath('/')).toBe('/');
    });

    it('should return empty string for null or non-string input', () => {
      expect(normalizePath(null)).toBe('');
      expect(normalizePath(undefined)).toBe('');
    });
  });

  describe('toRelativePath', () => {
    it('should compute forward-slash relative path without leading slash', () => {
      const root = path.resolve('c:/repo');
      const target = path.resolve('c:/repo/src/index.js');
      expect(toRelativePath(root, target)).toBe('src/index.js');
    });
  });

  describe('isSafePath', () => {
    const root = path.resolve('/var/app');

    it('should return true for files inside root', () => {
      expect(isSafePath(root, path.join(root, 'src', 'index.js'))).toBe(true);
      expect(isSafePath(root, root)).toBe(true);
    });

    it('should return false for paths that escape root', () => {
      expect(isSafePath(root, path.join(root, '..', 'etc', 'passwd'))).toBe(false);
      expect(isSafePath(root, '/other/path')).toBe(false);
    });
  });

  describe('getFileExtension & Language Detection', () => {
    it('should extract lowercase extension', () => {
      expect(getFileExtension('FILE.JSX')).toBe('.jsx');
      expect(getFileExtension('index.ts')).toBe('.ts');
      expect(getFileExtension('no_ext')).toBe('');
    });

    it('should detect languages accurately', () => {
      expect(getLanguageFromExtension('app.js')).toBe('javascript');
      expect(getLanguageFromExtension('comp.tsx')).toBe('typescript');
      expect(getLanguageFromExtension('main.py')).toBe('python');
      expect(getLanguageFromExtension('styles.css')).toBe(null);
    });

    it('should check supported source files', () => {
      expect(isSupportedSourceFile('code.js')).toBe(true);
      expect(isSupportedSourceFile('code.ts')).toBe(true);
      expect(isSupportedSourceFile('code.py')).toBe(true);
      expect(isSupportedSourceFile('image.png')).toBe(false);
      expect(isSupportedSourceFile('data.json')).toBe(false);
    });
  });
});
