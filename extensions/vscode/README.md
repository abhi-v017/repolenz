# RepoLenz for Visual Studio Code

Interactive codebase dependency graphs, AST code intelligence, and change impact blast radius analysis directly inside VS Code.

## Features
- **Visual Dependency Graph**: Explore module connections, cycles, and architecture without leaving your editor.
- **Change Impact Analysis**: See exactly which downstream files will break before modifying a function or file.
- **Source-Grounded Q&A**: Ask questions about your repository with deterministic file & line citations.
- **100% Offline & Private**: Zero cloud uploads. Runs completely locally on your machine.

## How to Package & Install Locally (Free)
1. Install the VS Code Extension CLI (`vsce`):
   ```bash
   npm install -g @vscode/vsce
   ```
2. Package the extension:
   ```bash
   cd extensions/vscode
   vsce package
   ```
   This generates `repolenz-0.1.0.vsix`.
3. In VS Code:
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
   - Run **"Extensions: Install from VSIX..."** and select `repolenz-0.1.0.vsix`.
4. Click the **RepoLenz** icon in the editor title bar to open your dependency graph!
