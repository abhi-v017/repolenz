/**
 * Directed Dependency Graph Builder for RepoMap
 *
 * Constructs and queries the repository dependency graph:
 * 1. File-level directed graph with incoming and outgoing adjacencies.
 * 2. Circular dependency cycle detection using 3-color DFS.
 * 3. Change Impact Analysis (blast radius traversal).
 * 4. React Flow graph serialization.
 */

import { normalizePath } from '../utils/path-utils.js';

/**
 * @typedef {Object} GraphNode
 * @property {string} id - Normalized relative file path
 * @property {string} label - File basename
 * @property {string} path - Normalized relative file path
 * @property {string} language - Canonical language name
 * @property {number} lineCount - Total lines of code
 * @property {number} sizeBytes - Size in bytes
 * @property {number} symbolCount - Number of extracted symbols
 */

/**
 * @typedef {Object} GraphEdge
 * @property {string} id - Edge ID (e.g., "src/app.js->src/auth.js")
 * @property {string} source - Source file relative path
 * @property {string} target - Target file relative path
 * @property {string} sourceType - 'esm_import' | 'cjs_require' | 'dynamic_import' | 'export_from'
 * @property {string[]} importedSymbols - Imported symbol names
 * @property {number[]} lines - Line numbers of imports
 */

/**
 * @typedef {Object} ImpactResult
 * @property {string} targetFile - Changed file path
 * @property {number} totalImpacted - Total dependent files affected
 * @property {number} maxDepth - Max dependency depth reached
 * @property {Array<{ file: string, depth: number, importedBy: string[] }>} impactedFiles - All affected files
 */

export class DependencyGraph {
  constructor() {
    /** @type {Map<string, GraphNode>} Node ID -> Node Data */
    this.nodes = new Map();

    /** @type {Map<string, Map<string, GraphEdge>>} Outgoing: source -> (target -> edge) */
    this.outgoing = new Map();

    /** @type {Map<string, Map<string, GraphEdge>>} Incoming: target -> (source -> edge) */
    this.incoming = new Map();

    /** @type {Map<string, Set<string>>} External Package -> Set of importing files */
    this.externalPackages = new Map();
  }

  /**
   * Adds or updates a file node in the graph.
   *
   * @param {Object} file - File descriptor or path
   * @param {string} file.relativePath - Relative file path
   * @param {string} [file.name] - File name
   * @param {string} [file.language] - Language name
   * @param {number} [file.lineCount=0] - Lines of code
   * @param {number} [file.sizeBytes=0] - Size in bytes
   * @param {number} [symbolCount=0] - Extracted symbol count
   */
  addNode(file, symbolCount = 0) {
    const id = normalizePath(file.relativePath || file.path);
    const label = file.name || id.split('/').pop();

    this.nodes.set(id, {
      id,
      label,
      path: id,
      language: file.language || 'unknown',
      lineCount: file.lineCount || 0,
      sizeBytes: file.sizeBytes || 0,
      symbolCount
    });

    if (!this.outgoing.has(id)) {
      this.outgoing.set(id, new Map());
    }
    if (!this.incoming.has(id)) {
      this.incoming.set(id, new Map());
    }
  }

  /**
   * Adds a resolved dependency edge into the graph.
   *
   * @param {import('./dependency-analyzer.js').ResolvedDependency} dep
   */
  addEdge(dep) {
    const source = normalizePath(dep.sourceFile);

    // Track external package references
    if (dep.isExternal) {
      if (!this.externalPackages.has(dep.rawSpecifier)) {
        this.externalPackages.set(dep.rawSpecifier, new Set());
      }
      this.externalPackages.get(dep.rawSpecifier).add(source);
      return;
    }

    // Skip unresolvable or self-referential edges
    if (!dep.isResolved || !dep.targetFile || dep.targetFile === source) {
      return;
    }

    const target = normalizePath(dep.targetFile);

    // Ensure nodes exist in adjacency maps
    if (!this.outgoing.has(source)) this.outgoing.set(source, new Map());
    if (!this.outgoing.has(target)) this.outgoing.set(target, new Map());
    if (!this.incoming.has(source)) this.incoming.set(source, new Map());
    if (!this.incoming.has(target)) this.incoming.set(target, new Map());

    const edgeId = `${source}->${target}`;
    const existingEdge = this.outgoing.get(source).get(target);

    if (existingEdge) {
      // Merge imported symbols and lines
      for (const sym of dep.importedSymbols) {
        if (!existingEdge.importedSymbols.includes(sym)) {
          existingEdge.importedSymbols.push(sym);
        }
      }
      if (dep.line && !existingEdge.lines.includes(dep.line)) {
        existingEdge.lines.push(dep.line);
      }
    } else {
      const edge = {
        id: edgeId,
        source,
        target,
        sourceType: dep.sourceType,
        importedSymbols: [...dep.importedSymbols],
        lines: dep.line ? [dep.line] : []
      };

      this.outgoing.get(source).set(target, edge);
      this.incoming.get(target).set(source, edge);
    }
  }

  /**
   * Returns outgoing dependencies for a file (what does this file import?).
   *
   * @param {string} fileId
   * @returns {GraphEdge[]}
   */
  getDependencies(fileId) {
    const id = normalizePath(fileId);
    const targetMap = this.outgoing.get(id);
    return targetMap ? Array.from(targetMap.values()) : [];
  }

  /**
   * Returns incoming dependents for a file (what files import this file?).
   *
   * @param {string} fileId
   * @returns {GraphEdge[]}
   */
  getDependents(fileId) {
    const id = normalizePath(fileId);
    const sourceMap = this.incoming.get(id);
    return sourceMap ? Array.from(sourceMap.values()) : [];
  }

