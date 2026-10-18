'use client';

/**
 * Event handlers for ApiKeysManager.
 * Layer: components/settings
 * @module components/settings/api-keys-manager-handlers
 */

export async function handleTestAndSave(providerId: string, inputKey: string): Promise<{ ok: boolean; message?: string }> {
  if (!inputKey.trim()) return { ok: false, message: 'Key cannot be empty' };
  try {
    const valRes = await fetch('/api/setup-wizard/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, api_key: inputKey.trim() }),
    });
    const valData = (await valRes.json()) as { ok?: boolean; message?: string };
    if (!valRes.ok || !valData.ok) {
      return { ok: false, message: valData.message || 'Key validation failed.' };
    }
    const saveRes = await fetch('/api/user/byok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, key: inputKey.trim() }),
    });
    if (saveRes.ok) {
      return { ok: true, message: `Connected ${providerId}!` };
    }
    const err = (await saveRes.json()) as { error?: string };
    return { ok: false, message: err.error || 'Failed to save key' };
  } catch {
    return { ok: false, message: 'Network connection failed' };
  }
}

export async function handleRevoke(providerId: string): Promise<{ ok: boolean; message?: string }> {
  if (!confirm(`Are you sure you want to revoke the key for ${providerId}?`)) return { ok: false };
  try {
    const res = await fetch('/api/user/byok', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId }),
    });
    if (res.ok) {
      return { ok: true, message: `Revoked ${providerId} key.` };
    }
    return { ok: false, message: 'Failed to revoke key' };
  } catch {
    return { ok: false, message: 'Failed to revoke key' };
  }
}