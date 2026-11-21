const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

let activeServerInfo = null; // { server, service, port, rootPath }
let activePanel = null;

/**
 * Resolves the absolute path to the RepoLenz server app module.
 * Supports both standalone packaged extension and monorepo development.
 */
function getServerModulePath() {
  const packagedPath = path.join(__dirname, 'src/server/app.js');
  const devPath = path.resolve(__dirname, '../../src/server/app.js');

  if (fs.existsSync(packagedPath)) {
    return packagedPath;
  }
  return devPath;
}

/**
 * Ensures the RepoLenz embedded server is running for the active workspace.
 *
 * @param {string} rootPath
 * @returns {Promise<{ server: any, service: any, port: number }>}
 */
async function ensureServerRunning(rootPath) {
  if (activeServerInfo && activeServerInfo.rootPath === rootPath) {
    return activeServerInfo;
  }

  // Close previous server if root changed
  if (activeServerInfo && activeServerInfo.server) {
    try {
      activeServerInfo.server.close();
    } catch {
      // ignore
    }
    activeServerInfo = null;
  }

  const serverAppPath = getServerModulePath();
  const fileUrl = pathToFileURL(serverAppPath).href;
  const serverModule = await import(fileUrl);

  // Bind to ephemeral dynamic port (port 0) on loopback to avoid port conflicts
  const { server, service, port } = await serverModule.startServer(0, rootPath, '127.0.0.1');

  activeServerInfo = { server, service, port, rootPath };
  return activeServerInfo;
}

/**
 * Opens or focuses the RepoLenz Webview panel.
 *
 * @param {vscode.ExtensionContext} context
 * @param {string} rootPath
 * @param {object} [options]
 * @param {string} [options.tab]
 * @param {string} [options.file]
 */
async function openRepoLenzPanel(context, rootPath, options = {}) {
  const { tab = 'overview', file = null } = options;

  let serverInfo;
  try {
    serverInfo = await ensureServerRunning(rootPath);
  } catch (err) {
    vscode.window.showErrorMessage(`RepoLenz failed to initialize: ${err.message}`);
    return;
  }

  const queryParams = new URLSearchParams();
  if (tab) queryParams.set('tab', tab);
  if (file) queryParams.set('file', file);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const serverUrl = `http://127.0.0.1:${serverInfo.port}/${queryString}`;

  if (activePanel) {
    activePanel.reveal(vscode.ViewColumn.One);
    activePanel.webview.html = getWebviewContent(serverUrl);
    return;
  }

  activePanel = vscode.window.createWebviewPanel(
    'repolenz',
    'RepoLenz: Visual Map',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      enableFindWidget: true
    }
  );

  activePanel.iconPath = vscode.Uri.file(path.join(__dirname, 'media/icon.svg'));
  activePanel.webview.html = getWebviewContent(serverUrl);

  // Handle messages from the webview iframe (e.g. open file at line)
  activePanel.webview.onDidReceiveMessage(
    async (message) => {
      if (message && message.type === 'repolenz:openFile' && message.filePath) {
        try {
          const fullPath = path.isAbsolute(message.filePath)
            ? message.filePath
            : path.join(rootPath, message.filePath);

          if (!fs.existsSync(fullPath)) {
            vscode.window.showWarningMessage(`File not found: ${message.filePath}`);
            return;
          }

          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
          const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

          if (message.line && message.line > 0) {
            const lineIndex = Math.max(0, message.line - 1);
            const pos = new vscode.Position(lineIndex, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(
              new vscode.Range(pos, pos),
              vscode.TextEditorRevealType.InCenter
            );
          }
        } catch (err) {
          vscode.window.showErrorMessage(`Could not open file: ${err.message}`);
        }
      }
    },
    null,
    context.subscriptions
  );

  activePanel.onDidDispose(
    () => {
      activePanel = null;
    },
    null,
    context.subscriptions
  );
}

/**
 * Returns HTML for the Webview with CSP allowing local loopback iframe.
 */
