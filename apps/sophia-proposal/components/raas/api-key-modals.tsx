'use client';

/**
 * RaaS API Key Modals
 *
 * Modal dialogs for: create key, show created key once, revoke confirmation.
 * Consumed exclusively by api-key-manager.tsx
 */

// ── Create key modal ──────────────────────────────────────────────────────────

interface CreateModalProps {
  name: string;
  saving: boolean;
  onChangeName: (v: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export function CreateKeyModal({ name, saving, onChangeName, onCreate, onCancel }: CreateModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-semibold">Create API Key</h3>
        <input
          type="text"
          placeholder="Key name (e.g. Production)"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button
            onClick={onCreate}
            disabled={saving || !name.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Show created key ONCE ─────────────────────────────────────────────────────

interface ShowKeyModalProps {
  apiKey: string;
  onDone: () => void;
}

export function ShowKeyModal({ apiKey, onDone }: ShowKeyModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">API Key Created</h3>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          Copy this key now — it will not be shown again.
        </p>
        <pre className="rounded bg-gray-900 text-green-400 text-sm p-4 break-all whitespace-pre-wrap font-mono">
          {apiKey}
        </pre>
        <div className="flex justify-end">
          <button
            onClick={onDone}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Revoke confirmation modal ─────────────────────────────────────────────────

interface RevokeModalProps {
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RevokeConfirmModal({ saving, onConfirm, onCancel }: RevokeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Revoke API Key?</h3>
        <p className="text-sm text-gray-600">
          This action is permanent. Any requests using this key will be rejected immediately.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Revoking…' : 'Revoke'}
          </button>
        </div>
      </div>
    </div>
  );
}
