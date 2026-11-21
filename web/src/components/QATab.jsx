import React, { useState } from 'react';
import {
  MessageSquareCode,
  Send,
  FileCode,
  Sparkles,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { askQuestion } from '../services/api';

export function QATab({ onSelectFile }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([
    {
      type: 'assistant',
      text: 'Ask any architectural or navigational question about this repository. All answers are strictly grounded in indexed code with exact file paths and line numbers.'
    }
  ]);
  const [loading, setLoading] = useState(false);

  const suggestedQuestions = [
    'Where is file filtering implemented and what is ignored?',
    'Which functions detect circular dependencies?',
    'How does incremental indexing skip unchanged files?',
    'Where is the SQLite database schema defined?'
  ];

  const handleAsk = async (textToAsk) => {
    const q = textToAsk || question;
    if (!q.trim() || loading) return;

    const userMessage = { type: 'user', text: q };
    setHistory((prev) => [...prev, userMessage]);
    setQuestion('');
    setLoading(true);

    try {
      const data = await askQuestion(q);
      const assistantMessage = {
        type: 'assistant',
        text: data.answer,
        citations: data.citations || [],
        hasEvidence: data.hasSufficientEvidence,
        durationMs: data.durationMs
      };
      setHistory((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        {
          type: 'assistant',
          text: `Error: ${err.message}`,
          isError: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="liquid-glass-card rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-comic font-bold text-white flex items-center gap-2">
            <MessageSquareCode className="w-4 h-4 text-purple-300" />
            Source-Grounded Codebase Q&A
          </h3>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Answers are synthesized strictly from AST-extracted code symbols, imports, and file snippets. Zero hallucination.
          </p>
        </div>

        {/* Suggested Queries */}
        <div className="space-y-2">
          <span className="text-[11px] font-comic font-bold text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Suggested Questions:
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleAsk(sq)}
                className="btn-solid btn-solid-zinc text-xs px-3.5 py-1.5 rounded-xl text-left font-comic text-zinc-200"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="liquid-glass-card rounded-2xl overflow-hidden flex flex-col min-h-[440px]">
        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          {history.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col space-y-2 ${
                msg.type === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              {msg.type === 'user' ? (
                <div className="bg-[#21122e] border border-[#3d2153] text-purple-100 text-xs px-4 py-2.5 rounded-2xl rounded-tr-none max-w-xl font-sans">
                  {msg.text}
                </div>
              ) : (
                <div className="liquid-glass rounded-2xl rounded-tl-none p-4 max-w-3xl space-y-3 text-xs leading-relaxed text-zinc-200 border border-white/10">
                  {/* Answer Text */}
                  <div className="whitespace-pre-line font-sans space-y-2">
                    {msg.text}
                  </div>

                  {/* Citations Box */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-comic font-bold text-zinc-400 uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        Verified Source Citations ({msg.citations.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((c, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => onSelectFile(c.filePath, c.line)}
                            className="btn-solid btn-solid-zinc flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono text-sky-300 hover:text-white group"
                            title="Click to jump to source code"
                          >
                            <FileCode className="w-3 h-3 text-zinc-400 group-hover:text-sky-300" />
                            <span>
                              {c.filePath}:{c.line}
                            </span>
                            <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.durationMs !== undefined && (
                    <div className="text-[10px] text-zinc-500 font-mono pt-1">
                      Retrieved and verified in {msg.durationMs}ms
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2.5 text-xs text-sky-300 animate-pulse p-2 font-comic font-bold">
              <Sparkles className="w-4 h-4 animate-spin text-purple-300" />
              Searching indexed codebase and extracting source citations...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="p-3 bg-black/60 border-t border-white/5 flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the repository (e.g. Where is file filtering implemented?)..."
            className="flex-1 liquid-glass-input rounded-xl px-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none font-sans"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn-solid btn-solid-purple flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl"
          >
            <Send className="w-3.5 h-3.5" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
