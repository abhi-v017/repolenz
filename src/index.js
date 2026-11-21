#!/usr/bin/env node

/**
 * RepoMap CLI & Core Entry Point
 *
 * Runs repository discovery, AST parsing, symbol extraction,
 * dependency resolution, incremental indexing, and code search.
 */

import path from 'node:path';
import { RepositoryScanner } from './core/repository-scanner.js';
import { StatsCollector } from './core/stats-collector.js';
import { CodeParser } from './core/parser.js';
import { SymbolExtractor } from './core/symbol-extractor.js';
import { DependencyAnalyzer } from './core/dependency-analyzer.js';
import { DependencyGraph } from './core/graph-builder.js';
import { Database } from './storage/database.js';
import { RepositoryStore } from './storage/repository-store.js';
import { IncrementalIndexer } from './core/indexer.js';
import { SymbolSearch } from './search/symbol-search.js';
import { CodeSearch } from './search/code-search.js';
import { normalizePath } from './utils/path-utils.js';

/**
 * Default local SQLite database file path.
 */
export const DEFAULT_DB_PATH = '.repomap/repomap.db';

/**
 * Programmatic API to scan and analyze a repository directory.
 */
export async function analyzeRepository(targetDir, options = {}) {
  const scanner = new RepositoryScanner(options);
  const scanResult = await scanner.scan(targetDir);
  const stats = StatsCollector.collect(scanResult.files);

  let analysis = undefined;
  let graph = undefined;
  let cycles = undefined;

  const shouldParse = options.extractSymbols || options.buildGraph;

  if (shouldParse) {
    const parser = new CodeParser();
    await parser.init();

    const allSymbols = [];
    const allImports = [];
    const allExports = [];
    const allCalls = [];
    const fileImportsMap = [];

    for (const file of scanResult.files) {
      try {
        const { rootNode } = await parser.parseFile(file.path);
        const extracted = SymbolExtractor.extract(rootNode, file.relativePath);

        allSymbols.push(...extracted.symbols);
        allImports.push(...extracted.imports);
        allExports.push(...extracted.exports);
        allCalls.push(...extracted.calls);

        fileImportsMap.push({
          file,
          symbols: extracted.symbols,
          imports: extracted.imports
        });
      } catch (err) {
        console.warn(`[RepoMap] Could not parse ${file.relativePath}: ${err.message}`);
      }
    }

    analysis = {
      symbols: allSymbols,
      imports: allImports,
      exports: allExports,
      calls: allCalls
    };

    if (options.buildGraph) {
      const knownFilePaths = new Set(scanResult.files.map((f) => f.relativePath));
      const analyzer = new DependencyAnalyzer(scanResult.rootPath, knownFilePaths);
      graph = new DependencyGraph();

      for (const item of fileImportsMap) {
        graph.addNode(item.file, item.symbols.length);
      }

      for (const item of fileImportsMap) {
        for (const imp of item.imports) {
          const resolved = analyzer.resolveImport(item.file.relativePath, imp);
          graph.addEdge(resolved);
        }
      }

      cycles = graph.findCircularDependencies();
    }
  }

  return { scanResult, stats, analysis, graph, cycles };
}

/**
 * Indexes repository incrementally and saves to SQLite.
 *
 * @param {string} targetDir
 * @param {string} [dbPath]
 * @returns {Promise<import('./core/indexer.js').IndexingSummary>}
 */
export async function indexRepository(targetDir, dbPath = DEFAULT_DB_PATH) {
  const resolvedDir = path.resolve(targetDir);
  const db = new Database(path.resolve(resolvedDir, dbPath));
  const store = new RepositoryStore(db);
  const indexer = new IncrementalIndexer(db, store);

  try {
    const summary = await indexer.index(resolvedDir);
    return summary;
  } finally {
    db.close();
  }
}

/**
 * Searches symbols in SQLite database.
 */
export function searchRepositorySymbols(targetDir, query, options = {}, dbPath = DEFAULT_DB_PATH) {
  const resolvedDir = path.resolve(targetDir);
  const db = new Database(path.resolve(resolvedDir, dbPath));
  const store = new RepositoryStore(db);
  const searchEngine = new SymbolSearch(store);

  try {
    const repo = store.getOrCreateRepository(resolvedDir);
    return searchEngine.search(repo.id, query, options);
  } finally {
    db.close();
  }
}

