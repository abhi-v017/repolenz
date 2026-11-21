import React, { useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import {
  Search,
  FileCode,
  ArrowRight,
  ArrowLeft,
  Activity,
  Layers,
  Eye,
  EyeOff,
  Filter,
  Sparkles,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  X
} from 'lucide-react';

/**
 * Architectural Category Classifier with Soft Pastel Colors (No Glow).
 */
export function getCategoryInfo(filePath) {
  const norm = filePath.toLowerCase();

  if (norm.includes('test') || norm.includes('spec') || norm.includes('fixture')) {
    return {
      name: 'Tests',
      color: 'slate',
      bgClass: 'bg-zinc-900/90',
      borderClass: 'border-zinc-700/60',
      badgeClass: 'bg-zinc-800 text-zinc-300',
      textAccent: 'text-zinc-400',
      dotColor: '#a1a1aa'
    };
  }
  if (norm.includes('core')) {
    return {
      name: 'Core Engine',
      color: 'sky',
      bgClass: 'bg-zinc-950/90',
      borderClass: 'border-sky-300/40',
      badgeClass: 'bg-sky-400/15 text-sky-200 border border-sky-400/25',
      textAccent: 'text-sky-300',
      dotColor: '#7dd3fc'
    };
  }
  if (norm.includes('server') || norm.includes('routes') || norm.includes('api')) {
    return {
      name: 'Server & API',
      color: 'purple',
      bgClass: 'bg-zinc-950/90',
      borderClass: 'border-purple-300/40',
      badgeClass: 'bg-purple-400/15 text-purple-200 border border-purple-400/25',
      textAccent: 'text-purple-300',
      dotColor: '#d8b4fe'
    };
  }
  if (norm.includes('storage') || norm.includes('db') || norm.includes('database')) {
    return {
      name: 'Storage & DB',
      color: 'amber',
      bgClass: 'bg-zinc-950/90',
      borderClass: 'border-amber-300/40',
      badgeClass: 'bg-amber-400/15 text-amber-200 border border-amber-400/25',
      textAccent: 'text-amber-300',
      dotColor: '#fde047'
    };
  }
  if (norm.includes('util') || norm.includes('helper')) {
    return {
      name: 'Utilities',
      color: 'mint',
      bgClass: 'bg-zinc-950/90',
      borderClass: 'border-emerald-300/40',
      badgeClass: 'bg-emerald-400/15 text-emerald-200 border border-emerald-400/25',
      textAccent: 'text-emerald-300',
      dotColor: '#6ee7b7'
    };
  }
  if (norm.includes('search') || norm.includes('qa')) {
    return {
      name: 'Search & QA',
      color: 'peach',
      bgClass: 'bg-zinc-950/90',
      borderClass: 'border-orange-300/40',
      badgeClass: 'bg-orange-400/15 text-orange-200 border border-orange-400/25',
      textAccent: 'text-orange-300',
      dotColor: '#fdba74'
    };
  }
  if (norm.includes('web') || norm.includes('component')) {
    return {
      name: 'Frontend',
      color: 'rose',
      bgClass: 'bg-zinc-950/90',
      borderClass: 'border-rose-300/40',
      badgeClass: 'bg-rose-400/15 text-rose-200 border border-rose-400/25',
      textAccent: 'text-rose-300',
      dotColor: '#f472b6'
    };
  }

  return {
    name: 'Module',
    color: 'blue',
    bgClass: 'bg-zinc-950/90',
    borderClass: 'border-blue-400/30',
    badgeClass: 'bg-blue-400/15 text-blue-200 border border-blue-400/25',
    textAccent: 'text-blue-300',
    dotColor: '#93c5fd'
  };
}

export function GraphTab({ graphData, onSelectFile, onAnalyzeImpact }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [hideTests, setHideTests] = useState(true);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('');
  const [focusNodeId, setFocusNodeId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const categories = [
    { id: '', label: 'All Layers', color: 'text-zinc-200' },
    { id: 'Core Engine', label: 'Core Engine', color: 'text-sky-300' },
    { id: 'Server & API', label: 'Server & API', color: 'text-purple-300' },
    { id: 'Storage & DB', label: 'Storage & DB', color: 'text-amber-300' },
    { id: 'Utilities', label: 'Utilities', color: 'text-emerald-300' },
    { id: 'Search & QA', label: 'Search & QA', color: 'text-orange-300' }
  ];

  // Base raw nodes formatted with Pastel Liquid Glass Cards
  const rawNodes = useMemo(() => {
    return (graphData?.nodes || []).map((node) => {
      const cat = getCategoryInfo(node.id);
      return {
        ...node,
        category: cat.name,
        data: {
          ...node.data,
          categoryInfo: cat,
          label: (
            <div className={`p-3 min-w-[160px] text-left rounded-xl transition-all ${cat.bgClass} ${cat.borderClass} border`}>
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-comic font-bold ${cat.badgeClass}`}>
                  {cat.name}
                </span>
                <span className="text-[9px] text-zinc-400 font-mono">
                  {node.data.lineCount} LOC
                </span>
              </div>
              <div className={`font-comic font-bold text-xs ${cat.textAccent} truncate`}>
                {node.data.label}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                {node.id}
              </div>
            </div>
          )
        }
      };
    });
  }, [graphData]);

  // Compute filtered nodes & edges based on:
  // 1. Focus Mode (show only focusNode and direct 1-hop dependencies)
  // 2. Hide Tests toggle
  // 3. Category Filter
  const { filteredNodes, filteredEdges } = useMemo(() => {
    let baseNodes = rawNodes;
    let baseEdges = graphData?.edges || [];

    // Filter out tests if hideTests is true
    if (hideTests) {
      baseNodes = baseNodes.filter((n) => !n.id.includes('test') && !n.id.includes('fixture'));
      const activeIds = new Set(baseNodes.map((n) => n.id));
      baseEdges = baseEdges.filter((e) => activeIds.has(e.source) && activeIds.has(e.target));
    }

    // Category Filter
    if (activeCategoryFilter) {
      baseNodes = baseNodes.filter((n) => n.category === activeCategoryFilter);
      const activeIds = new Set(baseNodes.map((n) => n.id));
      baseEdges = baseEdges.filter((e) => activeIds.has(e.source) && activeIds.has(e.target));
    }

    // FOCUS MODE: Isolate single node and direct 1-hop neighbors
    if (focusNodeId) {
      const centerNode = rawNodes.find((n) => n.id === focusNodeId);
      if (centerNode) {
        const directOutgoing = (graphData?.edges || []).filter((e) => e.source === focusNodeId);
        const directIncoming = (graphData?.edges || []).filter((e) => e.target === focusNodeId);

        const targetIds = new Set(directOutgoing.map((e) => e.target));
        const sourceIds = new Set(directIncoming.map((e) => e.source));
        const neighborhoodIds = new Set([focusNodeId, ...targetIds, ...sourceIds]);

        // Lay out in a clean 3-column flowchart: [Incoming Dependents] -> [Focused Node] -> [Outgoing Imports]
        const incomingNodes = rawNodes
          .filter((n) => sourceIds.has(n.id))
          .map((n, i) => ({ ...n, position: { x: 50, y: i * 140 } }));

        const outgoingNodes = rawNodes
          .filter((n) => targetIds.has(n.id))
          .map((n, i) => ({ ...n, position: { x: 650, y: i * 140 } }));

        const focusedCenter = {
          ...centerNode,
          position: { x: 350, y: Math.max(0, Math.floor((Math.max(incomingNodes.length, outgoingNodes.length) - 1) * 70)) }
        };

        const focusedNodeList = [focusedCenter, ...incomingNodes, ...outgoingNodes];
        const focusedEdgeList = (graphData?.edges || []).filter(
          (e) => neighborhoodIds.has(e.source) && neighborhoodIds.has(e.target)
        );

        return {
          filteredNodes: focusedNodeList,
          filteredEdges: focusedEdgeList
        };
      }
    }

    return {
      filteredNodes: baseNodes,
      filteredEdges: baseEdges
    };
  }, [rawNodes, graphData, hideTests, activeCategoryFilter, focusNodeId]);

  // Apply search highlight
  const displayNodes = useMemo(() => {
    if (!searchFilter.trim()) return filteredNodes;
    const term = searchFilter.toLowerCase();
    return filteredNodes.map((n) => {
      const matches = n.id.toLowerCase().includes(term);
      return {
        ...n,
        className: matches ? 'selected' : 'opacity-25'
      };
    });
  }, [filteredNodes, searchFilter]);

  const [nodes, setNodes, onNodesChange] = useNodesState(displayNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredEdges);

  // Sync state when filters change
  React.useEffect(() => {
    setNodes(displayNodes);
  }, [displayNodes]);

  React.useEffect(() => {
    setEdges(filteredEdges);
  }, [filteredEdges]);

  const onNodeClick = (_, node) => {
    const outgoing = (graphData?.edges || []).filter((e) => e.source === node.id);
    const incoming = (graphData?.edges || []).filter((e) => e.target === node.id);

    setSelectedNode({
      ...node,
      outgoing,
      incoming
    });
    setIsSidebarOpen(true);
  };

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-0'
          : 'h-[calc(100vh-80px)] md:h-[calc(100vh-86px)] rounded-2xl border border-zinc-800'
      } flex flex-col overflow-hidden bg-black`}
    >
      {/* Top Controls Toolbar */}
      <div className="liquid-glass border-b border-white/5 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Input */}
          <div className="flex items-center liquid-glass-input rounded-xl px-3 py-1.5 w-60">
            <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Find module in graph..."
              className="bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none w-full font-mono"
            />
          </div>

          {/* Layer Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCategoryFilter(c.id);
                  setFocusNodeId(null);
                }}
                className={`btn-solid text-xs px-3 py-1 rounded-xl transition-all ${
                  activeCategoryFilter === c.id
                    ? 'btn-solid-plum'
                    : 'btn-solid-zinc text-zinc-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* View Controls & Viewport Expansion */}
        <div className="flex items-center gap-2 flex-wrap">
          {focusNodeId && (
            <button
              onClick={() => setFocusNodeId(null)}
              className="btn-solid btn-solid-purple flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
            >
              <X className="w-3.5 h-3.5" />
              Exit Focus Mode
            </button>
          )}

          <button
            onClick={() => setHideTests(!hideTests)}
            className={`btn-solid flex items-center gap-1.5 px-3.5 py-1.5 text-xs ${
              hideTests ? 'btn-solid-plum' : 'btn-solid-zinc'
            }`}
            title="Hide test files to simplify architecture"
          >
            {hideTests ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{hideTests ? 'Tests Hidden' : 'Show Tests'}</span>
          </button>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="btn-solid btn-solid-zinc flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
            title={isSidebarOpen ? 'Hide sidebar inspector to expand canvas' : 'Open inspector details panel'}
          >
            {isSidebarOpen ? (
              <PanelRightClose className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5 text-purple-300" />
            )}
            <span className="hidden sm:inline">{isSidebarOpen ? 'Hide Inspector' : 'Show Inspector'}</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`btn-solid flex items-center gap-1.5 px-3.5 py-1.5 text-xs ${
              isFullscreen ? 'btn-solid-amber' : 'btn-solid-zinc'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Maximize graph to full-screen viewport'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-zinc-950" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-purple-300" />
            )}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Focus Mode Notification Pill */}
      {focusNodeId && (
        <div className="bg-purple-950/40 border-b border-purple-500/20 px-4 py-2 flex items-center justify-between text-xs text-purple-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="font-comic font-bold">
              Isolated View: <span className="font-mono text-purple-100">{focusNodeId}</span> and its immediate dependencies.
            </span>
          </div>
          <span className="text-[11px] text-purple-300/70">
            Flow: [Imported By (Left)] ➔ [Selected File (Center)] ➔ [Imports (Right)]
          </span>
        </div>
      )}

      {/* Main Graph Canvas Area */}
      <div className="flex-1 relative flex overflow-hidden">
        <div className="flex-1 relative h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            colorMode="dark"
          >
            <Background color="#27272a" gap={24} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n) => n.data?.categoryInfo?.dotColor || '#93c5fd'}
              maskColor="rgba(0, 0, 0, 0.85)"
              style={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </ReactFlow>

          {/* Bottom Pastel Legend Bar */}
          <div className="absolute bottom-3 left-4 z-10 liquid-glass rounded-xl px-3 py-1.5 flex items-center gap-3 text-[11px] font-comic font-bold text-zinc-400 border border-white/10 select-none">
            <span className="text-zinc-500">Legend:</span>
            <span className="flex items-center gap-1.5 text-sky-300">
              <span className="w-2 h-2 rounded-full bg-sky-300 inline-block" /> Core
            </span>
            <span className="flex items-center gap-1.5 text-purple-300">
              <span className="w-2 h-2 rounded-full bg-purple-300 inline-block" /> Server
            </span>
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" /> Storage
            </span>
            <span className="flex items-center gap-1.5 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block" /> Utils
            </span>
            <span className="flex items-center gap-1.5 text-orange-300">
              <span className="w-2 h-2 rounded-full bg-orange-300 inline-block" /> Search/QA
            </span>
          </div>
        </div>

        {/* Selected Node Sidebar Inspector */}
        {isSidebarOpen && (
          selectedNode ? (
            <aside className="w-80 md:w-88 border-l border-white/10 bg-zinc-950 p-4 flex flex-col justify-between overflow-y-auto shrink-0">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-[10px] font-comic font-bold px-2 py-0.5 rounded-full ${selectedNode.data?.categoryInfo?.badgeClass || 'bg-zinc-800'}`}>
                      {selectedNode.data?.categoryInfo?.name || 'Module'}
                    </span>
                    <h3 className="font-comic font-bold text-sm text-white mt-1.5 break-all">
                      {selectedNode.data.label}
                    </h3>
                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5 break-all">
                      {selectedNode.id}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="btn-solid btn-solid-zinc p-1.5 rounded-lg text-zinc-400 hover:text-white"
                    title="Close details"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="liquid-glass-card p-2.5 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[10px] font-comic">Lines of Code</span>
                    <span className="font-mono font-semibold text-zinc-100">
                      {selectedNode.data.lineCount}
                    </span>
                  </div>
                  <div className="liquid-glass-card p-2.5 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[10px] font-comic">Symbols</span>
                    <span className="font-mono font-semibold text-zinc-100">
                      {selectedNode.data.symbolCount || 0}
                    </span>
                  </div>
                </div>

                {/* Focus Button */}
                <button
                  onClick={() => setFocusNodeId(selectedNode.id)}
                  className="btn-solid btn-solid-purple w-full py-2.5 text-xs flex items-center justify-center gap-2"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Focus on This Module (Isolate)
                </button>

                {/* Outgoing Dependencies */}
                <div className="space-y-2">
                  <h4 className="text-xs font-comic font-bold text-zinc-200 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                    What this imports ({selectedNode.outgoing.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 text-xs">
                    {selectedNode.outgoing.length === 0 ? (
                      <span className="text-zinc-500 text-[11px] font-comic">No internal dependencies</span>
                    ) : (
                      selectedNode.outgoing.map((e) => (
                        <div
                          key={e.id}
                          onClick={() => {
                            const target = rawNodes.find((n) => n.id === e.target);
                            if (target) onNodeClick(null, target);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 font-mono text-[11px] text-zinc-200 truncate cursor-pointer transition-colors"
                        >
                          {e.target}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Incoming Dependents */}
                <div className="space-y-2">
                  <h4 className="text-xs font-comic font-bold text-zinc-200 flex items-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
                    Files that import this ({selectedNode.incoming.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 text-xs">
                    {selectedNode.incoming.length === 0 ? (
                      <span className="text-zinc-500 text-[11px] font-comic">No files import this</span>
                    ) : (
                      selectedNode.incoming.map((e) => (
                        <div
                          key={e.id}
                          onClick={() => {
                            const src = rawNodes.find((n) => n.id === e.source);
                            if (src) onNodeClick(null, src);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 font-mono text-[11px] text-zinc-200 truncate cursor-pointer transition-colors"
                        >
                          {e.source}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-white/10 mt-4">
                <button
                  onClick={() => onAnalyzeImpact(selectedNode.id)}
                  className="btn-solid btn-solid-plum w-full py-2.5 text-xs flex items-center justify-center gap-2"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Analyze Change Blast Radius
                </button>
                <button
                  onClick={() => onSelectFile(selectedNode.id)}
                  className="btn-solid btn-solid-zinc w-full py-2.5 text-xs flex items-center justify-center gap-2"
                >
                  <FileCode className="w-3.5 h-3.5 text-purple-300" />
                  View Source Code
                </button>
              </div>
            </aside>
          ) : (
            <aside className="w-72 md:w-80 border-l border-white/10 bg-zinc-950/60 p-4 flex flex-col justify-center items-center text-center text-zinc-400 text-xs font-comic shrink-0">
              <Layers className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="max-w-[200px] text-zinc-400 leading-relaxed">
                Click on any module in the canvas to isolate its dependencies or inspect its connections.
              </p>
            </aside>
          )
        )}
      </div>
    </div>
  );
}
