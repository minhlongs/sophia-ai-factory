'use client';

/**
 * Client shell for the Customize Settings page.
 * Sidebar navigation switches between namespace sub-panels.
 * @module app/[locale]/dashboard/settings/customize/customize-page-client
 */

import { useState, useRef, useEffect } from 'react';

type NavItem = { id: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { id: 'branding', label: 'Branding' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'geo', label: 'Geo Rules' },
  { id: 'cron', label: 'Cron / Scheduling' },
  { id: 'channels', label: 'Channels' },
  { id: 'mcp', label: 'MCP Registry' },
  { id: 'storage', label: 'Storage (R2 BYOS)' },
  { id: 'export-import', label: 'Export / Import' },
];

const CHANNEL_PROVIDERS = ['youtube', 'tiktok', 'instagram', 'pinterest', 'linkedin', 'zalo'] as const;
type ChannelProvider = typeof CHANNEL_PROVIDERS[number];

interface ChannelTemplate {
  titleTemplate?: string;
  captionTemplate?: string;
  hashtagsTemplate?: string;
  ctaTemplate?: string;
}

interface McpServer {
  name: string;
  url: string;
  authType: 'none' | 'bearer' | 'header';
  authValue?: string;
  enabled: boolean;
  description?: string;
}

function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
      <p className="text-sm font-medium">{name}</p>
      <p className="mt-1 text-xs">Coming soon — Agent will fill this panel.</p>
    </div>
  );
}

// ---------- Channels Panel ----------

const SAMPLE_VARS: Record<string, string> = {
  productName: 'Acme Widget',
  commission: '15',
  network: 'ShareASale',
  cookieDays: '30',
  ctaUrl: 'https://acme.io/affiliate',
  tenantName: 'My Store',
};

function renderPreview(template: string): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, key: string) =>
    SAMPLE_VARS[key] ?? `{${key}}`,
  );
}

