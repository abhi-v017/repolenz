import React, { useState, useEffect } from 'react';
import { Search, Code2, ExternalLink } from 'lucide-react';
import { searchSymbols } from '../services/api';

export function SymbolsTab({ onSelectFile }) {
  const [query, setQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState('');
  const [onlyExported, setOnlyExported] = useState(false);
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(false);

  const kinds = [
    { id: '', label: 'All Kinds' },
    { id: 'function', label: 'Functions', color: 'text-sky-300' },
    { id: 'class', label: 'Classes', color: 'text-purple-300' },
    { id: 'method', label: 'Methods', color: 'text-emerald-300' },
    { id: 'interface', label: 'Interfaces', color: 'text-amber-300' },
    { id: 'type', label: 'Types', color: 'text-rose-300' }
  ];

  const runSearch = async () => {
    setLoading(true);
    try {
      const data = await searchSymbols(query, {
        kind: selectedKind || undefined,
        isExported: onlyExported || undefined
      });
      setSymbols(data.symbols || []);
    } catch {
      setSymbols([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runSearch();
    }, 200);
    return () => clearTimeout(timer);
  }, [query, selectedKind, onlyExported]);

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="liquid-glass-card rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-comic font-bold text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-purple-300" />
            Symbol Explorer
          </h3>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Search functions, classes, methods, and interfaces extracted via Abstract Syntax Trees.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol by name (e.g. login, Parser, UserService)..."
              className="w-full liquid-glass-input rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-comic font-bold text-zinc-300 cursor-pointer liquid-glass-input px-4 py-2.5 rounded-xl select-none">
            <input
              type="checkbox"
              checked={onlyExported}
              onChange={(e) => setOnlyExported(e.target.checked)}
              className="rounded bg-black border-white/20 text-purple-400 focus:ring-0"
            />
            Exported Only
          </label>
        </div>

        {/* Kind Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {kinds.map((k) => (
            <button
              key={k.id}
              onClick={() => setSelectedKind(k.id)}
              className={`btn-solid text-xs px-3.5 py-1.5 rounded-xl transition-all ${
                selectedKind === k.id
                  ? 'btn-solid-purple'
                  : 'btn-solid-zinc text-zinc-300'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* Symbols Table */}
      <div className="liquid-glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center text-xs text-zinc-400 font-comic">
          <span>Found {symbols.length} symbol{symbols.length === 1 ? '' : 's'}</span>
          {loading && <span className="text-purple-300 animate-pulse">Searching symbols...</span>}
        </div>

        <div className="divide-y divide-white/5">
          {symbols.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-comic">
              No symbols matched your search criteria.
            </div>
          ) : (
            symbols.map((sym) => {
              const kindColors = {
                function: 'bg-sky-500/15 text-sky-200 border-sky-400/25',
                method: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/25',
                class: 'bg-purple-500/15 text-purple-200 border-purple-400/25',
                interface: 'bg-amber-500/15 text-amber-200 border-amber-400/25',
                type: 'bg-rose-500/15 text-rose-200 border-rose-400/25',
                variable: 'bg-zinc-800 text-zinc-300 border-zinc-700/50'
              };
              const color = kindColors[sym.kind] || 'bg-zinc-800 text-zinc-300';

              return (
                <div
                  key={sym.id}
                  onClick={() => onSelectFile(sym.relative_path, sym.start_line)}
                  className="px-5 py-3 flex items-center justify-between text-xs hover:bg-white/[0.04] cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-comic font-bold px-2 py-0.5 rounded-full border uppercase ${color}`}>
                      {sym.kind}
                    </span>
                    <span className="font-comic font-bold text-sm text-zinc-100 group-hover:text-purple-300 transition-colors">
                      {sym.parent_symbol_name ? `${sym.parent_symbol_name}.${sym.name}` : sym.name}
                    </span>
                    {sym.is_exported && (
                      <span className="text-[10px] text-amber-300 font-comic font-bold">★ exported</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {sym.relative_path}:{sym.start_line}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
