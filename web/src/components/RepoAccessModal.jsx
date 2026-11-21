import React, { useState } from 'react';
import {
  X,
  HardDrive,
  FolderOpen,
  GitBranch,
  ArrowRight,
  Clock,
  CheckCircle2,
  FolderCode,
  Copy,
  Check,
  AlertTriangle,
  Upload,
  Terminal,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { uploadRepositoryFiles } from '../services/api';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.next',
  '.nuxt',
  '.output',
  'dist',
  'build',
  'out',
  '.cache',
  '.turbo',
  'coverage',
  '.vscode',
  '.idea',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  '.env',
  'target',
  'vendor',
  'bin',
  'obj'
]);

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.tiff',
  '.mp4', '.webm', '.mov', '.avi', '.mp3', '.wav', '.ogg',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.iso', '.dmg',
  '.lock', '.sqlite', '.db', '.sqlite3', '.log', '.map'
]);

const IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'composer.lock',
  'cargo.lock',
  'gemfile.lock'
]);

function shouldIncludeFile(relPath, fileSize) {
  // Discard files larger than 1MB (source files are almost always < 500KB)
  if (fileSize > 1024 * 1024) return false;

  const parts = relPath.replace(/\\/g, '/').split('/');
  
  // Check directory segments
  for (let i = 0; i < parts.length - 1; i++) {
    if (IGNORED_DIRS.has(parts[i].toLowerCase())) {
      return false;
    }
  }

  const fileName = parts[parts.length - 1].toLowerCase();
  if (IGNORED_FILENAMES.has(fileName)) return false;

  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx !== -1) {
    const ext = fileName.slice(dotIdx);
    if (IGNORED_EXTENSIONS.has(ext)) return false;
  }

  return true;
}

