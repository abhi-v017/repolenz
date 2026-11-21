/**
 * Symbol Search Engine for RepoMap
 *
 * Fast, indexed symbol lookup across repository codebase.
 */

export class SymbolSearch {
  /**
   * @param {import('../storage/repository-store.js').RepositoryStore} store
   */
  constructor(store) {
    this.store = store;
  }

  /**
   * Searches symbols in a given repository.
   *
   * @param {string} repoId - Repository ID
   * @param {string} [query=''] - Search term
   * @param {Object} [options]
   * @param {'function'|'class'|'method'|'interface'|'type'|'variable'} [options.kind] - Filter by symbol kind
   * @param {boolean} [options.isExported] - Filter only exported symbols
   * @param {string} [options.filePattern] - Filter by relative file path pattern
   * @param {number} [options.limit=50] - Result limit
   * @returns {Array<{
   *   id: string,
   *   name: string,
   *   kind: string,
   *   parent_symbol_name: string|null,
   *   relative_path: string,
   *   language: string,
   *   start_line: number,
   *   start_col: number,
   *   end_line: number,
   *   end_col: number,
   *   is_exported: boolean,
   *   super_class: string|null,
   *   parameters: string[]
   * }>}
   */
  search(repoId, query = '', options = {}) {
    return this.store.searchSymbols(repoId, query.trim(), options);
  }
}
