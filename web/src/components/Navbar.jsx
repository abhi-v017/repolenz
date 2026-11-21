import React from 'react';
import {
  Compass,
  RefreshCw,
  FolderGit2,
  Network,
  Activity,
  Code2,
  Search,
  MessageSquareCode,
  GitBranch
} from 'lucide-react';

export function Navbar({
  activeTab,
  setActiveTab,
  repoStatus,
  onIndex,
  onOpenAccessModal,
  isIndexing
}) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'graph', label: 'Dependency Graph', icon: Network },
    { id: 'impact', label: 'Impact Analysis', icon: Activity },
    { id: 'symbols', label: 'Symbol Explorer', icon: Code2 },
    { id: 'search', label: 'Code Search', icon: Search },
    { id: 'qa', label: 'Codebase Q&A', icon: MessageSquareCode }
  ];

  const repoName = repoStatus?.name || (repoStatus?.rootPath ? repoStatus.rootPath.split(/[/\\]/).pop() : 'Repository');

  return (
    <header className="liquid-glass border-b border-white/10 sticky top-0 z-40 bg-black/75 backdrop-blur-xl no-scrollbar overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Repository Quick Switch */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-sky-400/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-comic font-bold tracking-tight text-white text-lg">
                RepoLenz
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/25 font-comic font-bold">
                Code Intelligence
              </span>
            </div>

            {/* Clickable repository switch trigger */}
            <button
              onClick={onOpenAccessModal}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-purple-300 transition-colors group mt-0.5"
              title="Click to open or switch repository"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 shrink-0" />
              <span className="font-comic font-bold text-zinc-200 group-hover:text-purple-300 max-w-[200px] sm:max-w-[280px] truncate">
                {repoName}
              </span>
              <span className="btn-solid btn-solid-zinc text-[10px] px-2 py-0.5 rounded-md font-mono">
                Switch
              </span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-zinc-950/90 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-comic font-bold transition-all whitespace-nowrap btn-solid ${
                  isActive
                    ? 'btn-solid-plum'
                    : 'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 shadow-none'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAccessModal}
            className="btn-solid btn-solid-zinc flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs"
            title="Analyze a GitHub repository"
          >
            <GitBranch className="w-3.5 h-3.5 text-purple-300" />
            <span className="hidden sm:inline">Analyze Repo</span>
          </button>

          <button
            onClick={onIndex}
            disabled={isIndexing}
            className="btn-solid btn-solid-plum flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isIndexing ? 'animate-spin text-purple-200' : 'text-purple-300'}`} />
            {isIndexing ? 'Indexing...' : 'Index Codebase'}
          </button>
        </div>
      </div>
    </header>
  );
}
