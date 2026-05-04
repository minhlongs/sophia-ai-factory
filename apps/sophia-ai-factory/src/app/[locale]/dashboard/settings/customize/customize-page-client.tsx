'use client';

/**
 * Client shell for the Customize Settings page.
 * Sidebar navigation switches between namespace sub-panels.
 * Most panels are placeholder stubs — feature agents will replace them.
 * @module app/[locale]/dashboard/settings/customize/customize-page-client
 */

import { useState, useRef } from 'react';

type NavItem = {
  id: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'branding', label: 'Branding' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'geo', label: 'Geo Rules' },
  { id: 'cron', label: 'Cron / Scheduling' },
  { id: 'channels', label: 'Channels' },
  { id: 'mcp', label: 'MCP Registry' },
  { id: 'export-import', label: 'Export / Import' },
];

function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
      <p className="text-sm font-medium">{name}</p>
      <p className="mt-1 text-xs">Coming soon — Agent will fill this panel.</p>
    </div>
  );
}

function ExportImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: unknown[] } | null>(null);

  async function handleExport() {
    const res = await fetch('/api/v1/settings/export');
    if (!res.ok) { alert('Export failed'); return; }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = cd.match(/filename="([^"]+)"/)?.[1] ?? 'settings.json';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const body = JSON.parse(text);
      const res = await fetch('/api/v1/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { imported: number; errors: unknown[] };
      setImportResult(data);
    } catch {
      alert('Import failed — invalid JSON file');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Export Settings</h3>
        <p className="mt-1 text-xs text-gray-500">Download all your settings as a JSON file.</p>
        <button
          onClick={handleExport}
          className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          Download JSON
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700">Import Settings</h3>
        <p className="mt-1 text-xs text-gray-500">Upload a previously exported JSON file to restore settings.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImport}
          disabled={importing}
          className="mt-3 block text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700"
        />
        {importing && <p className="mt-2 text-xs text-gray-400">Importing…</p>}
        {importResult && (
          <p className="mt-2 text-xs text-green-600">
            Imported {importResult.imported} namespace(s).
            {importResult.errors.length > 0 && ` ${importResult.errors.length} error(s) — check console.`}
          </p>
        )}
      </div>
    </div>
  );
}

export function CustomizePageClient() {
  const [active, setActive] = useState<string>('branding');

  function renderPanel() {
    switch (active) {
      case 'export-import': return <ExportImportPanel />;
      default: return <PlaceholderPanel name={NAV_ITEMS.find(n => n.id === active)?.label ?? active} />;
    }
  }

  return (
    <div className="flex gap-6">
      {/* sidebar */}
      <nav className="w-48 shrink-0">
        <ul className="space-y-1">
          {NAV_ITEMS.map(item => (
            <li key={item.id}>
              <button
                onClick={() => setActive(item.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  active === item.id
                    ? 'bg-indigo-100 font-medium text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* panel */}
      <main className="flex-1">{renderPanel()}</main>
    </div>
  );
}
