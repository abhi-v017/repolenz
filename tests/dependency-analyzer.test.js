import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { DependencyAnalyzer } from '../src/core/dependency-analyzer.js';

describe('DependencyAnalyzer', () => {
  const rootPath = path.resolve('tests/fixtures/sample-repo');
  const analyzer = new DependencyAnalyzer(rootPath);

  describe('Module Categorization', () => {
    it('should identify Node.js built-ins with or without node: prefix', () => {
      expect(analyzer.isBuiltinModule('node:fs')).toBe(true);
      expect(analyzer.isBuiltinModule('fs')).toBe(true);
      expect(analyzer.isBuiltinModule('path')).toBe(true);
      expect(analyzer.isBuiltinModule('crypto')).toBe(true);
      expect(analyzer.isBuiltinModule('express')).toBe(false);
    });

    it('should distinguish relative imports from package specifiers', () => {
      expect(analyzer.isRelativeImport('./utils')).toBe(true);
      expect(analyzer.isRelativeImport('../core/parser.js')).toBe(true);
      expect(analyzer.isRelativeImport('express')).toBe(false);
      expect(analyzer.isRelativeImport('@scope/pkg')).toBe(false);
    });
  });

  describe('Import Resolution', () => {
    it('should resolve relative imports with explicit extensions', () => {
      const resolved = analyzer.resolveImport('src/app.js', {
        rawSpecifier: './services/userService.ts',
        sourceType: 'esm_import',
        importedSymbols: ['UserService'],
        line: 2
      });

      expect(resolved.isExternal).toBe(false);
      expect(resolved.isResolved).toBe(true);
      expect(resolved.targetFile).toBe('src/services/userService.ts');
    });

    it('should resolve relative imports without file extensions', () => {
      const resolved = analyzer.resolveImport('src/app.js', {
        rawSpecifier: './services/userService',
        sourceType: 'esm_import',
        importedSymbols: ['UserService'],
        line: 2
      });

      expect(resolved.isResolved).toBe(true);
      expect(resolved.targetFile).toBe('src/services/userService.ts');
    });

    it('should mark external npm packages as external', () => {
      const resolved = analyzer.resolveImport('src/app.js', {
        rawSpecifier: 'express',
        sourceType: 'esm_import',
        importedSymbols: ['express'],
        line: 1
      });

      expect(resolved.isExternal).toBe(true);
      expect(resolved.isBuiltin).toBe(false);
      expect(resolved.targetFile).toBe(null);
    });

    it('should mark Node.js built-ins as built-in', () => {
      const resolved = analyzer.resolveImport('src/app.js', {
        rawSpecifier: 'node:path',
        sourceType: 'esm_import',
        importedSymbols: ['join'],
        line: 1
      });

      expect(resolved.isExternal).toBe(true);
      expect(resolved.isBuiltin).toBe(true);
    });

    it('should handle non-existent relative targets gracefully as unresolved', () => {
      const resolved = analyzer.resolveImport('src/app.js', {
        rawSpecifier: './does_not_exist',
        sourceType: 'esm_import',
        importedSymbols: ['foo'],
        line: 5
      });

      expect(resolved.isExternal).toBe(false);
      expect(resolved.isResolved).toBe(false);
      expect(resolved.targetFile).toBe(null);
    });
  });
});
