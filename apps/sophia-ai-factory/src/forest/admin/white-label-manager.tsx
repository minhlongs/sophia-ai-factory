'use client';

/**
 * Interactive Enterprise White-Label & Custom Domain Manager.
 *
 * Provides:
 * 1. Custom Domain registration, DNS CNAME/TXT instructions table, status polling & deletion.
 * 2. Live Brand Customizer (Logo, Favicon, Primary/Accent colors, Agency Name, Page Title, Footer).
 * 3. Real-time Live Interactive Preview Card with contrast calculation.
 *
 * Layer: forest (UI component composition)
 * Allowed imports: react, lucide-react, next-intl, @/seed/*, @/tree/*, @/land/admin/*
 *
 * @module forest/admin/white-label-manager
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Globe,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  RefreshCw,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Palette,
  Eye,
  ArrowRight,
} from 'lucide-react';
import type {
  CustomDomainRecord,
  CustomDomainError,
  DomainVerificationResult,
  WhiteLabelBrandingSettings,
  SaveWhiteLabelBrandingInput,
  WhiteLabelActionError,
} from '@/seed/types/custom-domains';
import type { Result } from '@/seed/types/result';
import { computeContrastColor } from '@/tree/branding/theme-resolver';

export interface WhiteLabelManagerActions {
  registerCustomDomain?: (
    orgId: string,
    rawHostname: string,
  ) => Promise<Result<CustomDomainRecord, CustomDomainError>>;
  verifyCustomDomainStatus?: (
    orgId: string,
    domainId: string,
  ) => Promise<Result<DomainVerificationResult, CustomDomainError>>;
  deleteCustomDomain?: (
    orgId: string,
    domainId: string,
  ) => Promise<Result<{ success: boolean; domainId: string }, CustomDomainError>>;
  saveWhiteLabelBrandingSettings?: (
    orgId: string,
    input: SaveWhiteLabelBrandingInput,
  ) => Promise<Result<WhiteLabelBrandingSettings, WhiteLabelActionError>>;
}

export interface WhiteLabelManagerProps {
  orgId: string;
  initialDomains?: CustomDomainRecord[];
  initialBranding?: Partial<WhiteLabelBrandingSettings> | null;
  actions?: WhiteLabelManagerActions;
}

const PRESET_SWATCHES = [
  { name: 'Electric Indigo', hex: '#6366F1' },
  { name: 'Purple Royalty', hex: '#7C3AED' },
  { name: 'Emerald Mint', hex: '#10B981' },
  { name: 'Crimson Rose', hex: '#F43F5E' },
  { name: 'Cyber Amber', hex: '#F59E0B' },
  { name: 'Neon Cyan', hex: '#06B6D4' },
];

export function WhiteLabelManager({
  orgId,
  initialDomains = [],
  initialBranding = null,
  actions,
}: WhiteLabelManagerProps) {
  const t = useTranslations('whiteLabel');

  // Domains State
  const [domains, setDomains] = useState<CustomDomainRecord[]>(initialDomains);
  const [newHostname, setNewHostname] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Branding Customizer State
  const [agencyName, setAgencyName] = useState(initialBranding?.agencyName ?? '');
  const [logoUrl, setLogoUrl] = useState(initialBranding?.logoUrl ?? '');
  const [faviconUrl, setFaviconUrl] = useState(initialBranding?.faviconUrl ?? '');
  const [primaryColor, setPrimaryColor] = useState(initialBranding?.primaryColor ?? '#6366F1');
  const [accentColor, setAccentColor] = useState(initialBranding?.accentColor ?? '#F59E0B');
  const [pageTitle, setPageTitle] = useState(initialBranding?.pageTitle ?? '');
  const [footerText, setFooterText] = useState(initialBranding?.footerText ?? '');

  const [brandingSuccess, setBrandingSuccess] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'domains' | 'branding' | 'preview'>('domains');

  // Computed contrast colors for live preview
  const primaryContrast = computeContrastColor(primaryColor);
  const _accentContrast = computeContrastColor(accentColor);
  void _accentContrast;

  // Copy helper
  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Add Domain Handler
  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostname.trim()) {
      setDomainError(t('errors.domainRequired'));
      return;
    }

    setDomainError(null);
    setDomainSuccess(null);
    setIsAddingDomain(true);

    try {
      if (!actions?.registerCustomDomain) {
        setDomainError(t('errors.domainRequired'));
        return;
      }
      const res = await actions.registerCustomDomain(orgId, newHostname.trim());
      if (res.ok) {
        setDomains((prev) => [res.value, ...prev]);
        setDomainSuccess(t('domains.alerts.registeredSuccess', { hostname: res.value.hostname }));
        setNewHostname('');
      } else {
        setDomainError(res.error.message || t('errors.domainRequired'));
      }
    } finally {
      setIsAddingDomain(false);
    }
  };

  // Re-verify Domain Handler
  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    setDomainError(null);
    setDomainSuccess(null);

    if (!actions?.verifyCustomDomainStatus) {
      setDomainError(t('errors.verifyFailed'));
      setVerifyingDomainId(null);
      return;
    }

    const res = await actions.verifyCustomDomainStatus(orgId, domainId);
    setVerifyingDomainId(null);

    if (res.ok) {
      setDomains((prev) =>
        prev.map((d) =>
          d.id === domainId
            ? {
                ...d,
                ssl_status: res.value.sslStatus,
                verification_status: res.value.verificationStatus,
                cname_verified: res.value.cnameVerified,
                active: res.value.active,
                ownership_verification: res.value.ownershipVerification ?? null,
                ssl_verification: res.value.sslVerification ?? null,
              }
            : d,
        ),
      );
      setDomainSuccess(t('domains.alerts.verifiedSuccess'));
    } else {
      setDomainError(res.error.message || t('errors.verifyFailed'));
    }
  };

  // Delete Domain Handler
  const handleDeleteDomain = async (domainId: string, hostname: string) => {
    if (!confirm(t('domains.actions.confirmDelete', { hostname }))) return;

    setDeletingDomainId(domainId);
    setDomainError(null);
    setDomainSuccess(null);

    if (!actions?.deleteCustomDomain) {
      setDomainError(t('errors.deleteFailed'));
      setDeletingDomainId(null);
      return;
    }

    const res = await actions.deleteCustomDomain(orgId, domainId);
    setDeletingDomainId(null);

    if (res.ok) {
      setDomains((prev) => prev.filter((d) => d.id !== domainId));
      setDomainSuccess(t('domains.alerts.deletedSuccess'));
    } else {
      setDomainError(res.error.message || t('errors.deleteFailed'));
    }
  };

  // Save Branding Handler
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingError(null);
    setBrandingSuccess(null);
    setIsSavingBranding(true);

    const payload: SaveWhiteLabelBrandingInput = {
      agencyName: agencyName.trim() || null,
      logoUrl: logoUrl.trim() || null,
      faviconUrl: faviconUrl.trim() || null,
      primaryColor,
      accentColor,
      pageTitle: pageTitle.trim() || null,
      footerText: footerText.trim() || null,
    };

    try {
      if (!actions?.saveWhiteLabelBrandingSettings) {
        setBrandingError(t('errors.saveFailed'));
        return;
      }
      const res = await actions.saveWhiteLabelBrandingSettings(orgId, payload);
      if (res.ok) {
        setBrandingSuccess(t('branding.actions.saved'));
      } else {
        setBrandingError(res.error.message || t('errors.saveFailed'));
      }
    } finally {
      setIsSavingBranding(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = () => {
    setPrimaryColor('#6366F1');
    setAccentColor('#F59E0B');
    setAgencyName('');
    setLogoUrl('');
    setFaviconUrl('');
    setPageTitle('');
    setFooterText('');
    setBrandingSuccess(null);
    setBrandingError(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 text-zinc-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Globe className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('title')}</h1>
          </div>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">{t('subtitle')}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('domains')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'domains'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            {t('tabs.domains')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'branding'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            {t('tabs.branding')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'preview'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            {t('tabs.preview')}
          </button>
        </div>
      </div>

      {/* ── TAB 1: CUSTOM DOMAINS ────────────────────────────────────────────── */}
      {activeTab === 'domains' && (
        <div className="space-y-6">
          {/* Add Domain Card */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              {t('domains.addButton')}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">{t('domains.description')}</p>

            <form onSubmit={handleAddDomain} className="mt-5 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                  placeholder={t('domains.inputPlaceholder')}
                  disabled={isAddingDomain}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isAddingDomain || !newHostname.trim()}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all"
              >
                {isAddingDomain ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {t('domains.adding')}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {t('domains.addButton')}
                  </>
                )}
              </button>
            </form>

            {domainError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{domainError}</span>
              </div>
            )}

            {domainSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{domainSuccess}</span>
              </div>
            )}
          </div>

          {/* Domains List */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{t('domains.title')}</h3>
                <span className="text-xs text-zinc-400">
                  {domains.length} {t('domains.table.hostname').toLowerCase()}
                </span>
              </div>
            </div>

            {domains.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Globe className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h4 className="text-sm font-medium text-zinc-300">{t('domains.emptyTitle')}</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                  {t('domains.emptyDescription')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80">
                {domains.map((dom) => {
                  const isSslActive = dom.ssl_status === 'active';
                  const isVerified =
                    dom.verification_status === 'verified' || dom.verification_status === 'active';

                  // Parse DNS info
                  const ownership =
                    typeof dom.ownership_verification === 'string'
                      ? (JSON.parse(dom.ownership_verification || '{}') as {
                          type?: string;
                          name?: string;
                          value?: string;
                        })
                      : (dom.ownership_verification as {
                          type?: string;
                          name?: string;
                          value?: string;
                        } | null);

                  const sslDcv =
                    typeof dom.ssl_verification === 'string'
                      ? (JSON.parse(dom.ssl_verification || '{}') as {
                          type?: string;
                          name?: string;
                          value?: string;
                        })
                      : (dom.ssl_verification as {
                          type?: string;
                          name?: string;
                          value?: string;
                        } | null);

                  return (
                    <div key={dom.id} className="p-6 space-y-5">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-base font-bold text-white tracking-wide">
                              {dom.hostname}
                            </span>
                            <a
                              href={`https://${dom.hostname}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* SSL Status Badge */}
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                                isSslActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : dom.ssl_status === 'error'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {isSslActive ? (
                                <ShieldCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Clock className="w-3.5 h-3.5" />
                              )}
                              {isSslActive
                                ? t('domains.status.active')
                                : dom.ssl_status === 'pending_validation'
                                  ? t('domains.status.pendingValidation')
                                  : dom.ssl_status === 'pending_deployment'
                                    ? t('domains.status.pendingDeployment')
                                    : t('domains.status.error')}
                            </span>

                            {/* Verification Badge */}
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                                isVerified
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                              }`}
                            >
                              {isVerified ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5" />
                              )}
                              {isVerified
                                ? t('domains.status.verified')
                                : t('domains.status.pending')}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerifyDomain(dom.id)}
                            disabled={verifyingDomainId === dom.id}
                            className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-medium text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-700 transition-all"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${
                                verifyingDomainId === dom.id ? 'animate-spin' : ''
                              }`}
                            />
                            {verifyingDomainId === dom.id
                              ? t('domains.actions.verifying')
                              : t('domains.actions.verify')}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDomain(dom.id, dom.hostname)}
                            disabled={deletingDomainId === dom.id}
                            className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deletingDomainId === dom.id
                              ? t('domains.actions.deleting')
                              : t('domains.actions.delete')}
                          </button>
                        </div>
                      </div>

                      {/* DNS Instructions Table */}
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
                        <div className="text-xs font-semibold text-zinc-300">
                          {t('domains.dnsInstructions.title')}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-zinc-400">
                            <thead>
                              <tr className="border-b border-zinc-800 text-zinc-500 font-mono">
                                <th className="pb-2">Type</th>
                                <th className="pb-2">{t('domains.dnsInstructions.cnameHost')}</th>
                                <th className="pb-2">{t('domains.dnsInstructions.cnameTarget')}</th>
                                <th className="pb-2 text-right">Copy</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
                              {/* CNAME Routing Record */}
                              <tr>
                                <td className="py-2 text-indigo-400 font-bold">CNAME</td>
                                <td className="py-2 text-zinc-200">{dom.hostname}</td>
                                <td className="py-2 text-zinc-200">
                                  {dom.cname_target || 'cname.sophia.agencyos.network'}
                                </td>
                                <td className="py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopy(
                                        `cname-${dom.id}`,
                                        dom.cname_target || 'cname.sophia.agencyos.network',
                                      )
                                    }
                                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                                  >
                                    {copiedKey === `cname-${dom.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </td>
                              </tr>

                              {/* TXT Ownership Record */}
                              {ownership?.name && ownership?.value && (
                                <tr>
                                  <td className="py-2 text-amber-400 font-bold">
                                    {ownership.type || 'TXT'}
                                  </td>
                                  <td className="py-2 text-zinc-200 max-w-[200px] truncate">
                                    {ownership.name}
                                  </td>
                                  <td className="py-2 text-zinc-200 max-w-[250px] truncate">
                                    {ownership.value}
                                  </td>
                                  <td className="py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(`txt-${dom.id}`, ownership.value!)}
                                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                                    >
                                      {copiedKey === `txt-${dom.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              )}

                              {/* SSL DCV Validation Record */}
                              {sslDcv?.name && sslDcv?.value && (
                                <tr>
                                  <td className="py-2 text-cyan-400 font-bold">
                                    {sslDcv.type || 'TXT'}
                                  </td>
                                  <td className="py-2 text-zinc-200 max-w-[200px] truncate">
                                    {sslDcv.name}
                                  </td>
                                  <td className="py-2 text-zinc-200 max-w-[250px] truncate">
                                    {sslDcv.value}
                                  </td>
                                  <td className="py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(`ssl-${dom.id}`, sslDcv.value!)}
                                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                                    >
                                      {copiedKey === `ssl-${dom.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: BRANDING CUSTOMIZER ───────────────────────────────────────── */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Column */}
          <div className="lg:col-span-7 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Palette className="w-5 h-5 text-indigo-400" />
                {t('branding.title')}
              </h2>
              <p className="text-sm text-zinc-400 mt-1">{t('branding.description')}</p>
            </div>

            <form onSubmit={handleSaveBranding} className="space-y-5">
              {/* Agency Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {t('branding.fields.agencyName')}
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder={t('branding.fields.agencyNamePlaceholder')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Logo URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {t('branding.fields.logoUrl')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder={t('branding.fields.logoUrlPlaceholder')}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {logoUrl && (
                    <div className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-950 p-1 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Favicon URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {t('branding.fields.faviconUrl')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder={t('branding.fields.faviconUrlPlaceholder')}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {faviconUrl && (
                    <div className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-950 p-1 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={faviconUrl}
                        alt="Favicon Preview"
                        className="w-5 h-5 object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Colors Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Primary Color */}
                <div className="space-y-2 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300">
                      {t('branding.fields.primaryColor')}
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400">{primaryColor}</span>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {t('branding.fields.primaryColorHelp')}
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    {PRESET_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => setPrimaryColor(swatch.hex)}
                        className="w-5 h-5 rounded-full border border-white/20 transition-transform hover:scale-110"
                        style={{ backgroundColor: swatch.hex }}
                        title={swatch.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-2 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300">
                      {t('branding.fields.accentColor')}
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400">{accentColor}</span>
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {t('branding.fields.accentColorHelp')}
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    {PRESET_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => setAccentColor(swatch.hex)}
                        className="w-5 h-5 rounded-full border border-white/20 transition-transform hover:scale-110"
                        style={{ backgroundColor: swatch.hex }}
                        title={swatch.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Page Title & Footer Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {t('branding.fields.pageTitle')}
                </label>
                <input
                  type="text"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder={t('branding.fields.pageTitlePlaceholder')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {t('branding.fields.footerText')}
                </label>
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder={t('branding.fields.footerTextPlaceholder')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {brandingError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{brandingError}</span>
                </div>
              )}

              {brandingSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{brandingSuccess}</span>
                </div>
              )}

              {/* Submit / Reset Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  {t('branding.actions.reset')}
                </button>

                <button
                  type="submit"
                  disabled={isSavingBranding}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg transition-all"
                >
                  {isSavingBranding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {t('branding.actions.saving')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {t('branding.actions.save')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Real-time Side Preview */}
          <div className="lg:col-span-5 sticky top-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-400" />
                {t('preview.title')}
              </span>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold"
                style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
              >
                LIVE
              </span>
            </div>

            {/* Simulated Window Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
              {/* Window Bar */}
              <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <div className="mx-auto text-[11px] font-mono text-zinc-400 px-3 py-0.5 rounded bg-zinc-950 border border-zinc-800/80 truncate max-w-[200px]">
                  {pageTitle || (agencyName ? `${agencyName} Portal` : 'Sophia AI Factory')}
                </div>
              </div>

              {/* Portal Header */}
              <div className="px-5 py-3 border-b border-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="Brand Logo"
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: primaryColor,
                        color: primaryContrast.hex,
                      }}
                    >
                      {agencyName ? agencyName.charAt(0).toUpperCase() : 'S'}
                    </div>
                  )}
                  <span className="text-xs font-bold text-white tracking-tight">
                    {agencyName || 'Sophia AI Studio'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                  <span className="hover:text-white transition-colors">{t('preview.navHome')}</span>
                  <span className="hover:text-white transition-colors">
                    {t('preview.navCampaigns')}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: `${accentColor}26`,
                      color: accentColor,
                    }}
                  >
                    {t('preview.badge')}
                  </span>
                </div>
              </div>

              {/* Hero Preview */}
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase"
                    style={{
                      backgroundColor: `${primaryColor}1a`,
                      color: primaryColor,
                      border: `1px solid ${primaryColor}40`,
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    White-Label Edge Portal
                  </div>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {t('preview.heroHeading')}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t('preview.heroSubheading')}
                  </p>
                </div>

                {/* Simulated Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-transform hover:scale-105"
                    style={{
                      backgroundColor: primaryColor,
                      color: primaryContrast.hex,
                    }}
                  >
                    {t('preview.primaryCta')}
                  </button>
                  <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 border border-zinc-800 hover:bg-zinc-900 transition-colors"
                  >
                    {t('preview.secondaryCta')}
                  </button>
                </div>

                {/* Sample Feature Card */}
                <div
                  className="rounded-xl p-3.5 border bg-zinc-900/50 space-y-1.5"
                  style={{ borderColor: `${accentColor}33` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                    <span className="text-xs font-semibold text-white">
                      {t('preview.sampleCardTitle')}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">{t('preview.sampleCardDesc')}</p>
                </div>

                {/* Simulated Footer */}
                <div className="pt-4 border-t border-zinc-900 text-[10px] text-zinc-500 text-center">
                  {footerText || `© 2026 ${agencyName || 'Sophia AI'}. All rights reserved.`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: FULL LIVE PREVIEW ─────────────────────────────────────────── */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-800 p-4 rounded-xl text-xs text-zinc-400">
            <div>
              <h2 className="text-base font-semibold text-white">{t('preview.title')}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{t('preview.subtitle')}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                Primary: {primaryColor}
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
                Accent: {accentColor}
              </span>
            </div>
          </div>

          {/* Full Screen Portal Simulation Card */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
            {/* Navigation Header */}
            <header className="px-8 py-4 border-b border-zinc-900 flex items-center justify-between backdrop-blur-md bg-zinc-950/80 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: primaryColor, color: primaryContrast.hex }}
                  >
                    {agencyName ? agencyName.charAt(0).toUpperCase() : 'S'}
                  </div>
                )}
                <div>
                  <span className="text-sm font-bold text-white tracking-tight">
                    {agencyName || 'Sophia AI Factory'}
                  </span>
                  <div className="text-[10px] text-zinc-400">Enterprise AI Portal</div>
                </div>
              </div>

              <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-300">
                <span className="text-white hover:text-white cursor-pointer transition-colors">
                  {t('preview.navHome')}
                </span>
                <span className="hover:text-white cursor-pointer transition-colors">
                  {t('preview.navCampaigns')}
                </span>
                <span className="hover:text-white cursor-pointer transition-colors">
                  {t('preview.navAnalytics')}
                </span>
              </nav>

              <div className="flex items-center gap-3">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: `${accentColor}26`, color: accentColor }}
                >
                  {t('preview.badge')}
                </span>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs font-bold shadow-lg"
                  style={{ backgroundColor: primaryColor, color: primaryContrast.hex }}
                >
                  {t('preview.primaryCta')}
                </button>
              </div>
            </header>

            {/* Hero Banner */}
            <div className="px-8 py-16 text-center space-y-6 max-w-3xl mx-auto">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: `${primaryColor}1a`,
                  color: primaryColor,
                  border: `1px solid ${primaryColor}40`,
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {agencyName ? `${agencyName} White-Label Engine` : 'Sovereign AI Video Infrastructure'}
              </div>

              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                {pageTitle || t('preview.heroHeading')}
              </h2>

              <p className="text-sm md:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
                {t('preview.heroSubheading')}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold shadow-xl flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor, color: primaryContrast.hex }}
                >
                  <span>{t('preview.primaryCta')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold text-zinc-300 border border-zinc-800 hover:bg-zinc-900 transition-colors"
                >
                  {t('preview.secondaryCta')}
                </button>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="px-8 pb-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3"
                  style={{
                    borderTop: `2px solid ${idx === 2 ? accentColor : primaryColor}`,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: idx === 2 ? `${accentColor}1f` : `${primaryColor}1f`,
                      color: idx === 2 ? accentColor : primaryColor,
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    {t('preview.sampleCardTitle')} #{idx}
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t('preview.sampleCardDesc')}
                  </p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <footer className="px-8 py-6 border-t border-zinc-900 text-xs text-zinc-500 text-center">
              {footerText || `© 2026 ${agencyName || 'Sophia AI'}. All rights reserved.`}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