/**
 * Prints CLI report
 */
function printCliReport(rootPath, scanResult, stats, analysis, graph, cycles, impact) {
  const divider = '─'.repeat(64);
  const doubleDivider = '═'.repeat(64);

  console.log('\n' + doubleDivider);
  console.log('   🧭 REPOMAP — Codebase Intelligence & Navigation');
  console.log(doubleDivider);
  console.log(` Target Path : ${rootPath}`);
  console.log(` Scan Time   : ${scanResult.durationMs}ms`);
  console.log(divider);

  console.log(' 📊 REPOSITORY OVERVIEW');
  console.log(` • Source Files Indexed : ${stats.totalFiles.toLocaleString()}`);
  console.log(` • Total Lines of Code  : ${stats.totalLinesOfCode.toLocaleString()} LOC`);
  console.log(` • Average Lines / File : ${stats.averageLinesPerFile} LOC`);
  console.log(` • Total Codebase Size  : ${stats.formattedTotalSize}`);
  console.log(` • Files Skipped        : ${scanResult.skippedFiles.length} (ignored/binary/oversized)`);
  console.log(` • Folders Skipped      : ${scanResult.skippedDirectories.length} (node_modules, .git, etc.)`);
  console.log(divider);

  console.log(' 💻 LANGUAGE BREAKDOWN');
  const langEntries = Object.entries(stats.languages);
  if (langEntries.length === 0) {
    console.log('   (No supported source files found)');
  } else {
    for (const [lang, data] of langEntries) {
      const name = lang.padEnd(14, ' ');
      const filesStr = `${data.filesCount} files (${data.percentageFiles}%)`.padEnd(20, ' ');
      const locStr = `${data.linesOfCode.toLocaleString()} LOC (${data.percentageLines}%)`.padEnd(20, ' ');
      console.log(` • ${name} ${filesStr} ${locStr}`);
    }
  }

  if (analysis) {
    console.log(divider);
    console.log(' 🔍 CODE INTELLIGENCE & SYMBOLS (AST)');
    console.log(` • Total Symbols Extracted : ${analysis.symbols.length}`);
    console.log(` • Total Import Statements : ${analysis.imports.length}`);
    console.log(` • Total Exported Symbols  : ${analysis.exports.length}`);
    console.log(` • Total Function Calls    : ${analysis.calls.length}`);

    const kindCounts = {};
    for (const s of analysis.symbols) {
      kindCounts[s.kind] = (kindCounts[s.kind] || 0) + 1;
    }

    const kindBreakdown = Object.entries(kindCounts)
      .map(([k, c]) => `${c} ${k === 'class' ? (c > 1 ? 'classes' : 'class') : `${k}${c > 1 ? 's' : ''}`}`)
      .join(', ');
    if (kindBreakdown) {
      console.log(` • Breakdown: ${kindBreakdown}`);
    }
  }

  if (graph) {
    console.log(divider);
    console.log(' 🕸️  DEPENDENCY GRAPH');
    let totalInternalEdges = 0;
    for (const map of graph.outgoing.values()) {
      totalInternalEdges += map.size;
    }
    console.log(` • File Nodes in Graph   : ${graph.nodes.size}`);
    console.log(` • Internal Import Edges : ${totalInternalEdges}`);
    console.log(` • External Packages     : ${graph.externalPackages.size}`);
    if (graph.externalPackages.size > 0) {
      const pkgs = Array.from(graph.externalPackages.keys()).sort().join(', ');
      console.log(`   └─ ${pkgs}`);
    }

    if (cycles) {
      if (cycles.length === 0) {
        console.log(` • Circular Dependencies : None detected ✅ (Clean DAG)`);
      } else {
        console.log(` • ⚠️  Circular Cycles   : ${cycles.length} detected:`);
        cycles.forEach((cycle, idx) => {
          console.log(`    ${idx + 1}. ${cycle.join(' ➔ ')}`);
        });
      }
    }
  }

  if (impact) {
    console.log(divider);
    console.log(` 💥 CHANGE IMPACT ANALYSIS for "${impact.targetFile}"`);
    console.log(` • Total Affected Files  : ${impact.totalImpacted}`);
    console.log(` • Maximum Blast Radius  : Depth ${impact.maxDepth}`);
    if (impact.impactedFiles.length > 0) {
      console.log(' • Potentially Affected Downstream Modules:');
      impact.impactedFiles.forEach((item) => {
        const depthBadge = `[Depth ${item.depth}]`.padEnd(10, ' ');
        console.log(`    ${depthBadge} ${item.file} (imported via ${item.importedBy.join(', ')})`);
      });
    } else {
      console.log('   (No other internal files depend on this file)');
    }
  }

  console.log(divider);
  console.log(' 📁 TOP 5 LARGEST FILES (BY LINES OF CODE)');
  if (stats.largestFilesByLines.length === 0) {
    console.log('   (None)');
  } else {
    stats.largestFilesByLines.forEach((file, index) => {
      const rank = `${index + 1}.`.padEnd(3, ' ');
      const lines = `${file.lineCount.toLocaleString()} LOC`.padStart(10, ' ');
      console.log(` ${rank} ${lines}  ${file.relativePath}`);
    });
  }

  console.log(doubleDivider + '\n');
}

