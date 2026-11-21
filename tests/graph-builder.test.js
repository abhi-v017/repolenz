import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../src/core/graph-builder.js';

describe('DependencyGraph', () => {
  it('should add nodes and build forward and reverse adjacencies', () => {
    const graph = new DependencyGraph();

    graph.addNode({ relativePath: 'src/app.js', name: 'app.js', language: 'javascript', lineCount: 50 });
    graph.addNode({ relativePath: 'src/auth.js', name: 'auth.js', language: 'javascript', lineCount: 100 });

    graph.addEdge({
      sourceFile: 'src/app.js',
      targetFile: 'src/auth.js',
      rawSpecifier: './auth.js',
      sourceType: 'esm_import',
      importedSymbols: ['login'],
      isExternal: false,
      isResolved: true,
      line: 3
    });

    // Outgoing from app.js
    const appDeps = graph.getDependencies('src/app.js');
    expect(appDeps.length).toBe(1);
    expect(appDeps[0].target).toBe('src/auth.js');
    expect(appDeps[0].importedSymbols).toEqual(['login']);

    // Incoming to auth.js (who depends on auth.js?)
    const authDependents = graph.getDependents('src/auth.js');
    expect(authDependents.length).toBe(1);
    expect(authDependents[0].source).toBe('src/app.js');
  });

  it('should detect circular dependency cycles accurately', () => {
    const graph = new DependencyGraph();

    // Setup cycle: a -> b -> c -> a
    graph.addNode({ relativePath: 'src/a.js' });
    graph.addNode({ relativePath: 'src/b.js' });
    graph.addNode({ relativePath: 'src/c.js' });
    graph.addNode({ relativePath: 'src/d.js' }); // Linear branch

    graph.addEdge({ sourceFile: 'src/a.js', targetFile: 'src/b.js', isResolved: true, importedSymbols: [] });
    graph.addEdge({ sourceFile: 'src/b.js', targetFile: 'src/c.js', isResolved: true, importedSymbols: [] });
    graph.addEdge({ sourceFile: 'src/c.js', targetFile: 'src/a.js', isResolved: true, importedSymbols: [] });
    graph.addEdge({ sourceFile: 'src/d.js', targetFile: 'src/a.js', isResolved: true, importedSymbols: [] });

    const cycles = graph.findCircularDependencies();
    expect(cycles.length).toBe(1);

    const cycle = cycles[0];
    expect(cycle.length).toBe(4); // a -> b -> c -> a
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
  });

  it('should return empty cycles when graph is an acyclic DAG', () => {
    const graph = new DependencyGraph();

    graph.addNode({ relativePath: 'src/a.js' });
    graph.addNode({ relativePath: 'src/b.js' });
    graph.addNode({ relativePath: 'src/c.js' });

    graph.addEdge({ sourceFile: 'src/a.js', targetFile: 'src/b.js', isResolved: true, importedSymbols: [] });
    graph.addEdge({ sourceFile: 'src/b.js', targetFile: 'src/c.js', isResolved: true, importedSymbols: [] });

    const cycles = graph.findCircularDependencies();
    expect(cycles.length).toBe(0);
  });

  it('should compute change impact radius (blast radius)', () => {
    const graph = new DependencyGraph();

    // Architecture:
    // database.js is imported by authService.js
    // authService.js is imported by authController.js
    // authController.js is imported by server.js
    // unrelated.js is not connected

    graph.addNode({ relativePath: 'src/db/database.js' });
    graph.addNode({ relativePath: 'src/services/authService.js' });
    graph.addNode({ relativePath: 'src/controllers/authController.js' });
    graph.addNode({ relativePath: 'src/server.js' });
    graph.addNode({ relativePath: 'src/unrelated.js' });

    graph.addEdge({ sourceFile: 'src/services/authService.js', targetFile: 'src/db/database.js', isResolved: true, importedSymbols: [] });
    graph.addEdge({ sourceFile: 'src/controllers/authController.js', targetFile: 'src/services/authService.js', isResolved: true, importedSymbols: [] });
    graph.addEdge({ sourceFile: 'src/server.js', targetFile: 'src/controllers/authController.js', isResolved: true, importedSymbols: [] });

    // What is the impact if src/db/database.js changes?
    const impact = graph.getImpactRadius('src/db/database.js');

    expect(impact.totalImpacted).toBe(3);
    expect(impact.maxDepth).toBe(3);

    const impactedNames = impact.impactedFiles.map((f) => f.file);
    expect(impactedNames).toEqual([
      'src/services/authService.js',
      'src/controllers/authController.js',
      'src/server.js'
    ]);

    expect(impact.impactedFiles[0].depth).toBe(1);
    expect(impact.impactedFiles[1].depth).toBe(2);
    expect(impact.impactedFiles[2].depth).toBe(3);
  });

  it('should serialize to React Flow format', () => {
    const graph = new DependencyGraph();

    graph.addNode({ relativePath: 'src/a.js', name: 'a.js', language: 'javascript', lineCount: 20 });
    graph.addNode({ relativePath: 'src/b.js', name: 'b.js', language: 'javascript', lineCount: 40 });

    graph.addEdge({
      sourceFile: 'src/a.js',
      targetFile: 'src/b.js',
      sourceType: 'esm_import',
      importedSymbols: ['foo'],
      isResolved: true
    });

    const flowData = graph.toReactFlow();

    expect(flowData.nodes.length).toBe(2);
    expect(flowData.edges.length).toBe(1);

    expect(flowData.nodes[0]).toHaveProperty('id');
    expect(flowData.nodes[0]).toHaveProperty('position');
    expect(flowData.nodes[0].data).toHaveProperty('label');

    expect(flowData.edges[0]).toHaveProperty('source', 'src/a.js');
    expect(flowData.edges[0]).toHaveProperty('target', 'src/b.js');
    expect(flowData.edges[0].label).toBe('foo');
  });
});
