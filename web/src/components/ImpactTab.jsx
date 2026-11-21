import React, { useState, useEffect } from 'react';
import { Activity, ArrowRight, FileCode, CheckCircle2 } from 'lucide-react';
import { fetchImpact } from '../services/api';

export function ImpactTab({ initialFile, allFiles, onSelectFile }) {
  const [targetFile, setTargetFile] = useState(initialFile || '');
  const [impactResult, setImpactResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialFile) {
      setTargetFile(initialFile);
      runImpact(initialFile);
    }
  }, [initialFile]);

  const runImpact = async (fileToTest) => {
    if (!fileToTest) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchImpact(fileToTest);
      setImpactResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (e) => {
    const file = e.target.value;
    setTargetFile(file);
    runImpact(file);
  };

  return (
    <div className="space-y-6">
      {/* File Selector Card */}
      <div className="liquid-glass-card rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-comic font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-300" />
            Change Impact Analysis (Blast Radius)
          </h3>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Select a module to see which downstream files depend on it directly or transitively.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select
            value={targetFile}
            onChange={handleSelectChange}
            className="w-full sm:w-96 liquid-glass-input text-zinc-200 text-xs rounded-xl px-3.5 py-2.5 font-mono focus:outline-none"
          >
            <option value="" className="bg-zinc-950 text-zinc-400">-- Select a file to evaluate impact --</option>
            {(allFiles || []).map((f) => (
              <option key={f.relativePath} value={f.relativePath} className="bg-zinc-950 text-zinc-200">
                {f.relativePath}
              </option>
            ))}
          </select>

          {targetFile && (
            <button
              onClick={() => runImpact(targetFile)}
              disabled={loading}
              className="btn-solid btn-solid-plum px-4 py-2.5 text-xs"
            >
              {loading ? 'Evaluating...' : 'Re-Evaluate Impact'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="liquid-glass-card border border-rose-400/30 text-rose-300 text-xs p-3.5 rounded-xl bg-rose-950/20">
          {error}
        </div>
      )}

      {/* Results View */}
      {impactResult && (
        <div className="space-y-6">
          {/* Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="liquid-glass-card rounded-2xl p-4">
              <span className="text-xs font-comic font-bold text-zinc-400 block mb-1">Target File</span>
              <span className="text-sm font-mono font-semibold text-white truncate block" title={impactResult.targetFile}>
                {impactResult.targetFile}
              </span>
            </div>

            <div className="liquid-glass-card rounded-2xl p-4 border-l-2 border-l-sky-300">
              <span className="text-xs font-comic font-bold text-zinc-400 block mb-1">Total Impacted Files</span>
              <span className="text-2xl font-bold font-comic text-sky-300">
                {impactResult.totalImpacted}
              </span>
            </div>

            <div className="liquid-glass-card rounded-2xl p-4 border-l-2 border-l-amber-300">
              <span className="text-xs font-comic font-bold text-zinc-400 block mb-1">Max Blast Radius Depth</span>
              <span className="text-2xl font-bold font-comic text-amber-300">
                Depth {impactResult.maxDepth}
              </span>
            </div>
          </div>

          {/* Impact list */}
          <div className="liquid-glass-card rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-comic font-bold text-zinc-200">
              Downstream Dependent Modules ({impactResult.impactedFiles.length})
            </h4>

            {impactResult.impactedFiles.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-300 py-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-comic font-bold">Zero downstream dependents found. Modifying this file carries zero risk to other internal modules.</span>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {impactResult.impactedFiles.map((item) => (
                  <div key={item.file} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs group">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-comic font-bold px-2 py-0.5 rounded-full ${
                          item.depth === 1 ? 'bg-amber-400/20 text-amber-200 border border-amber-400/30' : 'bg-white/5 text-zinc-400 border border-white/5'
                        }`}>
                          Depth {item.depth}
                        </span>
                        <span
                          onClick={() => onSelectFile(item.file)}
                          className="font-mono text-zinc-200 group-hover:text-sky-300 cursor-pointer font-medium"
                        >
                          {item.file}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        Imported directly via: {item.importedBy.join(', ')}
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectFile(item.file)}
                      className="opacity-0 group-hover:opacity-100 btn-solid btn-solid-zinc p-1.5 rounded-lg text-zinc-300 hover:text-white"
                      title="View source"
                    >
                      <FileCode className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
