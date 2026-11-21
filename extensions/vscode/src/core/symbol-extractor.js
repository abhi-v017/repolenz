/**
 * Code Symbol & Relationship Extractor for RepoMap
 *
 * Traverses Tree-sitter AST nodes to extract:
 * 1. Functions & Methods (declarations, expressions, arrows, async/generators).
 * 2. Classes & Interfaces (declarations, inheritance, methods).
 * 3. Imports (ESM default/named/namespace, CommonJS require, dynamic imports).
 * 4. Exports (named, default, re-exports).
 * 5. Call Expressions (associated with caller context for dependency graphing).
 */

import { normalizePath } from '../utils/path-utils.js';

/**
 * @typedef {Object} CodeSymbol
 * @property {string} id - Unique identifier (e.g., "src/auth.js:function:login:24")
 * @property {string} name - Symbol name
 * @property {'function'|'class'|'method'|'interface'|'type'|'variable'} kind - Symbol type
 * @property {string} filePath - Normalized relative file path
 * @property {{ line: number, column: number }} startPosition - 1-indexed start location
 * @property {{ line: number, column: number }} endPosition - 1-indexed end location
 * @property {boolean} isExported - Whether the symbol is exported
 * @property {boolean} [isAsync] - Whether the function is asynchronous
 * @property {boolean} [isStatic] - Whether the method is static
 * @property {string[]} [parameters] - Function/method parameter names
 * @property {string} [parentSymbolName] - Enclosing class or function name
 * @property {string} [superClass] - Parent class name for classes that extend another
 */

/**
 * @typedef {Object} ImportDeclaration
 * @property {string} rawSpecifier - Import path (e.g., "./auth.js" or "express")
 * @property {'esm_import'|'cjs_require'|'dynamic_import'|'export_from'} sourceType - Import mechanism
 * @property {string[]} importedSymbols - Names of imported entities
 * @property {string|null} defaultImport - Default import identifier name
 * @property {string|null} namespaceImport - Namespace alias (e.g., "path" from `import * as path`)
 * @property {number} line - 1-indexed line number
 */

/**
 * @typedef {Object} ExportDeclaration
 * @property {string} name - Exported symbol name or "default"
 * @property {'named'|'default'|'all'} exportType - Export kind
 * @property {string|null} localName - Local identifier if renamed (e.g. `export { a as b }`)
 * @property {string|null} sourceSpecifier - Module path if re-exporting (`export ... from '...'`)
 * @property {number} line - 1-indexed line number
 */

/**
 * @typedef {Object} CallReference
 * @property {string} calleeName - Invoked function or method expression (e.g. "login" or "service.login")
 * @property {string} callerSymbolName - Name of enclosing function/method, or "<top-level>"
 * @property {number} line - 1-indexed line number
 */

export class SymbolExtractor {
  /**
   * Extracts symbols, imports, exports, and call references from a parsed AST.
   *
   * @param {any} rootNode - Tree-sitter root AST node
   * @param {string} [filePath=''] - Normalized relative path of the file
   * @returns {{
   *   symbols: CodeSymbol[],
   *   imports: ImportDeclaration[],
   *   exports: ExportDeclaration[],
   *   calls: CallReference[]
   * }}
   */
  static extract(rootNode, filePath = '') {
    const normalizedFilePath = normalizePath(filePath);

    /** @type {CodeSymbol[]} */
    const symbols = [];
    /** @type {ImportDeclaration[]} */
    const imports = [];
    /** @type {ExportDeclaration[]} */
    const exports = [];
    /** @type {CallReference[]} */
    const calls = [];

    // Context stacks for tracking parent scopes during traversal
    const scopeStack = [];

    /**
     * Retrieves the current enclosing symbol name from the scope stack.
     * @returns {string} Enclosing symbol name or "<top-level>"
     */
    const getCurrentCaller = () => {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        const item = scopeStack[i];
        if (item.kind === 'function' || item.kind === 'method') {
          return item.name;
        }
      }
      return '<top-level>';
    };

