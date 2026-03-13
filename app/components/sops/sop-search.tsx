'use client';

import { useState } from 'react';

interface SearchResult {
  name: string;
  content: string;
  distance: number;
}

export function SOPSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/agi-sops/search?query=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      // Silent error handling - show empty results
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search SOPs..."
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Results ({results.length})</h3>
          {results.map((result, index) => (
            <div key={index} className="rounded-md border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">{result.name}</h4>
                <span className="text-xs text-gray-500">Distance: {result.distance?.toFixed(3)}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{result.content?.slice(0, 200)}...</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
