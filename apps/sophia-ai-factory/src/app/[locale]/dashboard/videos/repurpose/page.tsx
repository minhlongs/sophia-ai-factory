'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';
import { Loader2, Scissors, Check } from 'lucide-react';
import {
  createRepurposeAction,
  getRepurposeJobAction,
  approveClipsAction,
} from '@/app/actions/repurpose-action';

export default function RepurposePage() {
  const t = useTranslations('repurpose');
  const [videoId, setVideoId] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [clips, setClips] = useState<Array<{
    id: string;
    clip_index: number;
    start_ms: number;
    end_ms: number;
    score: number | null;
    title: string | null;
    status: string;
  }>>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!videoId.trim()) return;
    setLoading(true);
    setError(null);
    const result = await createRepurposeAction(videoId);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setJobId(result.data.jobId);
    setStatus('analyzing');
    pollJob(result.data.jobId);
  }

  async function pollJob(id: string) {
    const poll = setInterval(async () => {
      const res = await getRepurposeJobAction(id);
      if (!res.success) return;
      setStatus(res.data.job.status);
      if (res.data.job.status === 'clips_ready' || res.data.job.status === 'completed') {
        setClips(res.data.clips);
        setSelectedClips(new Set(res.data.clips.map((c) => c.id)));
        setLoading(false);
        clearInterval(poll);
      }
      if (res.data.job.status === 'failed') {
        setError('Analysis failed');
        setLoading(false);
        clearInterval(poll);
      }
    }, 3000);
  }

  function toggleClip(clipId: string) {
    setSelectedClips((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }

  async function handleGenerate() {
    if (!jobId || selectedClips.size === 0) return;
    setLoading(true);
    const result = await approveClipsAction(jobId, Array.from(selectedClips));
    if (!result.success) {
      setError(result.error);
    } else {
      setStatus('generating');
    }
    setLoading(false);
  }

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <div className="space-y-6 p-4 max-w-2xl">
      <h1 className="text-lg font-semibold">{t('title')}</h1>

      {status === 'idle' && (
        <div className="space-y-3">
          <Label className="text-xs">{t('selectVideo')}</Label>
          <Input
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            placeholder="Video ID"
            className="h-9"
          />
          <Button onClick={handleAnalyze} disabled={loading || !videoId.trim()} size="sm">
            {loading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            <Scissors className="w-3 h-3 mr-1" />
            {t('analyzeForClips')}
          </Button>
        </div>
      )}

      {status === 'analyzing' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('analyzing')}
        </div>
      )}

      {(status === 'clips_ready' || status === 'completed') && clips.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{t('clipsReady')} ({clips.length})</p>
          <div className="space-y-2">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className={`p-3 border rounded-md cursor-pointer transition-colors ${
                  selectedClips.has(clip.id) ? 'border-primary bg-primary/5' : 'border-input'
                }`}
                onClick={() => toggleClip(clip.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedClips.has(clip.id) && <Check className="w-3 h-3 text-primary" />}
                    <span className="text-sm font-medium">{clip.title ?? `Clip ${clip.clip_index + 1}`}</span>
                  </div>
                  {clip.score != null && (
                    <span className="text-xs text-muted-foreground">{t('clipScore')}: {clip.score.toFixed(1)}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTime(clip.start_ms)} → {formatTime(clip.end_ms)}
                </p>
              </div>
            ))}
          </div>
          {status === 'clips_ready' && (
            <Button onClick={handleGenerate} disabled={loading || selectedClips.size === 0} size="sm">
              {loading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              {t('generateClips')} ({selectedClips.size})
            </Button>
          )}
        </div>
      )}

      {clips.length === 0 && status !== 'idle' && status !== 'analyzing' && (
        <p className="text-sm text-muted-foreground">{t('noClips')}</p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