    /**
     * Extracts parameter names from formal_parameters node.
     * @param {any} paramNode
     * @returns {string[]}
     */
    const extractParameters = (paramNode) => {
      if (!paramNode) return [];
      const params = [];
      for (let i = 0; i < paramNode.namedChildCount; i++) {
        const child = paramNode.namedChild(i);
        if (child.type === 'identifier') {
          params.push(child.text);
        } else if (child.type === 'required_parameter' || child.type === 'optional_parameter') {
          const idChild = child.children.find((c) => c.type === 'identifier');
          if (idChild) params.push(idChild.text);
        } else if (child.type === 'assignment_pattern') {
          const left = child.namedChild(0);
          if (left && left.type === 'identifier') params.push(left.text);
        } else if (child.type === 'rest_pattern') {
          const inner = child.namedChild(0);
          if (inner && inner.type === 'identifier') params.push(`...${inner.text}`);
        }
      }
      return params;
    };

    /**
     * Creates a unique deterministic ID for a symbol.
     */
    const createSymbolId = (kind, name, line) => {
      return `${normalizedFilePath}:${kind}:${name}:${line}`;
    };

    /**
     * Checks if an AST node is directly inside an export statement.
     * @param {any} node
     * @returns {{ isExported: boolean, isDefault: boolean }}
     */
    const checkExportContext = (node) => {
      const parent = node.parent;
      if (!parent) return { isExported: false, isDefault: false };

      if (parent.type === 'export_statement') {
        const isDefault = parent.children.some((c) => c.type === 'default');
        return { isExported: true, isDefault };
      }

      // Check grandparent for lexical declaration inside export: `export const foo = () => {}`
      if (parent.type === 'variable_declarator' && parent.parent && parent.parent.parent && parent.parent.parent.type === 'export_statement') {
        return { isExported: true, isDefault: false };
      }

      return { isExported: false, isDefault: false };
    };