function ChannelsPanel() {
  const [activeChannel, setActiveChannel] = useState<ChannelProvider>('youtube');
  const [templates, setTemplates] = useState<Partial<Record<ChannelProvider, ChannelTemplate>>>({});
  const [preferTemplateOverAI, setPreferTemplateOverAI] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateField(channel: ChannelProvider, field: keyof ChannelTemplate, value: string) {
    setTemplates(prev => ({
      ...prev,
      [channel]: { ...(prev[channel] ?? {}), [field]: value },
    }));
    setSaved(false);
  }

  function handlePreview() {
    const tpl = templates[activeChannel];
    const caption = tpl?.captionTemplate ?? '';
    setPreview(caption ? renderPreview(caption) : '(no caption template set)');
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/v1/settings/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates, preferTemplateOverAI }),
      });
      setSaved(true);
    } catch {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  }

  const tpl = templates[activeChannel] ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Channel Templates</h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={preferTemplateOverAI}
            onChange={e => { setPreferTemplateOverAI(e.target.checked); setSaved(false); }}
            className="rounded"
          />
          Prefer template over AI
        </label>
      </div>

      <div className="flex gap-1 flex-wrap">
        {CHANNEL_PROVIDERS.map(ch => (
          <button
            key={ch}
            onClick={() => { setActiveChannel(ch); setPreview(null); }}
            className={`rounded px-2 py-1 text-xs capitalize ${
              activeChannel === ch
                ? 'bg-indigo-600 text-white'
                : 'bg-muted-100 text-muted-foreground hover:bg-muted-200'
            }`}
          >
            {ch}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {(['titleTemplate', 'captionTemplate', 'hashtagsTemplate', 'ctaTemplate'] as const).map(field => (
          <div key={field}>
            <label className="block text-xs font-medium text-muted-foreground capitalize">
              {field.replace('Template', ' Template')}
            </label>
            <textarea
              value={tpl[field] ?? ''}
              onChange={e => updateField(activeChannel, field, e.target.value)}
              rows={field === 'captionTemplate' ? 3 : 2}
              placeholder="Use {productName}, {commission}, {network}, {ctaUrl}, {tenantName}…"
              className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
        >
          Preview Caption
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {preview && (
        <div className="rounded bg-muted-50 p-3 text-xs text-foreground">
          <p className="font-medium text-muted-foreground mb-1">Preview ({activeChannel}):</p>
          <p className="whitespace-pre-wrap">{preview}</p>
        </div>
      )}
    </div>
  );
}

// ---------- MCP Registry Panel ----------

function McpPanel() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [form, setForm] = useState<Partial<McpServer>>({ authType: 'none', enabled: true });
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function handleFormChange(field: keyof McpServer, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleAdd() {
    if (!form.name || !form.url) { alert('Name and URL are required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/integrations/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { alert('Failed to add server'); return; }
      setServers(prev => {
        const idx = prev.findIndex(s => s.name === form.name);
        const newServer = form as McpServer;
        if (idx >= 0) { const next = [...prev]; next[idx] = newServer; return next; }
        return [...prev, newServer];
      });
      setForm({ authType: 'none', enabled: true });
    } catch {
      alert('Error adding server');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name: string) {
    await fetch('/api/v1/integrations/mcp', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setServers(prev => prev.filter(s => s.name !== name));
  }

  async function handleTest(name: string) {
    setTesting(name);
    try {
      const res = await fetch('/api/v1/integrations/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      setTestResult(prev => ({ ...prev, [name]: data.ok ? 'reachable' : (data.error ?? 'error') }));
    } catch {
      setTestResult(prev => ({ ...prev, [name]: 'network error' }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">Custom MCP Servers</h3>

      {servers.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-1 pr-4">Name</th>
              <th className="pb-1 pr-4">URL</th>
              <th className="pb-1 pr-4">Auth</th>
              <th className="pb-1 pr-4">Status</th>
              <th className="pb-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers.map(s => (
              <tr key={s.name} className="border-b last:border-0">
                <td className="py-1.5 pr-4 font-medium">{s.name}</td>
                <td className="py-1.5 pr-4 text-muted-foreground truncate max-w-[160px]">{s.url}</td>
                <td className="py-1.5 pr-4">{s.authType}</td>
                <td className="py-1.5 pr-4">
                  {testResult[s.name] ? (
                    <span className={testResult[s.name] === 'reachable' ? 'text-green-600' : 'text-red-600'}>
                      {testResult[s.name]}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{s.enabled ? 'enabled' : 'disabled'}</span>
                  )}
                </td>
                <td className="py-1.5 flex gap-2">
                  <button
                    onClick={() => handleTest(s.name)}
                    disabled={testing === s.name}
                    className="text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    {testing === s.name ? 'Testing…' : 'Test'}
                  </button>
                  <button onClick={() => handleDelete(s.name)} className="text-red-500 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="rounded-lg border border-border-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">Add / Update Server</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground">Name</label>
            <input
              value={form.name ?? ''}
              onChange={e => handleFormChange('name', e.target.value)}
              placeholder="my-analytics"
              className="mt-1 w-full rounded border border-border px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">URL (HTTPS)</label>
            <input
              value={form.url ?? ''}
              onChange={e => handleFormChange('url', e.target.value)}
              placeholder="https://mcp.example.com"
              className="mt-1 w-full rounded border border-border px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Auth Type</label>
            <select
              value={form.authType ?? 'none'}
              onChange={e => handleFormChange('authType', e.target.value)}
              className="mt-1 w-full rounded border border-border px-2 py-1.5 text-xs"
            >
              <option value="none">None</option>
              <option value="bearer">Bearer Token</option>
              <option value="header">Custom Header</option>
            </select>
          </div>
          {form.authType !== 'none' && (
            <div>
              <label className="block text-xs text-muted-foreground">Auth Value</label>
              <input
                type="password"
                value={form.authValue ?? ''}
                onChange={e => handleFormChange('authValue', e.target.value)}
                placeholder="Token / value"
                className="mt-1 w-full rounded border border-border px-2 py-1.5 text-xs"
              />
            </div>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add Server'}
        </button>
      </div>
    </div>
  );
}

// ---------- Storage Panel (R2 BYOS) ----------

const MASK_VALUE = '••••••••••••••••';

interface StorageSettings {
  r2AccessKeyId?: string | null;
  r2SecretAccessKey?: string | null;
  r2BucketName?: string;
  r2Endpoint?: string;
  r2PublicBaseUrl?: string;
  useTenantStorage?: boolean;
}

interface StorageForm {
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2Endpoint: string;
  r2PublicBaseUrl: string;
  useTenantStorage: boolean;
}

function StoragePanel() {
  const [form, setForm] = useState<StorageForm>({
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2BucketName: '',
    r2Endpoint: '',
    r2PublicBaseUrl: '',
    useTenantStorage: false,
  });
  const [originalValues, setOriginalValues] = useState<StorageSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/v1/settings/storage');
        if (!res.ok) throw new Error('Failed to load storage settings');
        const data = (await res.json()) as { value?: StorageSettings };
        const val = data.value ?? {};
        setOriginalValues(val);
        setForm({
          r2AccessKeyId: val.r2AccessKeyId ? MASK_VALUE : '',
          r2SecretAccessKey: val.r2SecretAccessKey ? MASK_VALUE : '',
          r2BucketName: val.r2BucketName ?? '',
          r2Endpoint: val.r2Endpoint ?? '',
          r2PublicBaseUrl: val.r2PublicBaseUrl ?? '',
          useTenantStorage: !!val.useTenantStorage,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChangeKey = (field: 'r2AccessKeyId' | 'r2SecretAccessKey', newVal: string) => {
    setSaved(false);
    if (newVal.startsWith(MASK_VALUE)) {
      const appended = newVal.slice(MASK_VALUE.length);
      setForm(prev => ({ ...prev, [field]: appended }));
    } else if (newVal.includes(MASK_VALUE)) {
      const cleaned = newVal.replace(MASK_VALUE, '');
      setForm(prev => ({ ...prev, [field]: cleaned }));
    } else if (newVal.split('').every(char => char === '•')) {
      setForm(prev => ({ ...prev, [field]: '' }));
    } else {
      setForm(prev => ({ ...prev, [field]: newVal }));
    }
  };

  const handleChangeField = (field: keyof StorageForm, newVal: string | boolean) => {
    setSaved(false);
    setForm(prev => ({ ...prev, [field]: newVal } as unknown as StorageForm));
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<StorageSettings> = {};

      if (form.r2AccessKeyId !== MASK_VALUE) {
        payload.r2AccessKeyId = form.r2AccessKeyId === '' ? null : form.r2AccessKeyId;
      }
      if (form.r2SecretAccessKey !== MASK_VALUE) {
        payload.r2SecretAccessKey = form.r2SecretAccessKey === '' ? null : form.r2SecretAccessKey;
      }
      if (form.r2BucketName !== (originalValues?.r2BucketName ?? '')) {
        payload.r2BucketName = form.r2BucketName === '' ? undefined : form.r2BucketName;
      }
      if (form.r2Endpoint !== (originalValues?.r2Endpoint ?? '')) {
        payload.r2Endpoint = form.r2Endpoint === '' ? undefined : form.r2Endpoint;
      }
      if (form.r2PublicBaseUrl !== (originalValues?.r2PublicBaseUrl ?? '')) {
        payload.r2PublicBaseUrl = form.r2PublicBaseUrl === '' ? undefined : form.r2PublicBaseUrl;
      }
      if (form.useTenantStorage !== (originalValues?.useTenantStorage ?? false)) {
        payload.useTenantStorage = form.useTenantStorage;
      }

      // Check if anything actually changed
      if (Object.keys(payload).length === 0) {
        setSaved(true);
        setSaving(false);
        return;
      }

      const res = await fetch('/api/v1/settings/storage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as Record<string, string>;
        throw new Error(errData.message || errData.error || 'Failed to save settings');
      }

      const data = (await res.json()) as { value?: StorageSettings };
      const updatedVal = data.value ?? {};
      setOriginalValues(updatedVal);
      setForm({
        r2AccessKeyId: updatedVal.r2AccessKeyId ? MASK_VALUE : '',
        r2SecretAccessKey: updatedVal.r2SecretAccessKey ? MASK_VALUE : '',
        r2BucketName: updatedVal.r2BucketName ?? '',
        r2Endpoint: updatedVal.r2Endpoint ?? '',
        r2PublicBaseUrl: updatedVal.r2PublicBaseUrl ?? '',
        useTenantStorage: !!updatedVal.useTenantStorage,
      });

      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading storage settings…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Storage Settings (R2 BYOS)</h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={form.useTenantStorage}
            onChange={e => handleChangeField('useTenantStorage', e.target.checked)}
            className="rounded"
          />
          Use Tenant Storage
        </label>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            R2 Access Key ID
          </label>
          <input
            type="password"
            value={form.r2AccessKeyId}
            onChange={e => handleChangeKey('r2AccessKeyId', e.target.value)}
            placeholder="Enter R2 Access Key ID"
            className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            R2 Secret Access Key
          </label>
          <input
            type="password"
            value={form.r2SecretAccessKey}
            onChange={e => handleChangeKey('r2SecretAccessKey', e.target.value)}
            placeholder="Enter R2 Secret Access Key"
            className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            R2 Bucket Name
          </label>
          <input
            type="text"
            value={form.r2BucketName}
            onChange={e => handleChangeField('r2BucketName', e.target.value)}
            placeholder="e.g. my-bucket"
            className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            R2 Endpoint URL
          </label>
          <input
            type="text"
            value={form.r2Endpoint}
            onChange={e => handleChangeField('r2Endpoint', e.target.value)}
            placeholder="e.g. https://<account-id>.r2.cloudflarestorage.com"
            className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            R2 Public Base URL
          </label>
          <input
            type="text"
            value={form.r2PublicBaseUrl}
            onChange={e => handleChangeField('r2PublicBaseUrl', e.target.value)}
            placeholder="e.g. https://pub-12345.r2.dev or custom domain"
            className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ---------- Export / Import Panel ----------

function ExportImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: unknown[] } | null>(null);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [resetting, setResetting] = useState(false);

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

  async function handleReset() {
    if (resetStep === 0) { setResetStep(1); return; }
    if (resetStep === 1) { setResetStep(2); return; }
    setResetting(true);
    try {
      await fetch('/api/v1/settings/reset', { method: 'POST' });
      setResetStep(0);
      alert('All settings reset to defaults.');
    } catch {
      alert('Reset failed');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Export Settings</h3>
        <p className="mt-1 text-xs text-muted-foreground">Download all your settings as a JSON file.</p>
        <button
          onClick={handleExport}
          className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          Download JSON
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">Import Settings</h3>
        <p className="mt-1 text-xs text-muted-foreground">Upload a previously exported JSON file to restore settings.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImport}
          disabled={importing}
          className="mt-3 block text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700"
        />
        {importing && <p className="mt-2 text-xs text-muted-foreground">Importing…</p>}
        {importResult && (
          <p className="mt-2 text-xs text-green-600">
            Imported {importResult.imported} namespace(s).
            {importResult.errors.length > 0 && ` ${importResult.errors.length} error(s) — check console.`}
          </p>
        )}
      </div>

      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-red-600">Danger Zone</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Reset all settings back to system defaults. This cannot be undone.
        </p>
        <button
          onClick={handleReset}
          disabled={resetting}
          className={`mt-3 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            resetStep === 0
              ? 'border border-red-300 text-red-600 hover:bg-red-50'
              : resetStep === 1
              ? 'bg-red-100 text-red-700 border border-red-400'
              : 'bg-red-600 text-white'
          }`}
        >
          {resetting
            ? 'Resetting…'
            : resetStep === 0
            ? 'Reset all to defaults'
            : resetStep === 1
            ? 'Are you sure? Click again to confirm'
            : 'Final confirmation — click to reset NOW'}
        </button>
        {resetStep > 0 && !resetting && (
          <button
            onClick={() => setResetStep(0)}
            className="ml-3 text-xs text-muted-foreground hover:underline"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Main component ----------

export function CustomizePageClient() {
  const [active, setActive] = useState<string>('branding');

  function renderPanel() {
    switch (active) {
      case 'channels': return <ChannelsPanel />;
      case 'mcp': return <McpPanel />;
      case 'storage': return <StoragePanel />;
      case 'export-import': return <ExportImportPanel />;
      default: return <PlaceholderPanel name={NAV_ITEMS.find(n => n.id === active)?.label ?? active} />;
    }
  }

  return (
    <div className="flex gap-6">
      <nav className="w-48 shrink-0">
        <ul className="space-y-1">
          {NAV_ITEMS.map(item => (
            <li key={item.id}>
              <button
                onClick={() => setActive(item.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  active === item.id
                    ? 'bg-indigo-100 font-medium text-indigo-700'
                    : 'text-muted-foreground hover:bg-muted-100'
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1">{renderPanel()}</main>
    </div>
  );
}
