import React, { useState } from 'react';
import {
  X,
  GitBranch,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  ExternalLink
} from 'lucide-react';

const POPULAR_REPOS = [
  { name: 'expressjs/express', desc: 'Fast Node.js web framework' },
  { name: 'facebook/react', desc: 'UI component library' },
  { name: 'fastapi/fastapi', desc: 'High-performance Python API' },
  { name: 'pallets/flask', desc: 'Python WSGI web framework' },
  { name: 'tailwindlabs/tailwindcss', desc: 'Utility-first CSS framework' }
];

export function RepoAccessModal({
  isOpen,
  onClose,
  currentPath,
  recentRepos,
  onSelectPath,
  onRefresh
}) {
  const [gitUrl, setGitUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (urlToSubmit) => {
    const targetUrl = (typeof urlToSubmit === 'string' ? urlToSubmit : gitUrl).trim();
    if (!targetUrl) return;

    setError('');
    setIsLoading(true);

    try {
      await onSelectPath(targetUrl);
      if (onRefresh) {
        await onRefresh();
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to clone and analyze repository. Make sure the repository is public.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPick = (repoName) => {
    setGitUrl(repoName);
    handleSubmit(repoName);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="liquid-glass-card border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#21122e] border border-[#3d2153] flex items-center justify-center text-purple-300">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-comic text-base font-bold text-white tracking-wide">
                Analyze GitHub Repository
              </h3>
              <p className="text-xs text-zinc-400">
                Connect any public Git codebase for instant architecture intelligence
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn-solid btn-solid-zinc p-1.5 text-zinc-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-3"
          >
            <label className="block text-xs font-medium text-zinc-300">
              Repository URL or GitHub shorthand:
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                placeholder="e.g. facebook/react or https://github.com/expressjs/express"
                className="flex-1 liquid-glass-input rounded-xl px-3.5 py-2.5 text-xs font-mono"
                disabled={isLoading}
                autoFocus
              />

              <button
                type="submit"
                disabled={isLoading || !gitUrl.trim()}
                className="btn-solid btn-solid-plum px-4 py-2.5 text-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze Repo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="bg-[#21122e]/60 border border-[#3d2153] rounded-xl p-4 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-purple-300 animate-spin mx-auto" />
              <div className="text-xs font-comic font-bold text-zinc-200">
                Cloning repository & analyzing AST dependency graph...
              </div>
              <div className="text-[11px] text-zinc-400">
                Parsing source files, discovering exports, and constructing dependency tree.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-950/40 border border-rose-900/60 rounded-xl p-3.5 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-comic font-bold block text-rose-200">
                  Analysis Failed:
                </span>
                <span className="text-rose-300/90 leading-relaxed">{error}</span>
              </div>
            </div>
          )}

          {/* Quick Try Open-Source Repositories */}
          {!isLoading && (
            <div className="space-y-2.5 pt-1">
              <span className="text-[11px] font-comic font-bold text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-purple-400" />
                Quick-Try Popular Repositories:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {POPULAR_REPOS.map((repo) => (
                  <button
                    key={repo.name}
                    type="button"
                    onClick={() => handleQuickPick(repo.name)}
                    className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-[#3d2153] text-left transition-all group flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-mono text-xs text-zinc-200 group-hover:text-purple-300 truncate">
                        {repo.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {repo.desc}
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-purple-300 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recently Analyzed Repositories */}
          {!isLoading && recentRepos && recentRepos.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-[11px] font-comic font-bold text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-zinc-500" />
                Recently Analyzed Repositories:
              </span>

              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {recentRepos.map((r) => {
                  const displayName = r.path.split(/[/\\]/).slice(-2).join('/');
                  const isActive = r.path === currentPath;

                  return (
                    <div
                      key={r.path}
                      onClick={() => handleSubmit(r.path)}
                      className="px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 cursor-pointer flex items-center justify-between text-xs transition-colors group"
                    >
                      <div className="flex items-center gap-2 max-w-[80%] truncate">
                        <GitBranch className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                        <span className="font-mono text-zinc-200 group-hover:text-purple-300 truncate">
                          {displayName || r.path}
                        </span>
                      </div>

                      {isActive && (
                        <span className="text-[10px] text-emerald-400 font-comic font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}