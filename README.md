# RepoLenz — Codebase Intelligence & Navigation Platform

> Understand any codebase. Navigate with confidence.

RepoLenz is an open-source codebase intelligence tool designed to help developers understand, explore, and navigate software repositories visually and semantically.

---

## ⚡ Instant Start (Zero Installation)

Run RepoLenz in any project folder:
```bash
npx repolenz
```
This automatically scans your repository, starts the local dashboard at `http://localhost:3001`, and opens your default browser.

---

## Key Features

- **Interactive Dependency Graph**: Dual-adjacency directed graph rendered with React Flow, cycle detection (DAG validation), and layer filtering.
- **Change Impact Analysis (Blast Radius)**: BFS downstream traversal to show which modules will break before you make changes.
- **Source-Grounded Codebase Q&A**: Answers architectural questions with exact file and line citations extracted via AST.
- **Embedded SQLite Persistence**: Fast relational persistence using Node.js built-in `DatabaseSync` (`node:sqlite`) with 0ms parse skip for unchanged files.
- **Multi-Language AST Parsing**: In-process WebAssembly Tree-sitter for JavaScript, TypeScript, TSX, and Python.
- **100% Offline & Private**: Code never leaves your computer.

---

## Getting Started (Local Development)

### Prerequisites
- Node.js (v22+)
- npm

### Installation
```bash
# Install root & web dependencies
npm install
npm --prefix web install
```

### Run the Web Dashboard
```bash
# Starts backend server and serves UI at http://localhost:3001
npm run dev
```

### Run CLI Tools
```bash
# 1. Quick repository architectural summary
npx repolenz scan

# 2. Dependency graph & circular dependency check
node src/index.js . --graph

# 3. Incremental indexing into SQLite
node src/index.js index .

# 4. Symbol search
node src/index.js search CodeParser --kind class

# 5. Source-grounded Q&A
node src/index.js ask "Where is file filtering implemented?"
```

### Build & Test
```bash
# Run Vitest test suite
npm test

# Build production React web dashboard
npm run build:web
```
