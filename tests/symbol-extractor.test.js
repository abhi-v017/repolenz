import { describe, it, expect, beforeAll } from 'vitest';
import { CodeParser } from '../src/core/parser.js';
import { SymbolExtractor } from '../src/core/symbol-extractor.js';

describe('SymbolExtractor', () => {
  let parser;

  beforeAll(async () => {
    parser = new CodeParser();
    await parser.init();
  });

  describe('Functions and Arrow Functions', () => {
    it('should extract named function declarations with parameters and async flag', async () => {
      const code = `
        export async function loginUser(email, password) {
          return authenticate(email, password);
        }
      `;
      const { rootNode } = await parser.parse(code, 'javascript');
      const { symbols, calls } = SymbolExtractor.extract(rootNode, 'src/auth.js');

      expect(symbols.length).toBe(1);
      const fn = symbols[0];
      expect(fn.name).toBe('loginUser');
      expect(fn.kind).toBe('function');
      expect(fn.isExported).toBe(true);
      expect(fn.isAsync).toBe(true);
      expect(fn.parameters).toEqual(['email', 'password']);
      expect(fn.filePath).toBe('src/auth.js');

      // Check caller tracking on function calls
      expect(calls.length).toBe(1);
      expect(calls[0].calleeName).toBe('authenticate');
      expect(calls[0].callerSymbolName).toBe('loginUser');
    });

    it('should extract arrow functions assigned to variables', async () => {
      const code = `
        const calculateTotal = (price, tax = 0.1) => {
          return price + (price * tax);
        };
      `;
      const { rootNode } = await parser.parse(code, 'javascript');
      const { symbols } = SymbolExtractor.extract(rootNode, 'src/math.js');

      expect(symbols.length).toBe(1);
      const fn = symbols[0];
      expect(fn.name).toBe('calculateTotal');
      expect(fn.kind).toBe('function');
      expect(fn.parameters).toEqual(['price', 'tax']);
    });
  });

  describe('Classes, Methods and Inheritance', () => {
    it('should extract class declaration, superClass, methods and parameters', async () => {
      const code = `
        export class AuthService extends BaseService {
          constructor(config) {
            super(config);
          }

          async validateToken(token) {
            return this.jwt.verify(token);
          }

          static createInstance() {
            return new AuthService();
          }
        }
      `;
      const { rootNode } = await parser.parse(code, 'javascript');
      const { symbols, calls } = SymbolExtractor.extract(rootNode, 'src/services/auth.js');

      const classSym = symbols.find((s) => s.kind === 'class');
      expect(classSym).toBeDefined();
      expect(classSym.name).toBe('AuthService');
      expect(classSym.superClass).toBe('BaseService');
      expect(classSym.isExported).toBe(true);

      const constructorMethod = symbols.find((s) => s.name === 'constructor');
      expect(constructorMethod).toBeDefined();
      expect(constructorMethod.kind).toBe('method');
      expect(constructorMethod.parentSymbolName).toBe('AuthService');
      expect(constructorMethod.parameters).toEqual(['config']);

      const validateMethod = symbols.find((s) => s.name === 'validateToken');
      expect(validateMethod).toBeDefined();
      expect(validateMethod.isAsync).toBe(true);
      expect(validateMethod.parentSymbolName).toBe('AuthService');

      const staticMethod = symbols.find((s) => s.name === 'createInstance');
      expect(staticMethod).toBeDefined();
      expect(staticMethod.isStatic).toBe(true);

      // Verify that this.jwt.verify call is attributed to validateToken
      const verifyCall = calls.find((c) => c.calleeName.includes('verify'));
      expect(verifyCall).toBeDefined();
      expect(verifyCall.callerSymbolName).toBe('validateToken');
    });
  });

  describe('TypeScript Interfaces and Types', () => {
    it('should extract interfaces and type aliases', async () => {
      const code = `
        export interface SessionData {
          userId: string;
          expiresAt: number;
        }

        export type TokenString = string;
      `;
      const { rootNode } = await parser.parse(code, 'typescript');
      const { symbols } = SymbolExtractor.extract(rootNode, 'src/types.ts');

      const iface = symbols.find((s) => s.kind === 'interface');
      expect(iface).toBeDefined();
      expect(iface.name).toBe('SessionData');
      expect(iface.isExported).toBe(true);

      const typeSym = symbols.find((s) => s.kind === 'type');
      expect(typeSym).toBeDefined();
      expect(typeSym.name).toBe('TokenString');
      expect(typeSym.isExported).toBe(true);
    });
  });

  describe('Imports and Exports', () => {
    it('should extract ESM imports: default, named, and namespace', async () => {
      const code = `
        import express from 'express';
        import { get, post as createPost } from 'http';
        import * as path from 'path';
      `;
      const { rootNode } = await parser.parse(code, 'javascript');
      const { imports } = SymbolExtractor.extract(rootNode, 'src/server.js');

      expect(imports.length).toBe(3);

      const defaultImport = imports.find((i) => i.rawSpecifier === 'express');
      expect(defaultImport.sourceType).toBe('esm_import');
      expect(defaultImport.defaultImport).toBe('express');

      const namedImport = imports.find((i) => i.rawSpecifier === 'http');
      expect(namedImport.importedSymbols).toContain('get');
      expect(namedImport.importedSymbols).toContain('createPost');

      const nsImport = imports.find((i) => i.rawSpecifier === 'path');
      expect(nsImport.namespaceImport).toBe('path');
    });

    it('should extract CommonJS require and dynamic imports', async () => {
      const code = `
        const fs = require('fs');
        const { readFile, writeFile } = require('fs/promises');

        async function loadConfig() {
          const config = await import('./config.json');
          return config;
        }
      `;
      const { rootNode } = await parser.parse(code, 'javascript');
      const { imports } = SymbolExtractor.extract(rootNode, 'src/loader.js');

      const cjs1 = imports.find((i) => i.rawSpecifier === 'fs');
      expect(cjs1.sourceType).toBe('cjs_require');
      expect(cjs1.importedSymbols).toContain('fs');

      const cjs2 = imports.find((i) => i.rawSpecifier === 'fs/promises');
      expect(cjs2.sourceType).toBe('cjs_require');
      expect(cjs2.importedSymbols).toContain('readFile');
      expect(cjs2.importedSymbols).toContain('writeFile');

      const dyn = imports.find((i) => i.rawSpecifier === './config.json');
      expect(dyn.sourceType).toBe('dynamic_import');
    });

    it('should extract named, default, and re-exports', async () => {
      const code = `
        const localVal = 42;
        export { localVal as publicVal };
        export default class App {}
        export * from './submodule.js';
      `;
      const { rootNode } = await parser.parse(code, 'javascript');
      const { exports } = SymbolExtractor.extract(rootNode, 'src/index.js');

      const namedExp = exports.find((e) => e.name === 'publicVal');
      expect(namedExp).toBeDefined();
      expect(namedExp.localName).toBe('localVal');

      const defExp = exports.find((e) => e.exportType === 'default');
      expect(defExp).toBeDefined();

      const allExp = exports.find((e) => e.exportType === 'all');
      expect(allExp).toBeDefined();
      expect(allExp.sourceSpecifier).toBe('./submodule.js');
    });
  });
});
