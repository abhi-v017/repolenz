/**
 * RepoMap API Client
 */

const API_BASE = '/api';

export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/repository/status`);
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.statusText}`);
  return res.json();
}

export async function fetchRecents() {
  const res = await fetch(`${API_BASE}/repository/recents`);
  if (!res.ok) throw new Error(`Failed to fetch recents: ${res.statusText}`);
  return res.json();
}

export async function fetchFiles() {
  const res = await fetch(`${API_BASE}/repository/files`);
  if (!res.ok) throw new Error(`Failed to fetch files: ${res.statusText}`);
  return res.json();
}

export async function fetchFileContent(filePath) {
  const params = new URLSearchParams({ path: filePath });
  const res = await fetch(`${API_BASE}/repository/file?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch file: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchGraph() {
  const res = await fetch(`${API_BASE}/graph`);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.statusText}`);
  return res.json();
}

export async function fetchImpact(filePath) {
  const params = new URLSearchParams({ file: filePath });
  const res = await fetch(`${API_BASE}/graph/impact?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch impact: ${res.statusText}`);
  return res.json();
}

export async function searchSymbols(query, options = {}) {
  const params = new URLSearchParams({ q: query || '' });
  if (options.kind) params.set('kind', options.kind);
  if (typeof options.isExported === 'boolean') params.set('exported', String(options.isExported));
  if (options.file) params.set('file', options.file);

  const res = await fetch(`${API_BASE}/search/symbols?${params.toString()}`);
  if (!res.ok) throw new Error(`Symbol search failed: ${res.statusText}`);
  return res.json();
}

export async function searchCode(query, options = {}) {
  const params = new URLSearchParams({ q: query });
  if (options.isRegex) params.set('regex', 'true');
  if (options.ext) params.set('ext', options.ext);

  const res = await fetch(`${API_BASE}/search/code?${params.toString()}`);
  if (!res.ok) throw new Error(`Code search failed: ${res.statusText}`);
  return res.json();
}

export async function triggerIndex() {
  const res = await fetch(`${API_BASE}/repository/index`, { method: 'POST' });
  if (!res.ok) throw new Error(`Indexing failed: ${res.statusText}`);
  return res.json();
}

export async function askQuestion(question) {
  const res = await fetch(`${API_BASE}/qa/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to answer question`);
  }
  return res.json();
}

export async function selectRepository(targetPath) {
  const res = await fetch(`${API_BASE}/repository/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: targetPath })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to switch repository`);
  }
  return res.json();
}
