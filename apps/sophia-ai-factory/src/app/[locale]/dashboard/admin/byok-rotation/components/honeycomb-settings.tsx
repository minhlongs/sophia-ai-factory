'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';

export default function HoneycombSettings({ locale }: { locale: string }) {
  const isVi = locale.startsWith('vi');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  // Dataset fields
  const [dataset, setDataset] = useState('');
  const [savingDataset, setSavingDataset] = useState(false);
  const [datasetStatus, setDatasetStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [hasExistingDataset, setHasExistingDataset] = useState(false);

  // Test connection
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/platform-config?key=honeycomb_api_key')
      .then((r: Response) => r.json() as Promise<{ exists?: boolean }>)
      .then((d: { exists?: boolean }) => {
        if (d?.exists) setHasExistingKey(true);
      })
      .catch(() => {});
    fetch('/api/admin/platform-config?key=honeycomb_dataset')
      .then((r: Response) => r.json() as Promise<{ exists?: boolean }>)
      .then((d: { exists?: boolean }) => {
        if (d?.exists) setHasExistingDataset(true);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'honeycomb_api_key', value: apiKey.trim() }),
      });
      if (res.ok) {
        setStatus({ ok: true, msg: isVi ? 'Da luu khoa Honeycomb' : 'Honeycomb key saved' });
        setApiKey('');
        setHasExistingKey(true);
      } else {
        const errData = await res.json() as { error?: string };
        setStatus({ ok: false, msg: errData?.error || 'Save failed' });
      }
    } catch (_err) {
      setStatus({ ok: false, msg: _err instanceof Error ? _err.message : 'Network error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDataset() {
    if (!dataset.trim()) return;
    setSavingDataset(true);
    setDatasetStatus(null);
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'honeycomb_dataset', value: dataset.trim() }),
      });
      if (res.ok) {
        setDatasetStatus({ ok: true, msg: isVi ? 'Da luu ten dataset' : 'Dataset name saved' });
        setDataset('');
        setHasExistingDataset(true);
      } else {
        const errData = await res.json() as { error?: string };
        setDatasetStatus({ ok: false, msg: errData?.error || 'Save failed' });
      }
    } catch (_err) {
      setDatasetStatus({ ok: false, msg: _err instanceof Error ? _err.message : 'Network error' });
    } finally {
      setSavingDataset(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/honeycomb/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setTestResult({ ok: true, msg: isVi ? 'Ket noi Honeycomb thanh cong' : 'Honeycomb connection successful' });
      } else {
        setTestResult({ ok: false, msg: data?.error || (isVi ? 'Ket noi that bai' : 'Connection failed') });
      }
    } catch (_err) {
      setTestResult({ ok: false, msg: _err instanceof Error ? _err.message : 'Network error' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">
        {isVi ? 'Cau Hinh Honeycomb (OTel)' : 'Honeycomb Configuration (OTel)'}
      </h2>
      <p className="text-sm text-muted-foreground">
        {isVi
          ? 'Nhap Honeycomb API Key de bat theo doi telemetry. Khoa duoc ma hoa va luu an toan.'
          : 'Enter your Honeycomb API Key to enable telemetry tracing. The key is encrypted at rest.'}
      </p>

      {hasExistingKey && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <Check className="w-4 h-4" />
          {isVi ? 'Da cau hinh khoa' : 'Key is configured'}
        </div>
      )}

      {/* API Key input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={isVi ? 'Nhap Honeycomb API Key...' : 'Enter Honeycomb API Key...'}
            className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 pr-10 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Button onClick={handleSave} disabled={saving || !apiKey.trim()} variant="primary" size="sm">
          {saving ? (isVi ? 'Dang luu...' : 'Saving...') : isVi ? 'Luu' : 'Save'}
        </Button>
      </div>

      {status && (
        <div className={`flex items-center gap-2 text-sm ${status.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {status.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {status.msg}
        </div>
      )}

      {/* Dataset name */}
      <div className="border-t border-white/10 pt-4 space-y-3">
        <h3 className="text-sm font-medium">
          {isVi ? 'Dataset Name' : 'Dataset Name'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {isVi
            ? 'Ten dataset Honeycomb de gui trace. Thuong la <ten-moi-truong>.<ten-service>.'
            : 'Honeycomb dataset name for traces. Typically <environment>.<service-name>.'}
        </p>

        {hasExistingDataset && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Check className="w-4 h-4" />
            {isVi ? 'Da cau hinh dataset' : 'Dataset is configured'}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={dataset}
            onChange={e => setDataset(e.target.value)}
            placeholder={isVi ? 'Nhap ten dataset...' : 'Enter dataset name...'}
            className="flex-1 rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
          />
          <Button onClick={handleSaveDataset} disabled={savingDataset || !dataset.trim()} variant="secondary" size="sm">
            {savingDataset ? (isVi ? 'Dang luu...' : 'Saving...') : isVi ? 'Luu' : 'Save'}
          </Button>
        </div>

        {datasetStatus && (
          <div className={`flex items-center gap-2 text-sm ${datasetStatus.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {datasetStatus.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {datasetStatus.msg}
          </div>
        )}
      </div>

      {/* Test Connection */}
      <div className="border-t border-white/10 pt-4">
        <Button
          onClick={handleTestConnection}
          disabled={testing || (!apiKey.trim() && !hasExistingKey)}
          variant="outline"
          size="sm"
        >
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isVi ? 'Dang kiem tra...' : 'Testing...'}
            </>
          ) : isVi ? 'Kiem tra ket noi' : 'Test Connection'}
        </Button>

        {testResult && (
          <div className={`mt-2 flex items-center gap-2 text-sm ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {testResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {testResult.msg}
          </div>
        )}
      </div>
    </section>
  );
}
