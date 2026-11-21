const vscode = require('vscode');
const path = require('node:path');

let activeServer = null;
let activePanel = null;

/**
 * Activates the VS Code extension.
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const disposable = vscode.commands.registerCommand('repolenz.open', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('Please open a project folder in VS Code before launching RepoLenz.');
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    if (activePanel) {
      activePanel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Create webview panel
    activePanel = vscode.window.createWebviewPanel(
      'repolenz',
      'RepoLenz: Dependency Map',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Boot embedded RepoLenz server
    try {
      const serverModule = await import('../../src/server/app.js');
      const port = 3001;
      const { server } = await serverModule.startServer(port, rootPath);
      activeServer = server;

      activePanel.webview.html = getWebviewContent(`http://localhost:${port}`);

      activePanel.onDidDispose(() => {
        activePanel = null;
        if (activeServer) {
          activeServer.close();
          activeServer = null;
        }
      }, null, context.subscriptions);
    } catch (err) {
      vscode.window.showErrorMessage(`Could not launch RepoLenz: ${err.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(serverUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RepoLenz</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000000; }
    iframe { border: none; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <iframe src="${serverUrl}" allow="clipboard-read; clipboard-write"></iframe>
</body>
</html>`;
}

function deactivate() {
  if (activeServer) {
    activeServer.close();
    activeServer = null;
  }
}

module.exports = {
  activate,
  deactivate
};
