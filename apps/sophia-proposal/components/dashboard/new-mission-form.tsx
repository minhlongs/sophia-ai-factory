'use client';

/**
 * NewMissionForm — collapsible form for creating missions from the dashboard.
 * Supports all 17 commands grouped by category with dynamic param fields.
 */

import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface CommandDef {
  value: string;
  label: string;
  params: ParamDef[];
}

interface ParamDef {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
}

interface CommandGroup {
  label: string;
  commands: CommandDef[];
}

interface NewMissionFormProps {
  onSuccess?: () => void;
}

// ── Command definitions ───────────────────────────────────────────────────────

const COMMAND_GROUPS: CommandGroup[] = [
  {
    label: 'Proposals',
    commands: [
      {
        value: 'proposal:create',
        label: 'Create Proposal',
        params: [
          { key: 'client_name', label: 'Client Name', required: true },
          { key: 'product_name', label: 'Product Name' },
          { key: 'tone', label: 'Tone', placeholder: 'professional, friendly…' },
        ],
      },
      {
        value: 'video:create',
        label: 'Create Video',
        params: [
          { key: 'title', label: 'Title', required: true },
          { key: 'script', label: 'Script', multiline: true },
        ],
      },
    ],
  },
  {
    label: 'Content',
    commands: [
      {
        value: 'content:blog',
        label: 'Blog Post',
        params: [
          { key: 'topic', label: 'Topic', required: true },
          { key: 'company', label: 'Company' },
          { key: 'target_audience', label: 'Target Audience' },
        ],
      },
      {
        value: 'content:social',
        label: 'Social Post',
        params: [
          { key: 'topic', label: 'Topic' },
          { key: 'company', label: 'Company' },
        ],
      },
    ],
  },
  {
    label: 'Sales',
    commands: [
      {
        value: 'sales:battlecard',
        label: 'Battle Card',
        params: [
          { key: 'competitor', label: 'Competitor', required: true },
          { key: 'product', label: 'Your Product' },
        ],
      },
      {
        value: 'sales:proposal-deck',
        label: 'Proposal Deck',
        params: [{ key: 'client_name', label: 'Client Name', required: true }],
      },
      {
        value: 'sales:roi-calculator',
        label: 'ROI Calculator',
        params: [{ key: 'product', label: 'Product', required: true }],
      },
      {
        value: 'sales:competitor-analysis',
        label: 'Competitor Analysis',
        params: [
          { key: 'competitors', label: 'Competitors (comma-separated)', required: true },
          { key: 'product', label: 'Your Product' },
        ],
      },
      {
        value: 'sales:pricing-optimizer',
        label: 'Pricing Optimizer',
        params: [{ key: 'product', label: 'Product', required: true }],
      },
      {
        value: 'sales:outreach-sequence',
        label: 'Outreach Sequence',
        params: [
          { key: 'prospect_company', label: 'Prospect Company', required: true },
          { key: 'prospect_name', label: 'Prospect Name' },
          { key: 'prospect_role', label: 'Prospect Role' },
          { key: 'industry', label: 'Industry' },
          { key: 'pain_point', label: 'Pain Point' },
        ],
      },
    ],
  },
  {
    label: 'Leads',
    commands: [
      {
        value: 'lead:generate',
        label: 'Generate Leads',
        params: [
          { key: 'industry', label: 'Industry', required: true },
          { key: 'company_size', label: 'Company Size' },
          { key: 'region', label: 'Region' },
          { key: 'max_leads', label: 'Max Leads', placeholder: '50' },
        ],
      },
      {
        value: 'email:send',
        label: 'Send Email',
        params: [
          { key: 'to', label: 'To (email)', required: true },
          { key: 'subject', label: 'Subject', required: true },
          { key: 'body', label: 'Body', required: true, multiline: true },
        ],
      },
    ],
  },
  {
    label: 'Operations',
    commands: [
      {
        value: 'crm:sync',
        label: 'CRM Sync',
        params: [],
      },
      {
        value: 'analytics:export',
        label: 'Analytics Export',
        params: [],
      },
      {
        value: 'gtm:campaign',
        label: 'GTM Campaign',
        params: [],
      },
    ],
  },
  {
    label: 'Affiliate',
    commands: [
      {
        value: 'affiliate:generate',
        label: 'Generate Affiliate',
        params: [],
      },
      {
        value: 'affiliate:scrape',
        label: 'Scrape Affiliates',
        params: [],
      },
    ],
  },
];

const ALL_COMMANDS: CommandDef[] = COMMAND_GROUPS.flatMap((g) => g.commands);

function findCommand(value: string): CommandDef | undefined {
  return ALL_COMMANDS.find((c) => c.value === value);
}

// ── Component ────────────────────────────────────────────────────────────────

export function NewMissionForm({ onSuccess }: NewMissionFormProps) {
  const [open, setOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [jsonParams, setJsonParams] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedCmd = command ? findCommand(command) : undefined;
  const useJsonFallback = selectedCmd && selectedCmd.params.length === 0;

  function handleCommandChange(value: string) {
    setCommand(value);
    setParamValues({});
    setJsonParams('{}');
    setFeedback(null);
  }

  function setParam(key: string, value: string) {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!command) return;

    setLoading(true);
    setFeedback(null);

    let params: Record<string, string> = {};

    if (useJsonFallback) {
      try {
        params = JSON.parse(jsonParams) as Record<string, string>;
      } catch {
        setFeedback({ type: 'error', message: 'Invalid JSON in params field.' });
        setLoading(false);
        return;
      }
    } else {
      params = Object.fromEntries(
        Object.entries(paramValues).filter(([, v]) => v.trim() !== '')
      );
    }

    try {
      const res = await fetch('/api/v1/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setFeedback({ type: 'success', message: 'Mission created successfully.' });
      setCommand('');
      setParamValues({});
      setJsonParams('{}');
      onSuccess?.();
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">+ New Mission</span>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {/* Collapsible form */}
      {open && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 border-t border-gray-100 space-y-4 pt-4">
          {/* Command select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Command</label>
            <select
              value={command}
              onChange={(e) => handleCommandChange(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a command…</option>
              {COMMAND_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.commands.map((cmd) => (
                    <option key={cmd.value} value={cmd.value}>
                      {cmd.label} ({cmd.value})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Dynamic param fields */}
          {selectedCmd && !useJsonFallback && selectedCmd.params.map((p) => (
            <div key={p.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {p.label}
                {p.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {p.multiline ? (
                <textarea
                  value={paramValues[p.key] ?? ''}
                  onChange={(e) => setParam(p.key, e.target.value)}
                  required={p.required}
                  placeholder={p.placeholder}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={paramValues[p.key] ?? ''}
                  onChange={(e) => setParam(p.key, e.target.value)}
                  required={p.required}
                  placeholder={p.placeholder}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
          ))}

          {/* JSON fallback for commands without defined params */}
          {useJsonFallback && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Params (JSON)
              </label>
              <textarea
                value={jsonParams}
                onChange={(e) => setJsonParams(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                feedback.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !command}
            className="w-full rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating…' : 'Create Mission'}
          </button>
        </form>
      )}
    </div>
  );
}
