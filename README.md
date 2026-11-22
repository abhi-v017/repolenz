# RepoLenz — Codebase Intelligence & Developer Navigation Platform

<p align="center">
  <img src="https://raw.githubusercontent.com/abhi-v017/repolenz/main/extensions/vscode/media/icon.svg" width="96" height="96" alt="RepoLenz Logo" />
</p>

<p align="center">
  <strong>Understand any codebase. Navigate with confidence.</strong><br>
  Interactive dependency graphs, change impact analysis, and AST code intelligence for modern development teams.
</p>

<p align="center">
  <a href="https://repolenz.onrender.com"><img src="https://img.shields.io/badge/Render-Live_Web_App-blue?style=flat-square&logo=render" alt="Render Live Web App"></a>
  <a href="https://www.npmjs.com/package/repolenz"><img src="https://img.shields.io/npm/v/repolenz?style=flat-square&color=purple" alt="npm version"></a>
  <a href="https://github.com/abhi-v017/repolenz"><img src="https://img.shields.io/badge/License-MIT-emerald?style=flat-square" alt="MIT License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-22+-green?style=flat-square&logo=node.js" alt="Node.js 22+"></a>
  <a href="https://marketplace.visualstudio.com"><img src="https://img.shields.io/badge/VS_Code_Extension-Ready-blueviolet?style=flat-square&logo=visual-studio-code" alt="VS Code Extension"></a>
</p>

---

## ⚡ 3 Ways to Use RepoLenz

| Channel | Best For | How to Launch |
| :--- | :--- | :--- |
| 🌐 **Cloud Web App** | Open-source GitHub repos without installing anything | 👉 **[repolenz.onrender.com](https://repolenz.onrender.com)** |
| 💻 **Local CLI Companion** | Private local projects with 100% privacy & zero upload | `npx repolenz` |
| 🧩 **VS Code Extension** | Exploring architecture & impact directly inside your editor | `Ctrl+Shift+P` → `RepoLenz: Open Visual Dependency Map` |

---

## 📸 Visual Showcase

### 1. Interactive Dependency Graph (React Flow)
Explore module connections, cross-folder imports, and architectural tiers with pan, zoom, layer isolation, and DAG cycle detection.

<p align="center">
  <img src="https://res.cloudinary.com/dulfdrdf2/image/upload/v1795326739/web-graph_cdyabp.png" width="100%" alt="RepoLenz Interactive Dependency Graph" />
</p>

---

### 2. Change Impact Analysis (Blast Radius)
Select any function or module to trace downstream dependencies via breadth-first traversal. Identify exactly which files could break *before* you make code changes.

<p align="center">
  <img src="https://res.cloudinary.com/dulfdrdf2/image/upload/v1795326739/web-impact_xos5pm.png" width="100%" alt="RepoLenz Change Impact Analysis" />
</p>

---

### 3. Architecture Overview & Circular Dependency Detection
Detect circular import chains that break bundler tree-shaking and trigger runtime initialization bugs. Monitor lines of code, language breakdown, and repository distribution.

<p align="center">
  <img src="https://res.cloudinary.com/dulfdrdf2/image/upload/v1795326738/web-overview_ujtldj.png" width="100%" alt="RepoLenz Architecture Overview" />
</p>

---

### 4. Seamless In-Editor VS Code Integration
Open RepoLenz directly inside VS Code editor tabs. Click any node in the graph to jump to that file and line in your active editor.

<p align="center">
  <img src="https://res.cloudinary.com/dulfdrdf2/image/upload/v1795326763/vscode-graph_jojpwv.png" width="100%" alt="RepoLenz inside VS Code" />
</p>

<p align="center">
  <img src="https://res.cloudinary.com/dulfdrdf2/image/upload/v1795326762/vscode-commands_lxoate.png" width="60%" alt="RepoLenz Command Palette" />
  &nbsp;&nbsp;
  <img src="https://res.cloudinary.com/dulfdrdf2/image/upload/v1795326761/vscode-button_ijvt7u.png" width="30%" alt="RepoLenz Title Bar Button" />
</p>

---

## 🌟 Core Features

- 🗺️ **Dual-Adjacency Directed Graph**: Tracks both incoming and outgoing dependencies for instantaneous bidirection traversal and cycle detection.
- ⚡ **Downstream Impact Radius**: Calculates cascading change radius with configurable depth limits (Depth 1, Depth 2, Depth 3+).
- 🧬 **Multi-Language WebAssembly AST**: Fast in-process parsing powered by Tree-sitter for JavaScript, TypeScript, TSX, and Python.
- 🗄️ **Embedded SQLite Persistence**: Built on Node.js 22's native `DatabaseSync` (`node:sqlite`). Tracks file mtimes and SHA-256 hashes for **0ms skip** on unchanged files.
- 💬 **Deterministic Codebase Q&A**: Answers architecture questions with line-level source code citations.
- 🛡️ **100% Private by Default**: In CLI and VS Code modes, code never leaves your local machine.

---

## 🚀 Quick Start Guide

### 1. Run via NPX (Zero Setup)
Navigate to any repository folder on your computer:
```bash
npx repolenz
```
RepoLenz scans your codebase, starts the local dashboard at `http://localhost:3001`, and opens your default browser.

### 2. Use the Web App
Visit **[repolenz.onrender.com](https://repolenz.onrender.com)**, paste any public GitHub repository link (e.g. `expressjs/express` or `facebook/react`), and analyze it instantly.

### 3. Use in Visual Studio Code
1. Build and package the extension:
   ```bash
   npm run build:extension
   cd extensions/vscode
   npx @vscode/vsce package
   code --install-extension repolenz-0.1.0.vsix
   ```
2. Click the **RepoLenz compass icon** on the left Activity Bar, or click the `$(type-hierarchy)` icon in the top-right of any open editor tab.

---

## 🛠️ CLI Commands

RepoLenz includes standalone CLI utilities:

```bash
# 1. Architectural summary of current directory
npx repolenz scan

# 2. Check circular dependencies
npx repolenz . --graph

# 3. Incremental indexing into local SQLite cache
npx repolenz index .

# 4. Search AST symbols (functions, classes, interfaces)
npx repolenz search CodeParser --kind class

# 5. Ask codebase questions from terminal
npx repolenz ask "Where is file filtering implemented?"
```

---

## 🧪 Development & Testing

```bash
# 1. Clone repository
git clone https://github.com/repolenz/repolenz.git
cd repolenz

# 2. Install dependencies
npm install
npm --prefix web install

# 3. Run test suite (79 unit tests across 15 test suites)
npm test

# 4. Start local development server
npm run dev

# 5. Build production distribution
npm run build:web
```

---

## 📄 License

MIT © [RepoLenz](https://github.com/repolenz/repolenz)
