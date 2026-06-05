/**
 * /dashboard/schedule — recurring campaign schedule management.
 *
 * Client page: list schedules, create new, toggle active, delete.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Pause,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';

interface Schedule {
  id: string;
  user_id: string;
  topic: string;
  template_script: string | null;
  interval_days: number;
  next_run_date: string;
  is_active: number;
}

interface ScheduleApiResponse {
  schedules?: Schedule[];
  error?: string;
}

const INTERVAL_OPTIONS = [
  { value: 1, label: 'Mỗi ngày' },
  { value: 3, label: '3 ngày' },
  { value: 7, label: 'Hàng tuần' },
  { value: 14, label: '2 tuần' },
  { value: 30, label: 'Hàng tháng' },
];

export default function SchedulePage(): React.JSX.Element {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState('');
  const [intervalDays, setIntervalDays] = useState(7);
  const [nextRun, setNextRun] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/schedule', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ScheduleApiResponse;
      setSchedules(json.schedules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    pollingRef.current = setInterval(fetchSchedules, 30000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchSchedules]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !nextRun) {
      setFormError('Vui lòng điền đầy đủ chủ đề và ngày chạy tiếp theo');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          interval_days: intervalDays,
          next_run_date: nextRun,
        }),
      });
      const json = (await res.json()) as ScheduleApiResponse;
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setShowForm(false);
      setTopic('');
      setIntervalDays(7);
      setNextRun('');
      await fetchSchedules();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  }

  const handleToggle = async (id: string, currentActive: number) => {
    try {
      const res = await fetch('/api/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: currentActive === 1 ? false : true }),
      });
      const json = (await res.json()) as ScheduleApiResponse;
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      await fetchSchedules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle schedule');
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa lịch hẹn này? Hành động không thể hoàn tác.')) return;
    try {
      const res = await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
      const json = (await res.json()) as ScheduleApiResponse;
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      await fetchSchedules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete schedule');
    }
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function isOverdue(dateStr: string): boolean {
    return dateStr.slice(0, 10) < new Date().toISOString().slice(0, 10);
  }

  // Set default next run to tomorrow
  useEffect(() => {
    if (!nextRun) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNextRun(tomorrow.toISOString().slice(0, 10));
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lịch chiến dịch</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tự động tạo và chạy content theo chu kỳ — quản lý lịch hẹn recurring ở đây.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tạo lịch mới
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-200">{error}</p>
            <button
              onClick={fetchSchedules}
              className="mt-2 text-xs text-red-300 underline hover:no-underline"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div className="rounded-xl border border-border bg-card p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-violet-400" />
                Tạo lịch chiến dịch mới
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Chủ đề / Topic <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="VD: Content marketing Q3, Social media strategy..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Chu kỳ lặp lại
                </label>
                <select
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.value} ngày)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Ngày chạy đầu tiên <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={nextRun}
                  onChange={(e) => setNextRun(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Sau lần chạy đầu tiên, hệ thống sẽ tự động tạo campaign mới mỗi{' '}
                <span className="font-medium text-foreground">{intervalDays} ngày</span>.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting || !topic.trim() || !nextRun}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Tạo lịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedules Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-medium">Danh sách lịch hẹn</h2>
          </div>
          <button
            onClick={fetchSchedules}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Chủ đề</th>
                <th className="px-4 py-3 text-left font-medium">Chu kỳ</th>
                <th className="px-4 py-3 text-left font-medium">Chạy tiếp theo</th>
                <th className="px-4 py-3 text-center font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && schedules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Chưa có lịch hẹn nào</p>
                    <p className="text-xs mt-1">Tạo lịch để tự động chạy campaign theo chu kỳ</p>
                  </td>
                </tr>
              ) : (
                schedules.map((sched) => {
                  const overdue = isOverdue(sched.next_run_date);
                  return (
                    <tr key={sched.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="max-w-[240px]">
                          <p className="font-medium truncate">{sched.topic}</p>
                          {sched.template_script && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              Có template
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        Mỗi {sched.interval_days} ngày
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className={`w-3.5 h-3.5 ${overdue ? 'text-red-400' : 'text-muted-foreground'}`} />
                          <span className={overdue ? 'text-red-400 font-medium' : 'text-muted-foreground'}>
                            {fmtDate(sched.next_run_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sched.is_active === 1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Đang chạy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground border border-border">
                            <Pause className="w-3 h-3" />
                            Tạm dừng
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggle(sched.id, sched.is_active)}
                            title={sched.is_active === 1 ? 'Tạm dừng' : 'Kích hoạt'}
                            className={`p-1.5 rounded-md transition-colors ${
                              sched.is_active === 1
                                ? 'text-amber-400 hover:bg-amber-500/10'
                                : 'text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {sched.is_active === 1 ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(sched.id)}
                            title="Xóa lịch"
                            className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {schedules.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {schedules.length} lịch hẹn — {schedules.filter((s) => s.is_active === 1).length} đang chạy
            </span>
            <span className="text-xs text-muted-foreground">
              Tự động refresh mỗi 30s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
