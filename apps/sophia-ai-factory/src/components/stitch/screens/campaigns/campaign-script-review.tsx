'use client';

import { useState } from 'react';

/** Private persisted-asset viewer. Review confirmation is local, not a server acceptance record. */
export function CampaignScriptReview({ campaignId }: { campaignId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const endpoint = `/api/campaigns/${encodeURIComponent(campaignId)}/export`;

  async function load() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || !('script' in payload) ||
          !payload.script || typeof payload.script !== 'object' || Array.isArray(payload.script)) {
        throw new Error('invalid');
      }
      setText(JSON.stringify(payload.script, null, 2));
      setReviewed(false);
    } catch {
      setMessage('Không thể tải kịch bản đã hoàn tất. Thử lại. / Cannot load the completed script. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Đã sao chép / Copied');
    } catch {
      setMessage('Không thể sao chép. Hãy chọn nội dung bên dưới. / Copy failed. Select the text below.');
    }
  }

  return (
    <section className="min-w-0 space-y-3 border-t border-border pt-3">
      <button type="button" onClick={load} disabled={busy} className="text-sm text-primary underline disabled:opacity-50">
        {busy ? 'Đang tải / Loading' : 'Xem và duyệt kịch bản / View and review script'}
      </button>
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
      {text !== null && (
        <>
          <p className="text-xs text-muted-foreground">Bản riêng tư; hãy kiểm tra trước khi sử dụng. Không tự đăng. / Private asset; review before use. No automatic publishing.</p>
          <textarea readOnly aria-label="Kịch bản đã lưu / Saved script" value={text} className="w-full min-h-56 rounded border border-border bg-background p-2 text-xs" />
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={copy} className="text-primary underline">Sao chép / Copy</button>
            <a href={`${endpoint}?format=markdown`} download className="text-primary underline">Tải Markdown / Download Markdown</a>
            <a href={endpoint} download className="text-primary underline">Tải JSON / Download JSON</a>
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
            Tôi đã kiểm tra để sử dụng thủ công (chỉ xác nhận trên màn hình, chưa lưu). / I reviewed this for manual use (on-screen only, not saved).
          </label>
        </>
      )}
    </section>
  );
}
