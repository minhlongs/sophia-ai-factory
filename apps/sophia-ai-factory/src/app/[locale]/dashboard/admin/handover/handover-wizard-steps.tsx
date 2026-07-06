'use client';

/**
 * Handover wizard step sub-components (Steps 1-4 content).
 * Extracted from handover-wizard-client for file size compliance.
 *
 * @module app/[locale]/dashboard/admin/handover/handover-wizard-steps
 */

import { Building2, User, Mail, Phone, Globe, Clock, Tag } from 'lucide-react';
import {
  AGENCY_SOP_MAP, TIER_SOP_COUNTS,
  type AgencyType, type CreateHandoverInput,
} from '@/tree/handover/handover-types';
import type { Tier } from '@/seed/types';

export interface FormState {
  agencyName: string;
  ownerEmail: string;
  ownerFullName: string;
  agencyType: AgencyType;
  tier: Tier;
  phone: string;
  locale: string;
  timezone: string;
  referralSource: string;
}

export interface HandoverResult {
  handoverId: string;
  customerId: string;
  magicLinkUrl: string;
  installedSops: string[];
  emailSent: boolean;
  handoverDoc: string;
}

export const TIER_OPTIONS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

export const AGENCY_LABELS: Record<AgencyType, { vi: string; en: string }> = {
  b2b_saas: { vi: 'B2B SaaS', en: 'B2B SaaS' },
  ecom: { vi: 'Thương mại điện tử', en: 'E-Commerce' },
  content_creator: { vi: 'Content Creator', en: 'Content Creator' },
  service: { vi: 'Dịch vụ', en: 'Service Agency' },
  solo_ceo: { vi: 'Solo CEO', en: 'Solo CEO' },
  other: { vi: 'Khác', en: 'Other' },
};

export const TIER_LABELS: Record<Tier, string> = {
  BASIC: 'BASIC — 1,000 MCU/mo',
  PREMIUM: 'PREMIUM — 5,000 MCU/mo',
  ENTERPRISE: 'ENTERPRISE — 20,000 MCU/mo',
  MASTER: 'MASTER — 100,000 MCU/mo',
};

export const inputCls = 'w-full bg-muted-900/80 border border-border-700 rounded-lg px-3 py-2 text-sm text-muted-foreground-100 placeholder:text-muted-foreground-600 focus:outline-none focus:border-primary-500 transition-colors';

export function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground-400">{icon}{label}</label>
      {children}
    </div>
  );
}

interface Step1Props {
  form: FormState;
  updateForm: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  isVi: boolean;
}

