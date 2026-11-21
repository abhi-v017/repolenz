import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, FileCode, Code2 } from 'lucide-react';
import { fetchFileContent } from '../services/api';

export function FileViewerModal({ filePath, initialLine, onClose }) {
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const lineRef = useRef(null);

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    fetchFileContent(filePath)
      .then((data) => {
        setFileData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [filePath]);

  useEffect(() => {
    if (initialLine && lineRef.current) {
      lineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [fileData, initialLine]);

  const handleCopy = () => {
    if (fileData?.content) {
      navigator.clipboard.writeText(fileData.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lines = fileData?.content ? fileData.content.split(/\r\n|\r|\n/) : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="liquid-glass-card border border-zinc-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden bg-zinc-950">
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2.5 max-w-[80%] truncate">
            <FileCode className="w-4 h-4 text-purple-300 shrink-0" />
            <span className="font-mono text-sm font-semibold text-white truncate">
              {filePath}
            </span>
            {fileData && (
              <span className="text-xs text-zinc-400 font-mono">
                ({fileData.lineCount} lines)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="btn-solid btn-solid-zinc p-2 text-zinc-300 hover:text-white rounded-lg"
              title="Copy file contents"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="btn-solid btn-solid-zinc p-2 text-zinc-300 hover:text-white rounded-lg"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-zinc-400 animate-pulse font-comic">
              Loading file contents...
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-xs text-rose-400 p-6 font-comic">
              {error}
            </div>
          ) : (
            <>
              {/* Code viewer with line numbers */}
              <div className="flex-1 overflow-auto bg-black font-mono text-xs p-4 flex select-text">
                {/* Line numbers */}
                <div className="select-none text-zinc-600 text-right pr-4 font-mono leading-relaxed shrink-0">
                  {lines.map((_, i) => (
                    <div key={i + 1} className="h-5">
                      {i + 1}
                    </div>
                  ))}
                </div>

                {/* Code text */}
                <div className="flex-1 overflow-x-auto text-zinc-200 leading-relaxed">
                  {lines.map((line, i) => {
                    const lineNum = i + 1;
                    const isTarget = initialLine === lineNum;
                    return (
                      <div
                        key={lineNum}
                        ref={isTarget ? lineRef : null}
                        className={`h-5 whitespace-pre px-1.5 rounded ${
                          isTarget ? 'bg-purple-500/25 text-purple-200 border-l-2 border-purple-400' : ''
                        }`}
                      >
                        {line || ' '}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side panel: File Symbols */}
              {fileData.symbols?.length > 0 && (
                <div className="w-64 border-l border-white/5 bg-zinc-950/60 p-4 overflow-y-auto hidden md:block">
                  <h4 className="text-xs font-comic font-bold text-zinc-300 flex items-center gap-1.5 mb-3">
                    <Code2 className="w-3.5 h-3.5 text-sky-300" />
                    File Symbols ({fileData.symbols.length})
                  </h4>
                  <div className="space-y-1 text-xs font-mono">
                    {fileData.symbols.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          const el = document.querySelector(`[data-line="${s.start_line}"]`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-zinc-300 hover:text-white transition-colors truncate"
                      >
                        <span className="text-[10px] text-sky-300 mr-1.5 font-comic uppercase font-bold">
                          [{s.kind}]
                        </span>
                        {s.name}
                        <span className="text-[10px] text-zinc-500 ml-1">:{s.start_line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
