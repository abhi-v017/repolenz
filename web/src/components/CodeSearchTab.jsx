import React, { useState } from 'react';
import { Search, FileText, ExternalLink } from 'lucide-react';
import { searchCode } from '../services/api';

export function CodeSearchTab({ onSelectFile }) {
  const [query, setQuery] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [extFilter, setExtFilter] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchCode(query, {
        isRegex,
        ext: extFilter || undefined
      });
      setMatches(data.matches || []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="liquid-glass-card rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-comic font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-300" />
            Code Search & Grep
          </h3>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Search raw source code text or regular expressions across all discovered repository files.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search text or pattern (e.g. PRAGMA, database.exec)..."
                className="w-full liquid-glass-input rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRegex(!isRegex)}
                className={`btn-solid text-xs px-3.5 py-2.5 rounded-xl transition-all ${
                  isRegex
                    ? 'btn-solid-emerald'
                    : 'btn-solid-zinc text-zinc-300'
                }`}
                title="Toggle regular expression mode"
              >
                .* Regex
              </button>

              <input
                type="text"
                value={extFilter}
                onChange={(e) => setExtFilter(e.target.value)}
                placeholder="Ext (.js,.ts)"
                className="w-28 liquid-glass-input rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none"
              />

              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="btn-solid btn-solid-emerald px-5 py-2.5 text-xs"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Results List */}
      <div className="liquid-glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center text-xs text-zinc-400 font-comic">
          <span>{hasSearched ? `Found ${matches.length} match${matches.length === 1 ? '' : 'es'}` : 'Enter a query and press Search'}</span>
          {loading && <span className="text-emerald-300 animate-pulse">Scanning files...</span>}
        </div>

        <div className="divide-y divide-white/5">
          {hasSearched && matches.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-comic">
              No code matches found for "{query}".
            </div>
          ) : (
            matches.map((m, idx) => (
              <div
                key={`${m.filePath}:${m.lineNumber}:${idx}`}
                onClick={() => onSelectFile(m.filePath, m.lineNumber)}
                className="p-4 hover:bg-white/[0.03] cursor-pointer group transition-colors space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-300" />
                    <span className="font-mono text-zinc-200 group-hover:text-emerald-300 transition-colors font-medium">
                      {m.filePath}
                    </span>
                    <span className="text-zinc-500 font-mono text-[11px]">Line {m.lineNumber}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Code snippet context */}
                <pre className="font-mono text-[11px] bg-black/70 p-3 rounded-xl border border-white/5 text-zinc-300 overflow-x-auto leading-relaxed">
                  {m.contextLines.map((line, lIdx) => (
                    <div
                      key={lIdx}
                      className={line.includes(m.lineContent) ? 'text-emerald-200 bg-emerald-950/40 -mx-1 px-1 rounded' : 'text-zinc-500'}
                    >
                      {line}
                    </div>
                  ))}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
