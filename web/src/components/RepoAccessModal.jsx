import React, { useState } from 'react';
import {
  X,
  HardDrive,
  FolderOpen,
  GitBranch,
  ArrowRight,
  Clock,
  CheckCircle2,
  HelpCircle,
  FolderCode
} from 'lucide-react';

export function RepoAccessModal({
  isOpen,
  onClose,
  currentPath,
  recentRepos,
  onSelectPath
}) {
  const [activeTab, setActiveTab] = useState('local'); // 'local' | 'picker' | 'git'
  const [inputPath, setInputPath] = useState(currentPath || '');
  const [gitUrl, setGitUrl] = useState('');

  if (!isOpen) return null;

  const handleLocalSubmit = (e) => {
    e.preventDefault();
    if (inputPath.trim()) {
      onSelectPath(inputPath.trim());
      onClose();
    }
  };

  const handleFolderPicked = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // In webkitdirectory, the first file contains the root folder name in webkitRelativePath
      const firstRelative = files[0].webkitRelativePath || '';
      const folderName = firstRelative.split('/')[0] || 'selected-folder';
      // Pass the folder hint or path
      onSelectPath(inputPath || folderName);
      onClose();
    }
  };

  const handleGitSubmit = (e) => {
    e.preventDefault();
    if (gitUrl.trim()) {
      // If user passed a git URL, set it
      onSelectPath(gitUrl.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="liquid-glass-card border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800/60 flex items-center justify-center text-purple-300">
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
            onClick={() => setActiveTab('local')}
            className={`btn-solid text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'local'
                ? 'btn-solid-plum'
                : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            1. Local Drive Path
          </button>

          <button
            onClick={() => setActiveTab('picker')}
            className={`btn-solid text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'picker'
                ? 'btn-solid-purple'
                : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            2. Folder Picker
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
            3. Git / GitHub URL
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* TAB 1: Local Path */}
          {activeTab === 'local' && (
            <div className="space-y-4">
              <div className="bg-purple-950/30 border border-purple-900/40 rounded-xl p-3.5 text-xs text-purple-200/90 leading-relaxed space-y-1">
                <span className="font-comic font-bold text-purple-300 block">
                  💡 How Local Companion Mode Works:
                </span>
                <p className="text-zinc-300">
                  RepoLenz runs on your local machine using Node.js. It reads files directly from your hard drive with zero cloud upload—your code stays 100% private.
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

              {/* Recent repositories */}
              {recentRepos && recentRepos.length > 0 && (
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

          {/* TAB 2: Folder Picker */}
          {activeTab === 'picker' && (
            <div className="space-y-4">
              <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3.5 text-xs text-purple-200/90 leading-relaxed space-y-1">
                <span className="font-comic font-bold text-purple-300 block">
                  📂 Native Browser Folder Picker:
                </span>
                <p className="text-zinc-300">
                  Select a repository directory directly from Windows Explorer or Mac Finder using your browser's folder selector.
                </p>
              </div>

              <div className="border-2 border-dashed border-white/10 hover:border-purple-400/40 rounded-2xl p-8 text-center space-y-3 transition-colors bg-white/[0.01]">
                <FolderOpen className="w-10 h-10 text-purple-300/80 mx-auto" />
                <div className="space-y-1">
                  <div className="font-comic font-bold text-sm text-zinc-100">
                    Pick a project folder from your computer
                  </div>
                  <div className="text-xs text-zinc-400">
                    Works with JavaScript, TypeScript, and Python projects
                  </div>
                </div>

                <label className="btn-solid btn-solid-purple inline-flex items-center gap-2 px-5 py-2.5 text-xs cursor-pointer">
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
              </div>
            </div>
          )}

          {/* TAB 3: Git / GitHub URL */}
          {activeTab === 'git' && (
            <div className="space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3.5 text-xs text-emerald-200/90 leading-relaxed space-y-1">
                <span className="font-comic font-bold text-emerald-300 block">
                  🌐 Clone or Download from GitHub:
                </span>
                <p className="text-zinc-300">
                  Paste any public GitHub repository link to analyze open-source codebases effortlessly.
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
                  />
                  <button
                    type="submit"
                    className="btn-solid btn-solid-emerald px-4 py-2.5 text-xs flex items-center gap-1.5"
                  >
                    Analyze Git Repo
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
