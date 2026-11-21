import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { GraphTab } from './components/GraphTab';
import { ImpactTab } from './components/ImpactTab';
import { SymbolsTab } from './components/SymbolsTab';
import { CodeSearchTab } from './components/CodeSearchTab';
import { QATab } from './components/QATab';
import { FileViewerModal } from './components/FileViewerModal';
import { RepoAccessModal } from './components/RepoAccessModal';
import {
  fetchStatus,
  fetchFiles,
  fetchGraph,
  fetchRecents,
  triggerIndex,
  selectRepository
} from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [repoStatus, setRepoStatus] = useState(null);
  const [filesData, setFilesData] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [recentRepos, setRecentRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState(null);

  // Modals state
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [viewingLine, setViewingLine] = useState(null);

  // Impact analysis target file
  const [impactTargetFile, setImpactTargetFile] = useState(null);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [status, files, graph, recentsData] = await Promise.all([
        fetchStatus(),
        fetchFiles(),
        fetchGraph(),
        fetchRecents().catch(() => ({ recents: [] }))
      ]);
      setRepoStatus(status);
      setFilesData(files);
      setGraphData(graph);
      setRecentRepos(recentsData.recents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleIndex = async () => {
    setIsIndexing(true);
    try {
      await triggerIndex();
      await loadAllData();
    } catch (err) {
      alert(`Indexing error: ${err.message}`);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSwitchRepo = async (newPath) => {
    setLoading(true);
    try {
      await selectRepository(newPath);
      await loadAllData();
    } catch (err) {
      alert(`Could not switch repository: ${err.message}`);
      setLoading(false);
    }
  };

  const handleSelectFile = (path, line = null) => {
    setViewingFile(path);
    setViewingLine(line);
  };

  const handleAnalyzeImpact = (path) => {
    setImpactTargetFile(path);
    setActiveTab('impact');
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 selection:bg-purple-900/50 selection:text-purple-200">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        repoStatus={repoStatus}
        onIndex={handleIndex}
        onOpenAccessModal={() => setIsAccessModalOpen(true)}
        isIndexing={isIndexing}
      />

      <main className={`flex-1 w-full ${activeTab === 'graph' ? 'p-2 md:p-3 max-w-none' : 'max-w-7xl mx-auto p-4 md:p-6'}`}>
        {loading ? (
          <div className="h-[65vh] flex flex-col items-center justify-center gap-3 text-zinc-400">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-comic font-bold text-zinc-300">
              Analyzing codebase and building dependency relationships...
            </span>
          </div>
        ) : error ? (
          <div className="h-[65vh] flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="text-rose-400 text-sm font-comic font-bold">Could not load repository data</div>
            <p className="text-xs text-zinc-400 max-w-md font-sans">{error}</p>
            <div className="flex gap-2.5">
              <button
                onClick={loadAllData}
                className="btn-solid btn-solid-plum px-4 py-2 text-xs"
              >
                Retry
              </button>
              <button
                onClick={() => setIsAccessModalOpen(true)}
                className="btn-solid btn-solid-zinc px-4 py-2 text-xs"
              >
                Change Repository
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                filesData={filesData}
                graphData={graphData}
                onSelectFile={handleSelectFile}
                onOpenAccessModal={() => setIsAccessModalOpen(true)}
              />
            )}
            {activeTab === 'graph' && (
              <GraphTab
                graphData={graphData}
                onSelectFile={handleSelectFile}
                onAnalyzeImpact={handleAnalyzeImpact}
              />
            )}
            {activeTab === 'impact' && (
              <ImpactTab
                initialFile={impactTargetFile}
                allFiles={filesData?.files}
                onSelectFile={handleSelectFile}
              />
            )}
            {activeTab === 'symbols' && (
              <SymbolsTab onSelectFile={handleSelectFile} />
            )}
            {activeTab === 'search' && (
              <CodeSearchTab onSelectFile={handleSelectFile} />
            )}
            {activeTab === 'qa' && (
              <QATab onSelectFile={handleSelectFile} />
            )}
          </>
        )}
      </main>

      {/* Repository Access / Import Modal */}
      <RepoAccessModal
        isOpen={isAccessModalOpen}
        onClose={() => setIsAccessModalOpen(false)}
        currentPath={repoStatus?.rootPath}
        recentRepos={recentRepos}
        onSelectPath={handleSwitchRepo}
        onRefresh={loadAllData}
      />

      {/* File Viewer Modal */}
      {viewingFile && (
        <FileViewerModal
          filePath={viewingFile}
          initialLine={viewingLine}
          onClose={() => {
            setViewingFile(null);
            setViewingLine(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
