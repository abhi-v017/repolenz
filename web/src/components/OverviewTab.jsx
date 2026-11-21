import React from 'react';
import {
  Files,
  FileCode,
  HardDrive,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  FolderTree,
  ExternalLink,
  Sparkles
} from 'lucide-react';

export function OverviewTab({ filesData, graphData, onSelectFile, onOpenAccessModal }) {
  const stats = filesData?.stats;
  const cycles = graphData?.cycles || [];
  const languages = stats?.languages ? Object.entries(stats.languages) : [];
  const largestFiles = stats?.largestFilesByLines || [];

  return (
    <div className="space-y-6">
      {/* Circular Dependencies Alert Banner (Liquid Glass Gradient) */}
      {cycles.length > 0 ? (
        <div className="liquid-glass-card border border-amber-400/30 rounded-2xl p-4 flex items-start gap-3 bg-amber-950/20">
          <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-comic font-bold text-amber-200">
              Circular Dependencies Detected ({cycles.length})
            </h4>
            <p className="text-xs text-amber-300/80 font-sans">
              These import cycles can cause runtime module loading issues and prevent clean bundler tree-shaking:
            </p>
            <ul className="mt-2 space-y-1 font-mono text-xs text-amber-200/90">
              {cycles.map((cycle, idx) => (
                <li key={idx} className="bg-black/60 px-3 py-1 rounded-lg border border-amber-400/20">
                  {cycle.join(' ➔ ')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="liquid-glass-card border border-emerald-400/20 rounded-2xl px-5 py-3.5 flex items-center gap-3 text-xs text-emerald-200 bg-emerald-950/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span className="font-comic font-bold text-sm">Clean Architecture</span>
          <span className="text-zinc-400 font-sans text-xs">
            • No circular dependencies detected. Architecture forms a clean Directed Acyclic Graph (DAG).
          </span>
        </div>
      )}

      {/* Primary Metric Cards (Liquid Glass + Pastel Accents) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Files - Pastel Sky */}
        <div className="liquid-glass-card rounded-2xl p-4 border-l-2 border-l-sky-300/80">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-comic font-bold text-zinc-300">Source Files</span>
            <Files className="w-4 h-4 text-sky-300" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight font-comic">
            {stats?.totalFiles?.toLocaleString() || 0}
          </div>
          <span className="text-[11px] text-zinc-500 font-sans">Indexed source files</span>
        </div>

        {/* LOC - Pastel Mint */}
        <div className="liquid-glass-card rounded-2xl p-4 border-l-2 border-l-emerald-300/80">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-comic font-bold text-zinc-300">Lines of Code</span>
            <FileCode className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight font-comic">
            {stats?.totalLinesOfCode?.toLocaleString() || 0}
          </div>
          <span className="text-[11px] text-zinc-500 font-sans">
            Avg {stats?.averageLinesPerFile || 0} LOC / file
          </span>
        </div>

        {/* Size - Pastel Lavender */}
        <div className="liquid-glass-card rounded-2xl p-4 border-l-2 border-l-purple-300/80">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-comic font-bold text-zinc-300">Codebase Size</span>
            <HardDrive className="w-4 h-4 text-purple-300" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight font-comic">
            {stats?.formattedTotalSize || '0 B'}
          </div>
          <span className="text-[11px] text-zinc-500 font-sans">Excluding node_modules</span>
        </div>

        {/* Graph Edges - Pastel Peach */}
        <div className="liquid-glass-card rounded-2xl p-4 border-l-2 border-l-amber-300/80">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-comic font-bold text-zinc-300">Dependency Links</span>
            <BarChart2 className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight font-comic">
            {graphData?.edges?.length?.toLocaleString() || 0}
          </div>
          <span className="text-[11px] text-zinc-500 font-sans">
            {graphData?.externalPackages?.length || 0} external packages
          </span>
        </div>
      </div>

      {/* Two-Column Breakdown: Languages & Largest Files */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Language Breakdown */}
        <div className="liquid-glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-comic font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-sky-300" />
            Language Distribution
          </h3>
          <div className="space-y-3">
            {languages.map(([lang, data]) => {
              const colors = {
                javascript: 'bg-yellow-300',
                typescript: 'bg-sky-300',
                tsx: 'bg-cyan-300',
                python: 'bg-emerald-300'
              };
              const color = colors[lang] || 'bg-zinc-400';

              return (
                <div key={lang} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize font-comic font-bold text-zinc-200">{lang}</span>
                    <span className="text-zinc-400 font-mono text-[11px]">
                      {data.filesCount} files ({data.percentageFiles}%) • {data.linesOfCode.toLocaleString()} LOC
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full ${color}`}
                      style={{ width: `${Math.max(2, data.percentageFiles)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Largest Files */}
        <div className="liquid-glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-comic font-bold text-white flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-emerald-300" />
            Largest Files (by Lines of Code)
          </h3>
          <div className="divide-y divide-white/5">
            {largestFiles.map((f, i) => (
              <div
                key={f.relativePath}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs group"
              >
                <div className="flex items-center gap-2 max-w-[70%] truncate">
                  <span className="text-zinc-500 font-mono text-[11px] w-4">{i + 1}.</span>
                  <span
                    onClick={() => onSelectFile(f.relativePath)}
                    className="text-zinc-300 group-hover:text-sky-300 cursor-pointer font-mono truncate transition-colors"
                  >
                    {f.relativePath}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 font-mono text-[11px]">{f.lineCount.toLocaleString()} LOC</span>
                  <button
                    onClick={() => onSelectFile(f.relativePath)}
                    className="opacity-0 group-hover:opacity-100 btn-solid btn-solid-zinc p-1.5 rounded-lg text-zinc-300 hover:text-white"
                    title="View file content"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
