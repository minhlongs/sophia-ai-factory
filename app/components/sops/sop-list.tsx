'use client';

import { useEffect, useState } from 'react';

interface SOP {
  name: string;
  version: string;
  description: string;
  steps_count: number;
}

export function SOPList() {
  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agi-sops/sops')
      .then((res) => res.json())
      .then((data) => {
        setSops(data.sops || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Loading SOPs...</div>;
  if (error) return <div className="text-sm text-red-500">Error: {error}</div>;
  if (sops.length === 0) return <div className="text-sm text-gray-500">No SOPs found</div>;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Version</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Description</th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Steps</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sops.map((sop) => (
            <tr key={`${sop.name}-${sop.version}`} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">{sop.name}</td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{sop.version}</td>
              <td className="px-4 py-2 text-sm text-gray-500">{sop.description}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-gray-500">{sop.steps_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
