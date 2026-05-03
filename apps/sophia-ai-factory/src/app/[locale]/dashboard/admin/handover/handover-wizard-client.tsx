'use client';

/**
 * Handover Wizard — 4-step multi-step form for admin to onboard new customers.
 * Step 1: Customer Info | Step 2: Starter Pack | Step 3: Config | Step 4: Generate
 *
 * @module app/[locale]/dashboard/admin/handover/handover-wizard-client
 */

import { useState } from 'react';
import { ChevronRight, ChevronLeft, Send, Loader2, Check } from 'lucide-react';
import { AGENCY_SOP_MAP, TIER_SOP_COUNTS, type AgencyType, type CreateHandoverInput } from '@/lib/handover/handover-types';
import type { Tier } from '@/types';
import {
  Step1CustomerInfo, Step2StarterPack, Step3Configuration,
  type FormState, type HandoverResult,
} from './handover-wizard-steps';
import { Step4Result } from './handover-wizard-step4-result';

interface Props { locale: string }

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Customer Info', 'Starter Pack', 'Configuration', 'Generate'];

const DEFAULT_FORM: FormState = {
  agencyName: '', ownerEmail: '', ownerFullName: '',
  agencyType: 'b2b_saas', tier: 'BASIC',
  phone: '', locale: 'vi', timezone: 'Asia/Ho_Chi_Minh', referralSource: '',
};

export function HandoverWizardClient({ locale }: Props) {
  const isVi = locale.startsWith('vi');
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HandoverResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const defaultSops = AGENCY_SOP_MAP[form.agencyType].slice(0, TIER_SOP_COUNTS[form.tier]);
  const [selectedSops, setSelectedSops] = useState<string[]>(defaultSops);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'agencyType' || key === 'tier') {
      const newType = key === 'agencyType' ? (value as AgencyType) : form.agencyType;
      const newTier = key === 'tier' ? (value as Tier) : form.tier;
      setSelectedSops(AGENCY_SOP_MAP[newType].slice(0, TIER_SOP_COUNTS[newTier]));
    }
  }

  function toggleSop(slug: string) {
    setSelectedSops((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
  }

  function validateStep1(): boolean {
    if (!form.agencyName.trim()) { setError(isVi ? 'Nhập tên agency' : 'Enter agency name'); return false; }
    if (!form.ownerEmail.includes('@')) { setError(isVi ? 'Email không hợp lệ' : 'Invalid email'); return false; }
    if (!form.ownerFullName.trim()) { setError(isVi ? 'Nhập tên chủ sở hữu' : 'Enter owner name'); return false; }
    return true;
  }

  function goNext() {
    setError(null);
    if (step === 1 && !validateStep1()) return;
    setStep((prev) => Math.min(prev + 1, 4) as Step);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const payload: CreateHandoverInput = {
      agencyName: form.agencyName, ownerEmail: form.ownerEmail, ownerFullName: form.ownerFullName,
      agencyType: form.agencyType, tier: form.tier,
      phone: form.phone || undefined, locale: form.locale, timezone: form.timezone,
      referralSource: form.referralSource || undefined, selectedSops,
    };
    try {
      const res = await fetch('/api/admin/handover/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) { setError((data.error as string) ?? 'Failed to create handover'); return; }
      setResult(data as unknown as HandoverResult);
      setStep(4);
    } catch {
      setError(isVi ? 'Lỗi kết nối máy chủ' : 'Server connection error');
    } finally {
      setLoading(false);
    }
  }

  function copyMagicLink() {
    if (!result?.magicLinkUrl) return;
    void navigator.clipboard.writeText(result.magicLinkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadDoc() {
    if (!result?.handoverDoc) return;
    const blob = new Blob([result.handoverDoc], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `handover-${form.agencyName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetWizard() {
    setStep(1); setResult(null); setForm(DEFAULT_FORM); setCopied(false);
    setSelectedSops(AGENCY_SOP_MAP.b2b_saas.slice(0, TIER_SOP_COUNTS.BASIC));
  }

  return (
    <div className="max-w-2xl">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, idx) => {
          const n = idx + 1; const done = step > n; const active = step === n;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all
                ${done ? 'bg-violet-600 text-white' : active ? 'bg-violet-500/30 border-2 border-violet-500 text-violet-300' : 'bg-zinc-800 text-zinc-500'}`}>
                {done ? <Check size={14} /> : n}
              </div>
              <span className={`text-xs hidden sm:block ${active ? 'text-zinc-100' : 'text-zinc-500'}`}>{label}</span>
              {idx < 3 && <div className={`h-px flex-1 ${step > n ? 'bg-violet-600' : 'bg-zinc-800'}`} />}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-500/40 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {step === 1 && <Step1CustomerInfo form={form} updateForm={updateForm} isVi={isVi} />}
        {step === 2 && <Step2StarterPack agencyType={form.agencyType} tier={form.tier} selectedSops={selectedSops} toggleSop={toggleSop} isVi={isVi} />}
        {step === 3 && <Step3Configuration form={form} selectedSops={selectedSops} isVi={isVi} />}
        {step === 4 && result && (
          <Step4Result result={result} form={form} isVi={isVi} copied={copied} onCopy={copyMagicLink} onDownload={downloadDoc} onReset={resetWizard} />
        )}

        {step < 4 && (
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            {step > 1 ? (
              <button onClick={() => setStep((prev) => Math.max(prev - 1, 1) as Step)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors">
                <ChevronLeft size={16} />{isVi ? 'Quay lại' : 'Back'}
              </button>
            ) : <div />}

            {step < 3 ? (
              <button onClick={goNext} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
                {isVi ? 'Tiếp theo' : 'Next'}<ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={() => void handleGenerate()} disabled={loading} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {loading ? (isVi ? 'Đang tạo...' : 'Creating...') : (isVi ? 'Tạo & Gửi Email' : 'Create & Send Email')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
