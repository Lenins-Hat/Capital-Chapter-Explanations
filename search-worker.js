// Web Worker for off-thread full-text search across all 110 chapters of Das Kapital
self.window = self;

let isReady = false;
let isLoading = false;

function loadSearchData() {
  if (isReady || isLoading) return;
  isLoading = true;
  try {
    importScripts('search-data.js');
    if (self.CHAPTERS_SEARCH_DATA) {
      isReady = true;
      self.postMessage({ type: 'ready', count: self.CHAPTERS_SEARCH_DATA.length });
    } else {
      self.postMessage({ type: 'error', message: 'CHAPTERS_SEARCH_DATA not found in search-data.js' });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.toString() });
  } finally {
    isLoading = false;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function performSearch(query, activeVolume, activeConcept, searchId) {
  if (!isReady) {
    loadSearchData();
    if (!isReady) {
      self.postMessage({ type: 'error', searchId, message: 'Search data still loading' });
      return;
    }
  }

  const q = (query || '').trim();
  if (q.length < 2) {
    self.postMessage({ type: 'results', searchId, query: q, totalOccurrences: 0, matchedChapters: [] });
    return;
  }

  const qRegex = new RegExp(escapeRegExp(q), 'gi');
  let totalOccurrences = 0;
  const matchedChapters = [];

  const data = self.CHAPTERS_SEARCH_DATA || [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (activeVolume && activeVolume !== 'all' && item.volume !== activeVolume) continue;
    if (activeConcept && activeConcept !== 'all' && item.tags && !item.tags.includes(activeConcept)) continue;

    const text = item.text || '';
    const matches = [...text.matchAll(qRegex)];
    if (matches.length > 0) {
      totalOccurrences += matches.length;

      // Extract up to 2 context snippets
      const snippets = [];
      const numSnippets = Math.min(matches.length, 2);
      for (let j = 0; j < numSnippets; j++) {
        const m = matches[j];
        const start = Math.max(0, m.index - 65);
        const end = Math.min(text.length, m.index + m[0].length + 75);
        let snippet = text.substring(start, end).trim();
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        snippets.push(snippet);
      }

      matchedChapters.push({
        volume: item.volume,
        title: item.title,
        subtitle: item.subtitle,
        path: item.path,
        count: matches.length,
        snippets: snippets
      });
    }
  }

  matchedChapters.sort((a, b) => b.count - a.count);

  self.postMessage({
    type: 'results',
    searchId,
    query: q,
    totalOccurrences,
    matchedChapters
  });
}

self.onmessage = function(e) {
  const data = e.data || {};
  if (data.type === 'init') {
    loadSearchData();
  } else if (data.type === 'search') {
    performSearch(data.query, data.activeVolume, data.activeConcept, data.searchId);
  }
};