export function RepoAccessModal({
  isOpen,
  onClose,
  currentPath,
  recentRepos,
  onSelectPath,
  onRefresh
}) {
  const isCloudMode = typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  const [activeTab, setActiveTab] = useState(isCloudMode ? 'picker' : 'local');
  const [inputPath, setInputPath] = useState(currentPath || '');
  const [gitUrl, setGitUrl] = useState('');
  const [localError, setLocalError] = useState('');

  // Upload States
  const [uploadStatus, setUploadStatus] = useState(null); // null | 'scanning' | 'reading' | 'uploading' | 'success' | 'error'
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Git State
  const [isGitLoading, setIsGitLoading] = useState(false);
  const [gitError, setGitError] = useState('');

  // Copy helper
  const [copiedCli, setCopiedCli] = useState(false);

  if (!isOpen) return null;

  const handleCopyCli = () => {
    navigator.clipboard.writeText('npx repolenz');
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleLocalSubmit = (e) => {
    e.preventDefault();
    setLocalError('');
    const trimmed = inputPath.trim();
    if (!trimmed) return;

    // Guard on cloud: warn user immediately if attempting a local drive path on cloud container
    if (isCloudMode && (/^[A-Za-z]:/.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\'))) {
      setLocalError(
        'Cloud server cannot read private files from your computer drive. Use the "Upload Folder" tab or run "npx repolenz" locally in your terminal!'
      );
      return;
    }

    onSelectPath(trimmed);
    onClose();
  };

  const processFiles = async (fileList) => {
    const rawFiles = Array.from(fileList);
    if (!rawFiles || rawFiles.length === 0) return;

    setUploadStatus('scanning');
    setUploadError('');
    setUploadProgressText('Scanning files and filtering dependencies...');

    try {
      const firstRelative = rawFiles[0].webkitRelativePath || rawFiles[0].name || '';
      const folderName = firstRelative.split('/')[0] || 'uploaded-project';

      // Client-side filter: strips node_modules, .git, binaries, lockfiles
      const included = rawFiles.filter((f) =>
        shouldIncludeFile(f.webkitRelativePath || f.name, f.size)
      );

      if (included.length === 0) {
        throw new Error(
          'No supported source code files found in this folder. Only code files (.js, .py, .ts, etc.) under 1MB are uploaded.'
        );
      }

      const excludedCount = rawFiles.length - included.length;
      setUploadStatus('reading');
      setUploadProgressText(
        `Packaging ${included.length} clean source files (${excludedCount} dependencies & binaries safely skipped)...`
      );

      // Read text contents
      const payload = [];
      for (let i = 0; i < included.length; i++) {
        const file = included[i];
        const content = await file.text();
        payload.push({
          path: file.webkitRelativePath || file.name,
          content
        });
      }

      setUploadStatus('uploading');
      setUploadProgressText(`Uploading ${payload.length} files & indexing codebase...`);

      await uploadRepositoryFiles(folderName, payload);

      setUploadStatus('success');
      setUploadProgressText('Codebase analyzed & ready!');

      if (onRefresh) {
        await onRefresh();
      } else if (onSelectPath) {
        await onSelectPath(folderName);
      }

      setTimeout(() => {
        setUploadStatus(null);
        onClose();
      }, 700);
    } catch (err) {
      setUploadStatus('error');
      setUploadError(err.message || 'Failed to upload project files');
    }
  };

  const handleFolderPicked = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleGitSubmit = async (e) => {
    e.preventDefault();
    setGitError('');
    if (!gitUrl.trim()) return;

    setIsGitLoading(true);
    try {
      await onSelectPath(gitUrl.trim());
      onClose();
    } catch (err) {
      setGitError(err.message || 'Failed to clone repository');
    } finally {
      setIsGitLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="liquid-glass-card border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#21122e] border border-[#3d2153] flex items-center justify-center text-purple-300">
              <FolderCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-comic text-base font-bold text-white tracking-wide">
                Access & Connect Repository
              </h3>
              <p className="text-xs text-zinc-400">
                Choose how RepoLenz accesses your codebase
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-solid btn-solid-zinc p-1.5 text-zinc-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/5 bg-zinc-900/40 px-6 py-2.5 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('picker')}
            className={`btn-solid text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'picker'
                ? 'btn-solid-plum'
                : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            1. Upload Folder
            {isCloudMode && (
              <span className="text-[10px] bg-purple-900/60 text-purple-200 px-1.5 py-0.2 rounded font-mono">
                Cloud
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('git')}
            className={`btn-solid text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'git'
                ? 'btn-solid-emerald'
                : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            2. Git / GitHub URL
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`btn-solid text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'local'
                ? 'btn-solid-plum'
                : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            3. Local Drive Path
            {!isCloudMode && (
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.2 rounded font-mono">
                Local
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* TAB 1: Folder Upload */}
          {activeTab === 'picker' && (
            <div className="space-y-4">
              {/* Educational info badge */}
              <div className="bg-[#21122e]/60 border border-[#3d2153] rounded-xl p-3.5 text-xs text-purple-200/90 leading-relaxed space-y-1.5">
                <div className="flex items-center gap-2 font-comic font-bold text-purple-200">
                  <ShieldCheck className="w-4 h-4 text-purple-300 shrink-0" />
                  <span>Smart Client-Side Filter & Instant Upload:</span>
                </div>
                <p className="text-zinc-300">
                  When your browser prompts <span className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">"Upload X files to this site?"</span>, click <strong className="text-purple-200 font-comic">Upload</strong>.
                </p>
                <p className="text-zinc-400 text-[11px]">
                  Don't worry if your folder has 20,000+ files: RepoLenz automatically filters out <span className="text-purple-300">node_modules</span>, <span className="text-purple-300">.git</span>, and build binaries right inside your browser before sending anything. Only clean source code (~30-60 files, &lt; 500 KB) is uploaded!
                </p>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-2xl p-8 text-center space-y-3 transition-colors ${
                  isDragging
                    ? 'border-purple-400 bg-purple-950/20'
                    : 'border-white/10 hover:border-[#3d2153] bg-white/[0.01]'
                }`}
              >
                {uploadStatus === 'scanning' ||
                uploadStatus === 'reading' ||
                uploadStatus === 'uploading' ? (
                  <div className="space-y-3 py-4">
                    <Loader2 className="w-8 h-8 text-purple-300 mx-auto animate-spin" />
                    <div className="font-comic font-bold text-sm text-zinc-100">
                      {uploadProgressText}
                    </div>
                    <div className="text-xs text-zinc-400">
                      Processing source files...
                    </div>
                  </div>
                ) : uploadStatus === 'success' ? (
                  <div className="space-y-2 py-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <div className="font-comic font-bold text-sm text-emerald-200">
                      {uploadProgressText}
                    </div>
                  </div>
                ) : (
                  <>
                    <FolderOpen className="w-10 h-10 text-purple-300 mx-auto" />
                    <div className="space-y-1">
                      <div className="font-comic font-bold text-sm text-zinc-100">
                        Pick or drag & drop your project folder
                      </div>
                      <div className="text-xs text-zinc-400">
                        Supports JavaScript, TypeScript, Python, and more
                      </div>
                    </div>

                    <label className="btn-solid btn-solid-plum inline-flex items-center gap-2 px-5 py-2.5 text-xs cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Browse Folder...</span>
                      <input
                        type="file"
                        webkitdirectory="true"
                        directory="true"
                        multiple
                        onChange={handleFolderPicked}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>

              {uploadStatus === 'error' && (
                <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-comic font-bold block">Upload Error:</span>
                    <span>{uploadError}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Git / GitHub URL */}
          {activeTab === 'git' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3.5 text-xs text-emerald-200/90 leading-relaxed space-y-1">
                <span className="font-comic font-bold text-emerald-300 block">
                  🌐 Clone or Download from GitHub:
                </span>
                <p className="text-zinc-300">
                  Paste any public GitHub repository link to analyze open-source codebases effortlessly on this server.
                </p>
              </div>

              <form onSubmit={handleGitSubmit} className="space-y-3">
                <label className="block text-xs font-medium text-zinc-300">
                  GitHub repository URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/expressjs/express"
                    className="flex-1 liquid-glass-input rounded-xl px-3.5 py-2.5 text-xs font-mono"
                    disabled={isGitLoading}
                  />
                  <button
                    type="submit"
                    disabled={isGitLoading || !gitUrl.trim()}
                    className="btn-solid btn-solid-emerald px-4 py-2.5 text-xs flex items-center gap-1.5"
                  >
                    {isGitLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Cloning...
                      </>
                    ) : (
                      <>
                        Analyze Repo
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {gitError && (
                <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-comic font-bold block">Git Error:</span>
                    <span>{gitError}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Local Path */}
          {activeTab === 'local' && (
            <div className="space-y-4">
              {isCloudMode ? (
                <div className="space-y-4">
                  {/* Cloud notice */}
                  <div className="bg-[#21122e]/60 border border-[#3d2153] rounded-xl p-4 text-xs text-zinc-300 space-y-3">
                    <div className="flex items-center gap-2 font-comic font-bold text-purple-200 text-sm">
                      <Terminal className="w-4 h-4 text-purple-300" />
                      Cloud Hosting Notice:
                    </div>
                    <p className="text-zinc-300 leading-relaxed">
                      You are using RepoLenz on the web (<span className="text-white font-mono font-semibold">{window.location.hostname}</span>).
                      Cloud servers run inside an isolated Linux container and <strong className="text-purple-200">cannot read files from your private computer hard drive</strong> (like <span className="font-mono text-zinc-300">C:\personal\...</span>).
                    </p>

                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <span className="font-comic font-bold text-xs text-purple-300 block">
                        🚀 100% Private Local Companion (Zero Upload):
                      </span>
                      <p className="text-zinc-400 text-[11px]">
                        Run this single command in any project folder on your computer. RepoLenz opens instantly at <span className="text-purple-300 font-mono">http://localhost:3000</span> with complete access to your local files:
                      </p>
                      <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-xl px-3.5 py-2">
                        <code className="text-emerald-400 font-mono text-xs">
                          npx repolenz
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyCli}
                          className="btn-solid btn-solid-zinc text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5 text-zinc-300"
                        >
                          {copiedCli ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-zinc-400" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick switch to Upload Folder */}
                  <div className="text-center pt-1">
                    <button
                      onClick={() => setActiveTab('picker')}
                      className="btn-solid btn-solid-plum px-4 py-2 text-xs inline-flex items-center gap-2"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Switch to Folder Upload
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-[#21122e]/60 border border-[#3d2153] rounded-xl p-3.5 text-xs text-purple-200/90 leading-relaxed space-y-1">
                    <span className="font-comic font-bold text-purple-200 block">
                      💡 Local Companion Mode:
                    </span>
                    <p className="text-zinc-300">
                      RepoLenz is running directly on your machine. Files are read straight from your hard drive with 0 cloud upload—your code stays 100% private.
                    </p>
                  </div>

                  <form onSubmit={handleLocalSubmit} className="space-y-3">
                    <label className="block text-xs font-medium text-zinc-300">
                      Enter directory path on your computer:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputPath}
                        onChange={(e) => setInputPath(e.target.value)}
                        placeholder="e.g. C:\projects\my-app or /Users/name/repo or ."
                        className="flex-1 liquid-glass-input rounded-xl px-3.5 py-2.5 text-xs font-mono"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="btn-solid btn-solid-plum px-4 py-2.5 text-xs flex items-center gap-1.5"
                      >
                        Open Repo
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </>
              )}

              {localError && (
                <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-comic font-bold block">Error:</span>
                    <span>{localError}</span>
                  </div>
                </div>
              )}

              {/* Recent repositories */}
              {recentRepos && recentRepos.length > 0 && !isCloudMode && (
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-comic font-bold text-zinc-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    Recently Opened Repositories:
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {recentRepos.map((r) => (
                      <div
                        key={r.path}
                        onClick={() => {
                          onSelectPath(r.path);
                          onClose();
                        }}
                        className="px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 cursor-pointer flex items-center justify-between text-xs transition-colors group"
                      >
                        <div className="flex items-center gap-2 max-w-[85%] truncate">
                          <HardDrive className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                          <span className="font-mono text-zinc-200 group-hover:text-purple-300 truncate">
                            {r.path}
                          </span>
                        </div>
                        {r.path === currentPath && (
                          <span className="text-[10px] text-emerald-400 font-comic font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}