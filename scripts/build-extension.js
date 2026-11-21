/**
 * Extension Bundling Script
 *
 * Prepares the self-contained VS Code extension by bundling the
 * core backend engine, compiled React dashboard, and production dependencies
 * into extensions/vscode.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const extDir = path.resolve(rootDir, 'extensions/vscode');

console.log('🚀 Building RepoLenz VS Code Extension Bundle...');

// 1. Build web distribution
console.log('📦 Step 1: Building React Webview dashboard...');
execSync('npm --prefix web run build', { cwd: rootDir, stdio: 'inherit' });

// 2. Sync src into extensions/vscode/src
console.log('📂 Step 2: Copying server & analysis engine into extension...');
const targetSrc = path.join(extDir, 'src');
if (fs.existsSync(targetSrc)) {
  fs.rmSync(targetSrc, { recursive: true, force: true });
}
fs.cpSync(path.join(rootDir, 'src'), targetSrc, { recursive: true });

// 3. Sync web/dist into extensions/vscode/web/dist
console.log('🎨 Step 3: Copying compiled dashboard into extension...');
const targetDist = path.join(extDir, 'web/dist');
if (fs.existsSync(targetDist)) {
  fs.rmSync(targetDist, { recursive: true, force: true });
}
fs.mkdirSync(path.dirname(targetDist), { recursive: true });
fs.cpSync(path.join(rootDir, 'web/dist'), targetDist, { recursive: true });

console.log('✅ Extension assets ready in extensions/vscode!');
console.log('👉 Next: Run "npm install --omit=dev" then "npx @vscode/vsce package"');