export function Step1CustomerInfo({ form, updateForm, isVi }: Step1Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-muted-foreground-100">{isVi ? 'Thông tin khách hàng' : 'Customer Information'}</h2>
      <Field icon={<Building2 size={16} />} label={isVi ? 'Tên Agency' : 'Agency Name'}>
        <input className={inputCls} value={form.agencyName} onChange={(e) => updateForm('agencyName', e.target.value)} placeholder="Mekong Marketing" />
      </Field>
      <Field icon={<Mail size={16} />} label="Email">
        <input className={inputCls} type="email" value={form.ownerEmail} onChange={(e) => updateForm('ownerEmail', e.target.value)} placeholder="owner@agency.com" />
      </Field>
      <Field icon={<User size={16} />} label={isVi ? 'Tên chủ sở hữu' : 'Owner Full Name'}>
        <input className={inputCls} value={form.ownerFullName} onChange={(e) => updateForm('ownerFullName', e.target.value)} placeholder="Nguyen Van A" />
      </Field>
      <Field icon={<Tag size={16} />} label={isVi ? 'Loại Agency' : 'Agency Type'}>
        <select className={inputCls} value={form.agencyType} onChange={(e) => updateForm('agencyType', e.target.value as AgencyType)}>
          {(Object.keys(AGENCY_LABELS) as AgencyType[]).map((k) => (
            <option key={k} value={k}>{isVi ? AGENCY_LABELS[k].vi : AGENCY_LABELS[k].en}</option>
          ))}
        </select>
      </Field>
      <Field icon={<Tag size={16} />} label={isVi ? 'Gói dịch vụ' : 'Subscription Tier'}>
        <select className={inputCls} value={form.tier} onChange={(e) => updateForm('tier', e.target.value as Tier)}>
          {TIER_OPTIONS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
        </select>
      </Field>
      <Field icon={<Phone size={16} />} label={isVi ? 'Số điện thoại (tùy chọn)' : 'Phone (optional)'}>
        <input className={inputCls} value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} placeholder="+84 ..." />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field icon={<Globe size={16} />} label={isVi ? 'Ngôn ngữ' : 'Locale'}>
          <select className={inputCls} value={form.locale} onChange={(e) => updateForm('locale', e.target.value)}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field icon={<Clock size={16} />} label={isVi ? 'Múi giờ' : 'Timezone'}>
          <select className={inputCls} value={form.timezone} onChange={(e) => updateForm('timezone', e.target.value)}>
            <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
            <option value="Asia/Bangkok">Asia/Bangkok</option>
            <option value="Asia/Singapore">Asia/Singapore</option>
            <option value="UTC">UTC</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

interface Step2Props {
  agencyType: AgencyType;
  tier: Tier;
  selectedSops: string[];
  toggleSop: (slug: string) => void;
  isVi: boolean;
}

export function Step2StarterPack({ agencyType, tier, selectedSops, toggleSop, isVi }: Step2Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-muted-foreground-100">{isVi ? 'Chọn Starter Pack SOPs' : 'Select Starter Pack SOPs'}</h2>
        <p className="text-sm text-muted-foreground-400 mt-1">
          {isVi ? `Gói ${tier} cho phép ${TIER_SOP_COUNTS[tier]} SOPs. Đã chọn: ${selectedSops.length}` : `${tier} allows ${TIER_SOP_COUNTS[tier]} SOPs. Selected: ${selectedSops.length}`}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {AGENCY_SOP_MAP[agencyType].map((slug) => {
          const checked = selectedSops.includes(slug);
          return (
            <label key={slug} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-primary-500/60 bg-primary-500/10' : 'border-border-700 bg-muted-900/50 hover:border-border-600'}`}>
              <input type="checkbox" className="accent-violet-500" checked={checked} onChange={() => toggleSop(slug)} />
              <span className="text-sm font-mono text-muted-foreground-200">{slug}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface Step3Props { form: FormState; selectedSops: string[]; isVi: boolean }

export function Step3Configuration({ form, selectedSops, isVi }: Step3Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-muted-foreground-100">{isVi ? 'Cấu hình ban đầu' : 'Initial Configuration'}</h2>
      <div className="rounded-xl border border-border-700 bg-muted-900/50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground-300">{isVi ? 'API Keys (khách hàng cung cấp sau)' : 'API Keys (customer provides later)'}</h3>
        {[
          { label: 'HeyGen API Key', note: isVi ? 'Khách tự cung cấp qua setup-wizard' : 'Customer provides via setup-wizard' },
          { label: 'Resend API Key', note: isVi ? 'Cùng cách — tùy chọn' : 'Same — optional' },
          { label: 'NOWPayments', note: isVi ? 'Dùng default platform HOẶC khách cung cấp' : 'Platform default OR customer provides' },
        ].map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-2">
            <span className="text-sm text-muted-foreground-300">{item.label}</span>
            <span className="text-xs text-muted-foreground-500 text-right max-w-[60%]">{item.note}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <h3 className="text-sm font-semibold text-blue-300 mb-2">{isVi ? 'Tóm tắt bàn giao' : 'Handover Summary'}</h3>
        <div className="space-y-1 text-sm text-muted-foreground-300">
          <p><span className="text-muted-foreground-500">{isVi ? 'Agency:' : 'Agency:'}</span> {form.agencyName}</p>
          <p><span className="text-muted-foreground-500">Email:</span> {form.ownerEmail}</p>
          <p><span className="text-muted-foreground-500">{isVi ? 'Gói:' : 'Tier:'}</span> {form.tier}</p>
          <p><span className="text-muted-foreground-500">SOPs:</span> {selectedSops.length} {isVi ? 'đã chọn' : 'selected'}</p>
          <p><span className="text-muted-foreground-500">{isVi ? 'Ngôn ngữ:' : 'Locale:'}</span> {form.locale}</p>
        </div>
      </div>
    </div>
  );
}

// Step4Result moved to handover-wizard-step4-result.tsx