/**
 * CLI execution handler
 */
async function runCli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (args.includes('--help') || args.includes('-h') || command === 'help') {
    console.log(`
RepoLenz — Codebase Intelligence Platform

Usage:
  npx repolenz                           Launch interactive web dashboard and open browser
  repolenz ui [path]                     Launch interactive web UI for specific path
  repolenz scan [path] [options]         Scan and analyze codebase in terminal
  repolenz index [path]                  Incrementally index repository into SQLite (.repolenz/repolenz.db)
  repolenz search <query> [options]      Search indexed symbols in SQLite
  repolenz grep <query> [options]        Search source code text
  repolenz ask "<question>"              Ask a source-grounded question about codebase

Options for Analysis:
  --symbols, -s         Extract AST symbols, imports, and calls
  --graph, -g           Build dependency graph & detect cycles
  --cycles, -c          Detect circular dependency cycles
  --impact <file>       Run change impact analysis
  --json                Output results as JSON

Options for Search:
  --kind <kind>         Filter by function, class, method, interface
  --exported            Filter only exported symbols
  --file <pattern>      Filter by file path pattern
  --regex               Treat search query as regular expression
`);
    process.exit(0);
  }

  // Default action when running "npx repolenz" with no arguments or "repolenz ui":
  if (!command || command === 'ui') {
    const targetDir = command === 'ui' && args[1] && !args[1].startsWith('-') ? args[1] : process.cwd();
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

    console.log(`\n🗺️  RepoLenz — Codebase Intelligence Platform`);
    console.log(`🚀 Starting web dashboard on http://localhost:${port}`);
    console.log(`📂 Analyzing repository: ${path.resolve(targetDir)}...\n`);

    const { startServer } = await import('./server/app.js');
    await startServer(port, targetDir);

    // Auto-open browser
    const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    import('node:child_process').then(({ exec }) => {
      exec(`${startCmd} http://localhost:${port}`).catch(() => {});
    });
    return;
  }

  // Subcommand: index
  if (command === 'index') {
    const targetDir = args[1] && !args[1].startsWith('-') ? args[1] : process.cwd();
    console.log(`\n📦 Indexing repository: ${path.resolve(targetDir)}...`);
    try {
      const summary = await indexRepository(targetDir);
      console.log(`\n✅ Indexing complete in ${summary.durationMs}ms:`);
      console.log(` • Total Files Tracked : ${summary.totalFiles}`);
      console.log(` • Newly Added Files   : ${summary.addedCount}`);
      console.log(` • Re-indexed Files    : ${summary.modifiedCount}`);
      console.log(` • Unchanged Files     : ${summary.unchangedCount} (0ms parse skip)`);
      console.log(` • Removed Files       : ${summary.deletedCount}\n`);
    } catch (err) {
      console.error(`\n❌ Indexing failed: ${err.message}\n`);
      process.exit(1);
    }
    return;
  }

  // Subcommand: search (symbols)
  if (command === 'search') {
    let query = '';
    if (args[1] && !args[1].startsWith('-')) {
      query = args[1];
    }
    const kindIdx = args.indexOf('--kind');
    const kind = kindIdx !== -1 ? args[kindIdx + 1] : undefined;
    const isExported = args.includes('--exported') ? true : undefined;
    const fileIdx = args.indexOf('--file');
    const filePattern = fileIdx !== -1 ? args[fileIdx + 1] : undefined;

    try {
      const results = searchRepositorySymbols(process.cwd(), query, {
        kind,
        isExported,
        filePattern
      });

      console.log(`\n🔍 Found ${results.length} symbol${results.length === 1 ? '' : 's'} matching "${query}":\n`);
      for (const s of results) {
        const badge = `[${s.kind}]`.padEnd(12, ' ');
        const exportBadge = s.is_exported ? '⭐ exported' : '           ';
        const loc = `${s.relative_path}:${s.start_line}:${s.start_col}`;
        console.log(` • ${badge} ${s.name.padEnd(25, ' ')} ${exportBadge} -> ${loc}`);
      }
      console.log();
    } catch (err) {
      console.error(`\n❌ Search failed (make sure to run "repomap index" first): ${err.message}\n`);
      process.exit(1);
    }
    return;
  }

  // Subcommand: grep (code text)
  if (command === 'grep') {
    const query = args[1] || '';
    const isRegex = args.includes('--regex');
    const scanner = new RepositoryScanner();
    const scanResult = await scanner.scan(process.cwd());
    const files = scanResult.files.map((f) => f.relativePath);

    const searcher = new CodeSearch(process.cwd());
    const matches = await searcher.search(files, query, { isRegex });

    console.log(`\n🔎 Found ${matches.length} code match${matches.length === 1 ? '' : 'es'} for "${query}":\n`);
    for (const m of matches) {
      console.log(`  ${m.filePath}:${m.lineNumber}`);
      console.log(`    ${m.lineContent.trim()}`);
    }
    console.log();
    return;
  }

  // Subcommand: ask (source-grounded Q&A)
  if (command === 'ask') {
    const question = args.slice(1).join(' ');
    if (!question) {
      console.log('\nUsage: repomap ask "<your question>"\n');
      process.exit(1);
    }

    const { RepositoryService } = await import('./server/services/repository-service.js');
    const service = new RepositoryService(process.cwd());

    try {
      console.log(`\n🤔 Question: "${question}"`);
      const result = await service.askQuestion(question);
      console.log('\n💬 Answer:');
      console.log(result.answer);

      if (result.citations && result.citations.length > 0) {
        console.log('\n📚 Verified Source Citations:');
        for (const c of result.citations) {
          console.log(` • ${c.filePath}:${c.line} ${c.symbol ? `(${c.symbol})` : ''}`);
        }
      }
      console.log(`\n(Retrieved & verified in ${result.durationMs}ms)\n`);
    } catch (err) {
      console.error(`\n❌ Q&A failed: ${err.message}\n`);
      process.exit(1);
    } finally {
      service.close();
    }
    return;
  }

  // Subcommand: scan or fallback directory analysis
  let targetDir = process.cwd();
  if (command === 'scan') {
    targetDir = args[1] && !args[1].startsWith('-') ? args[1] : process.cwd();
  } else if (command && !command.startsWith('-')) {
    targetDir = command;
  }
  const isJson = args.includes('--json');
  const skipHash = args.includes('--no-hash');
  const extractSymbols = args.includes('--symbols') || args.includes('-s');
  const buildGraph = args.includes('--graph') || args.includes('-g') || args.includes('--cycles') || args.includes('-c') || args.includes('--impact');

  let impactFile = null;
  const impactIdx = args.indexOf('--impact');
  if (impactIdx !== -1 && args[impactIdx + 1] && !args[impactIdx + 1].startsWith('-')) {
    impactFile = args[impactIdx + 1];
  }

  try {
    const { scanResult, stats, analysis, graph, cycles } = await analyzeRepository(targetDir, {
      computeHashes: !skipHash,
      extractSymbols: extractSymbols || buildGraph,
      buildGraph
    });

    let impact = null;
    if (graph && impactFile) {
      impact = graph.getImpactRadius(impactFile);
    }

    if (isJson) {
      console.log(JSON.stringify({
        scanResult,
        stats,
        analysis,
        graph: graph ? graph.toReactFlow() : undefined,
        cycles,
        impact
      }, null, 2));
    } else {
      printCliReport(scanResult.rootPath, scanResult, stats, analysis, graph, cycles, impact);
    }
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exit(1);
  }
}

// Run CLI when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  runCli();
}