    /**
     * Recursive AST visitor
     * @param {any} node
     */
    const visit = (node) => {
      if (!node) return;

      const line = node.startPosition.row + 1;
      const column = node.startPosition.column + 1;
      const endLine = node.endPosition.row + 1;
      const endColumn = node.endPosition.column + 1;

      // ──────────────────────────────────────────────────────────
      // 1. IMPORT STATEMENTS (ESM)
      // ──────────────────────────────────────────────────────────
      if (node.type === 'import_statement') {
        let rawSpecifier = '';
        let defaultImport = null;
        let namespaceImport = null;
        const importedSymbols = [];

        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);

          if (child.type === 'string') {
            rawSpecifier = child.text.replace(/['"`]/g, '');
          } else if (child.type === 'import_clause') {
            for (let j = 0; j < child.namedChildCount; j++) {
              const clauseChild = child.namedChild(j);

              if (clauseChild.type === 'identifier') {
                defaultImport = clauseChild.text;
                importedSymbols.push(defaultImport);
              } else if (clauseChild.type === 'namespace_import') {
                const idNode = clauseChild.children.find((c) => c.type === 'identifier');
                if (idNode) {
                  namespaceImport = idNode.text;
                  importedSymbols.push(namespaceImport);
                }
              } else if (clauseChild.type === 'named_imports') {
                for (let k = 0; k < clauseChild.namedChildCount; k++) {
                  const spec = clauseChild.namedChild(k);
                  if (spec.type === 'import_specifier') {
                    const nameNode = spec.namedChild(spec.namedChildCount - 1);
                    if (nameNode) importedSymbols.push(nameNode.text);
                  }
                }
              }
            }
          }
        }

        if (rawSpecifier) {
          imports.push({
            rawSpecifier,
            sourceType: 'esm_import',
            importedSymbols,
            defaultImport,
            namespaceImport,
            line
          });
        }
      }

      // ──────────────────────────────────────────────────────────
      // 2. COMMONJS REQUIRE & DYNAMIC IMPORTS
      // ──────────────────────────────────────────────────────────
      if (node.type === 'call_expression') {
        const callee = node.namedChild(0);

        // Check for require('...')
        if (callee && callee.type === 'identifier' && callee.text === 'require') {
          const arg = node.namedChild(1);
          if (arg && arg.type === 'arguments') {
            const firstArg = arg.namedChild(0);
            if (firstArg && firstArg.type === 'string') {
              const specifier = firstArg.text.replace(/['"`]/g, '');
              const importedSymbols = [];

              // Check if assigned in `const { a, b } = require('...')` or `const x = require('...')`
              if (node.parent && node.parent.type === 'variable_declarator') {
                const nameNode = node.parent.namedChild(0);
                if (nameNode) {
                  if (nameNode.type === 'identifier') {
                    importedSymbols.push(nameNode.text);
                  } else if (nameNode.type === 'object_pattern') {
                    for (let p = 0; p < nameNode.namedChildCount; p++) {
                      const prop = nameNode.namedChild(p);
                      if (prop.type === 'shorthand_property_identifier_pattern') {
                        importedSymbols.push(prop.text);
                      } else if (prop.type === 'pair_pattern') {
                        const val = prop.namedChild(1);
                        if (val) importedSymbols.push(val.text);
                      }
                    }
                  }
                }
              }

              imports.push({
                rawSpecifier: specifier,
                sourceType: 'cjs_require',
                importedSymbols,
                defaultImport: importedSymbols[0] || null,
                namespaceImport: null,
                line
              });
            }
          }
        }

        // Check for dynamic import('...')
        if (callee && (callee.type === 'import' || callee.text === 'import')) {
          const arg = node.namedChild(1);
          if (arg && arg.type === 'arguments') {
            const firstArg = arg.namedChild(0);
            if (firstArg && firstArg.type === 'string') {
              imports.push({
                rawSpecifier: firstArg.text.replace(/['"`]/g, ''),
                sourceType: 'dynamic_import',
                importedSymbols: ['*'],
                defaultImport: null,
                namespaceImport: null,
                line
              });
            }
          }
        }

        // Record generic function call reference
        let calleeName = '';
        if (callee) {
          if (callee.type === 'identifier') {
            calleeName = callee.text;
          } else if (callee.type === 'member_expression') {
            calleeName = callee.text;
          }
        }

        if (calleeName && calleeName !== 'require' && calleeName !== 'import') {
          calls.push({
            calleeName,
            callerSymbolName: getCurrentCaller(),
            line
          });
        }
      }

      // ──────────────────────────────────────────────────────────
      // 3. EXPORT STATEMENTS
      // ──────────────────────────────────────────────────────────
      if (node.type === 'export_statement') {
        const isDefault = node.children.some((c) => c.type === 'default');

        // Check for direct declaration exports: `export class X {}`, `export function y() {}`, `export const z = 1`
        const decl = node.namedChild(0);
        if (decl && !isDefault) {
          if (decl.type === 'class_declaration' || decl.type === 'function_declaration') {
            const nameChild = decl.children.find((c) => c.type === 'identifier' || c.type === 'type_identifier');
            if (nameChild) {
              exports.push({
                name: nameChild.text,
                exportType: 'named',
                localName: nameChild.text,
                sourceSpecifier: null,
                line
              });
            }
          } else if (decl.type === 'lexical_declaration' || decl.type === 'variable_declaration') {
            for (let v = 0; v < decl.namedChildCount; v++) {
              const declarator = decl.namedChild(v);
              if (declarator.type === 'variable_declarator') {
                const idChild = declarator.namedChild(0);
                if (idChild && idChild.type === 'identifier') {
                  exports.push({
                    name: idChild.text,
                    exportType: 'named',
                    localName: idChild.text,
                    sourceSpecifier: null,
                    line
                  });
                }
              }
            }
          } else if (decl.type === 'interface_declaration' || decl.type === 'type_alias_declaration') {
            const nameChild = decl.children.find((c) => c.type === 'type_identifier');
            if (nameChild) {
              exports.push({
                name: nameChild.text,
                exportType: 'named',
                localName: nameChild.text,
                sourceSpecifier: null,
                line
              });
            }
          }
        }

        // Check for re-export: `export { x } from './y'` or `export * from './y'`
        const sourceNode = node.children.find((c) => c.type === 'string');
        const sourceSpecifier = sourceNode ? sourceNode.text.replace(/['"`]/g, '') : null;

        if (sourceSpecifier) {
          const exportAll = node.children.some((c) => c.type === '*' || c.text === '*');
          if (exportAll) {
            exports.push({
              name: '*',
              exportType: 'all',
              localName: null,
              sourceSpecifier,
              line
            });
          }
        }

        // Standalone export clause: `export { a, b as c }`
        const exportClause = node.children.find((c) => c.type === 'export_clause');
        if (exportClause) {
          for (let s = 0; s < exportClause.namedChildCount; s++) {
            const spec = exportClause.namedChild(s);
            if (spec.type === 'export_specifier') {
              const nameChild = spec.namedChild(0);
              const aliasChild = spec.namedChild(1);
              const exportedName = aliasChild ? aliasChild.text : (nameChild ? nameChild.text : '');
              const localName = nameChild ? nameChild.text : exportedName;

              exports.push({
                name: exportedName,
                exportType: isDefault ? 'default' : 'named',
                localName,
                sourceSpecifier,
                line
              });
            }
          }
        }

        // Export default: `export default App`, `export default class App {}`, `export default function() {}`
        if (isDefault) {
          let defaultName = 'default';
          let localName = null;
          const child = node.namedChild(0);
          if (child) {
            if (child.type === 'identifier') {
              defaultName = child.text;
              localName = child.text;
            } else if (child.type === 'class_declaration' || child.type === 'function_declaration') {
              const nameChild = child.children.find((c) => c.type === 'identifier');
              if (nameChild) {
                defaultName = nameChild.text;
                localName = nameChild.text;
              }
            }
          }

          exports.push({
            name: defaultName,
            exportType: 'default',
            localName,
            sourceSpecifier: null,
            line
          });
        }
      }

      // ──────────────────────────────────────────────────────────
      // 4. FUNCTION DECLARATIONS
      // ──────────────────────────────────────────────────────────
      if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') {
        const nameChild = node.children.find((c) => c.type === 'identifier');
        const name = nameChild ? nameChild.text : '<anonymous>';
        const isAsync = node.children.some((c) => c.type === 'async');
        const paramNode = node.children.find((c) => c.type === 'formal_parameters');
        const { isExported } = checkExportContext(node);

        const sym = {
          id: createSymbolId('function', name, line),
          name,
          kind: 'function',
          filePath: normalizedFilePath,
          startPosition: { line, column },
          endPosition: { line: endLine, column: endColumn },
          isExported,
          isAsync,
          parameters: extractParameters(paramNode)
        };

        symbols.push(sym);
        scopeStack.push(sym);

        // Visit body
        for (let i = 0; i < node.namedChildCount; i++) {
          visit(node.namedChild(i));
        }

        scopeStack.pop();
        return; // Children already visited
      }

      // ──────────────────────────────────────────────────────────
      // 5. VARIABLE DECLARATIONS (ARROW FUNCTIONS & EXPORTED CONSTS)
      // ──────────────────────────────────────────────────────────
      if (node.type === 'variable_declarator') {
        const nameChild = node.namedChild(0);
        const valueChild = node.namedChild(1);

        if (nameChild && nameChild.type === 'identifier' && valueChild) {
          const varName = nameChild.text;
          const { isExported } = checkExportContext(node);

          if (valueChild.type === 'arrow_function' || valueChild.type === 'function_expression') {
            const isAsync = valueChild.children.some((c) => c.type === 'async');
            const paramNode = valueChild.children.find((c) => c.type === 'formal_parameters');

            const sym = {
              id: createSymbolId('function', varName, line),
              name: varName,
              kind: 'function',
              filePath: normalizedFilePath,
              startPosition: { line, column },
              endPosition: { line: endLine, column: endColumn },
              isExported,
              isAsync,
              parameters: extractParameters(paramNode)
            };

            symbols.push(sym);
            scopeStack.push(sym);

            // Visit function body
            for (let i = 0; i < valueChild.namedChildCount; i++) {
              visit(valueChild.namedChild(i));
            }

            scopeStack.pop();
            return;
          } else if (isExported) {
            // Exported variable / constant
            symbols.push({
              id: createSymbolId('variable', varName, line),
              name: varName,
              kind: 'variable',
              filePath: normalizedFilePath,
              startPosition: { line, column },
              endPosition: { line: endLine, column: endColumn },
              isExported: true
            });
          }
        }
      }

      // ──────────────────────────────────────────────────────────
      // 6. CLASS DECLARATIONS & METHODS
      // ──────────────────────────────────────────────────────────
      if (node.type === 'class_declaration') {
        const nameChild = node.children.find((c) => c.type === 'identifier' || c.type === 'type_identifier');
        const className = nameChild ? nameChild.text : '<anonymous_class>';
        const { isExported } = checkExportContext(node);

        // Find extended class (heritage)
        let superClass = undefined;
        const heritage = node.children.find((c) => c.type === 'class_heritage');
        if (heritage) {
          const extendsClause = heritage.children.find((c) => c.type === 'extends_clause');
          if (extendsClause) {
            const superId = extendsClause.children.find((c) => c.type === 'identifier');
            if (superId) superClass = superId.text;
          } else {
            const superId = heritage.children.find((c) => c.type === 'identifier');
            if (superId) superClass = superId.text;
          }
        }

        const classSym = {
          id: createSymbolId('class', className, line),
          name: className,
          kind: 'class',
          filePath: normalizedFilePath,
          startPosition: { line, column },
          endPosition: { line: endLine, column: endColumn },
          isExported,
          superClass
        };

        symbols.push(classSym);
        scopeStack.push(classSym);

        // Visit class body
        const bodyNode = node.children.find((c) => c.type === 'class_body');
        if (bodyNode) {
          for (let m = 0; m < bodyNode.namedChildCount; m++) {
            const member = bodyNode.namedChild(m);

            if (member.type === 'method_definition') {
              const methodNameChild = member.children.find((c) => c.type === 'property_identifier');
              const methodName = methodNameChild ? methodNameChild.text : '<anonymous_method>';
              const isAsync = member.children.some((c) => c.type === 'async');
              const isStatic = member.children.some((c) => c.type === 'static');
              const paramNode = member.children.find((c) => c.type === 'formal_parameters');

              const methodSym = {
                id: createSymbolId('method', `${className}.${methodName}`, member.startPosition.row + 1),
                name: methodName,
                kind: 'method',
                parentSymbolName: className,
                filePath: normalizedFilePath,
                startPosition: { line: member.startPosition.row + 1, column: member.startPosition.column + 1 },
                endPosition: { line: member.endPosition.row + 1, column: member.endPosition.column + 1 },
                isExported: classSym.isExported,
                isAsync,
                isStatic,
                parameters: extractParameters(paramNode)
              };

              symbols.push(methodSym);
              scopeStack.push(methodSym);

              // Visit method body
              for (let i = 0; i < member.namedChildCount; i++) {
                visit(member.namedChild(i));
              }

              scopeStack.pop();
            } else {
              visit(member);
            }
          }
        }

        scopeStack.pop();
        return;
      }

      // ──────────────────────────────────────────────────────────
      // 7. TYPESCRIPT INTERFACES & TYPES
      // ──────────────────────────────────────────────────────────
      if (node.type === 'interface_declaration') {
        const nameChild = node.children.find((c) => c.type === 'type_identifier');
        const interfaceName = nameChild ? nameChild.text : '<interface>';
        const { isExported } = checkExportContext(node);

        symbols.push({
          id: createSymbolId('interface', interfaceName, line),
          name: interfaceName,
          kind: 'interface',
          filePath: normalizedFilePath,
          startPosition: { line, column },
          endPosition: { line: endLine, column: endColumn },
          isExported
        });
      }

      if (node.type === 'type_alias_declaration') {
        const nameChild = node.children.find((c) => c.type === 'type_identifier');
        const typeName = nameChild ? nameChild.text : '<type>';
        const { isExported } = checkExportContext(node);

        symbols.push({
          id: createSymbolId('type', typeName, line),
          name: typeName,
          kind: 'type',
          filePath: normalizedFilePath,
          startPosition: { line, column },
          endPosition: { line: endLine, column: endColumn },
          isExported
        });
      }

      // Default: Visit all children
      for (let i = 0; i < node.namedChildCount; i++) {
        visit(node.namedChild(i));
      }
    };

    visit(rootNode);

    return {
      symbols,
      imports,
      exports,
      calls
    };
  }
}