  /**
   * Detects circular dependency cycles using Depth-First Search with 3-color marking.
   *
   * Color 0 = Unvisited (WHITE)
   * Color 1 = Currently Visiting / in call stack (GRAY)
   * Color 2 = Completely Visited (BLACK)
   *
   * @returns {string[][]} Array of cycle paths, e.g. [['a.js', 'b.js', 'a.js']]
   */
  findCircularDependencies() {
    const colors = new Map();
    const parentMap = new Map();
    const cycles = [];
    const visitedCycles = new Set();

    for (const nodeId of this.nodes.keys()) {
      colors.set(nodeId, 0);
    }

    const dfs = (u, stack) => {
      colors.set(u, 1); // Gray
      stack.push(u);

      const targets = this.outgoing.get(u);
      if (targets) {
        for (const v of targets.keys()) {
          const color = colors.get(v) || 0;

          if (color === 1) {
            // Cycle detected! Back-edge from u to v
            const cycleStartIndex = stack.indexOf(v);
            if (cycleStartIndex !== -1) {
              const cyclePath = stack.slice(cycleStartIndex);
              cyclePath.push(v); // Close cycle loop

              // Canonicalize cycle key to avoid duplicate rotations
              const baseNodes = cyclePath.slice(0, -1);
              const minIndex = baseNodes.indexOf([...baseNodes].sort()[0]);
              const canonical = [
                ...baseNodes.slice(minIndex),
                ...baseNodes.slice(0, minIndex),
                baseNodes[minIndex]
              ].join('->');

              if (!visitedCycles.has(canonical)) {
                visitedCycles.add(canonical);
                cycles.push(cyclePath);
              }
            }
          } else if (color === 0) {
            dfs(v, stack);
          }
        }
      }

      stack.pop();
      colors.set(u, 2); // Black
    };

    for (const nodeId of this.nodes.keys()) {
      if ((colors.get(nodeId) || 0) === 0) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  /**
   * Computes change impact analysis (blast radius) for a given file.
   * Traverses incoming edges (dependents) up to maxDepth.
   *
   * @param {string} fileId - The file being modified
   * @param {number} [maxDepth=10] - Maximum traversal depth
   * @returns {ImpactResult}
   */
  getImpactRadius(fileId, maxDepth = 10) {
    const startId = normalizePath(fileId);
    const visited = new Map(); // fileId -> depth
    const importedByMap = new Map(); // fileId -> Set of direct files that import it

    // Queue for BFS: [currentFileId, currentDepth]
    const queue = [[startId, 0]];
    visited.set(startId, 0);

    let maxDepthReached = 0;

    while (queue.length > 0) {
      const [current, depth] = queue.shift();
      if (depth >= maxDepth) continue;

      const incomingEdges = this.incoming.get(current);
      if (!incomingEdges) continue;

      for (const sourceId of incomingEdges.keys()) {
        if (!importedByMap.has(sourceId)) {
          importedByMap.set(sourceId, new Set());
        }
        importedByMap.get(sourceId).add(current);

        if (!visited.has(sourceId)) {
          const nextDepth = depth + 1;
          visited.set(sourceId, nextDepth);
          if (nextDepth > maxDepthReached) {
            maxDepthReached = nextDepth;
          }
          queue.push([sourceId, nextDepth]);
        }
      }
    }

    // Prepare sorted list of affected files (excluding the root target itself)
    const impactedFiles = [];
    for (const [file, depth] of visited.entries()) {
      if (file !== startId) {
        impactedFiles.push({
          file,
          depth,
          importedBy: Array.from(importedByMap.get(file) || [])
        });
      }
    }

    // Sort by depth (closest first), then alphabetically
    impactedFiles.sort((a, b) => a.depth - b.depth || a.file.localeCompare(b.file));

    return {
      targetFile: startId,
      totalImpacted: impactedFiles.length,
      maxDepth: maxDepthReached,
      impactedFiles
    };
  }

  /**
   * Serializes the graph into a React Flow-compatible `{ nodes, edges }` format.
   * Computes a structured grid layout so nodes do not overlap.
   *
   * @returns {{ nodes: any[], edges: any[] }}
   */
  toReactFlow() {
    const nodes = [];
    const edges = [];

    // Simple multi-column grid layout computation
    const nodeIds = Array.from(this.nodes.keys());
    const columnCount = Math.max(1, Math.ceil(Math.sqrt(nodeIds.length)));
    const X_SPACING = 280;
    const Y_SPACING = 120;

    nodeIds.forEach((id, index) => {
      const node = this.nodes.get(id);
      const col = index % columnCount;
      const row = Math.floor(index / columnCount);

      nodes.push({
        id: node.id,
        type: 'default',
        position: {
          x: col * X_SPACING,
          y: row * Y_SPACING
        },
        data: {
          label: node.label,
          path: node.path,
          language: node.language,
          lineCount: node.lineCount,
          symbolCount: node.symbolCount
        }
      });
    });

    for (const sourceMap of this.outgoing.values()) {
      for (const edge of sourceMap.values()) {
        edges.push({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.importedSymbols.length > 0
            ? edge.importedSymbols.slice(0, 3).join(', ') + (edge.importedSymbols.length > 3 ? '...' : '')
            : 'imports',
          animated: edge.sourceType === 'dynamic_import',
          data: {
            sourceType: edge.sourceType,
            importedSymbols: edge.importedSymbols,
            lines: edge.lines
          }
        });
      }
    }

    return { nodes, edges };
  }
}