function getWebviewContent(serverUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://127.0.0.1:* http://localhost:* https:; script-src 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* http://localhost:*; style-src 'unsafe-inline' http://127.0.0.1:* http://localhost:*; img-src http://127.0.0.1:* http://localhost:* data: https:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RepoLenz</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000000; }
    iframe { border: none; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <iframe id="repolenz-frame" src="${serverUrl}" allow="clipboard-read; clipboard-write"></iframe>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'repolenz:openFile') {
        vscode.postMessage(event.data);
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Sidebar Quick Actions Tree Provider
 */
class RepoLenzSidebarProvider {
  getTreeItem(element) {
    return element;
  }

  getChildren() {
    const items = [
      {
        label: 'Open Visual Dependency Map',
        description: 'Interactive architecture graph',
        iconPath: new vscode.ThemeIcon('type-hierarchy'),
        command: {
          command: 'repolenz.open',
          title: 'Open Map'
        }
      },
      {
        label: 'Analyze Active File Impact',
        description: 'Blast radius analysis',
        iconPath: new vscode.ThemeIcon('pulse'),
        command: {
          command: 'repolenz.analyzeActiveFile',
          title: 'Analyze File Impact'
        }
      },
      {
        label: 'Search Workspace Symbols',
        description: 'AST function & class navigator',
        iconPath: new vscode.ThemeIcon('symbol-method'),
        command: {
          command: 'repolenz.searchSymbols',
          title: 'Search Symbols'
        }
      },
      {
        label: 'Ask Codebase Question',
        description: 'Source-grounded Q&A',
        iconPath: new vscode.ThemeIcon('comment-discussion'),
        command: {
          command: 'repolenz.askQA',
          title: 'Ask Question'
        }
      },
      {
        label: 'Re-Index Workspace',
        description: 'Refresh AST dependency cache',
        iconPath: new vscode.ThemeIcon('refresh'),
        command: {
          command: 'repolenz.reindex',
          title: 'Re-Index'
        }
      }
    ];

    return Promise.resolve(
      items.map((i) => {
        const item = new vscode.TreeItem(i.label, vscode.TreeItemCollapsibleState.None);
        item.description = i.description;
        item.iconPath = i.iconPath;
        item.command = i.command;
        return item;
      })
    );
  }
}

/**
 * Activates the VS Code extension.
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Register Sidebar
  const sidebarProvider = new RepoLenzSidebarProvider();
  vscode.window.registerTreeDataProvider('repolenz.sidebar', sidebarProvider);

  // Helper to get active root
  const getRootPath = () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('Please open a workspace folder in VS Code first.');
      return null;
    }
    return workspaceFolders[0].uri.fsPath;
  };

  // 1. Command: Open Full Visual Map
  const openCmd = vscode.commands.registerCommand('repolenz.open', async () => {
    const rootPath = getRootPath();
    if (!rootPath) return;
    await openRepoLenzPanel(context, rootPath, { tab: 'overview' });
  });

  // 2. Command: Analyze Active File Impact
  const impactCmd = vscode.commands.registerCommand('repolenz.analyzeActiveFile', async (uri) => {
    const rootPath = getRootPath();
    if (!rootPath) return;

    let targetUri = uri;
    if (!targetUri && vscode.window.activeTextEditor) {
      targetUri = vscode.window.activeTextEditor.document.uri;
    }

    if (!targetUri) {
      vscode.window.showInformationMessage('Opening RepoLenz Impact Analysis tab...');
      await openRepoLenzPanel(context, rootPath, { tab: 'impact' });
      return;
    }

    const relPath = path.relative(rootPath, targetUri.fsPath).replace(/\\/g, '/');
    await openRepoLenzPanel(context, rootPath, { tab: 'impact', file: relPath });
  });

  // 3. Command: Search Symbols
  const searchCmd = vscode.commands.registerCommand('repolenz.searchSymbols', async () => {
    const rootPath = getRootPath();
    if (!rootPath) return;
    await openRepoLenzPanel(context, rootPath, { tab: 'symbols' });
  });

  // 4. Command: Codebase Q&A
  const qaCmd = vscode.commands.registerCommand('repolenz.askQA', async () => {
    const rootPath = getRootPath();
    if (!rootPath) return;
    await openRepoLenzPanel(context, rootPath, { tab: 'qa' });
  });

  // 5. Command: Re-Index Workspace
  const reindexCmd = vscode.commands.registerCommand('repolenz.reindex', async () => {
    const rootPath = getRootPath();
    if (!rootPath) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'RepoLenz: Indexing codebase...',
        cancellable: false
      },
      async () => {
        const serverInfo = await ensureServerRunning(rootPath);
        await serverInfo.service.runIncrementalIndex();
        vscode.window.showInformationMessage('RepoLenz: Codebase index refreshed successfully!');
      }
    );
  });

  context.subscriptions.push(openCmd, impactCmd, searchCmd, qaCmd, reindexCmd);
}

function deactivate() {
  if (activeServerInfo && activeServerInfo.server) {
    try {
      activeServerInfo.server.close();
    } catch {
      // ignore
    }
    activeServerInfo = null;
  }
}

module.exports = {
  activate,
  deactivate
};