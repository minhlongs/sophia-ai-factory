/**
 * /dashboard/admin/branding — Client component for white-label branding configuration.
 *
 * Lets MASTER-tier operators select an organization and configure its white-label
 * branding: agency name, logo URL, primary color, watermark policy, and position.
 *
 * @module app/[locale]/dashboard/admin/branding/branding-form
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { updateWhiteLabelBranding, getWhiteLabelBranding } from '@/land/billing/white-label';
import type { OrgRow } from '@/land/admin/org-manager';
import type { OrgBrandingRow, WatermarkPosition, WatermarkPolicy } from '@/tree/branding/org-branding-repo';

// ── Props ──────────────────────────────────────────────────────────────

interface BrandingFormProps {
  orgs: OrgRow[];
}

// ── Constants ──────────────────────────────────────────────────────────

const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' },
];

const WATERMARK_POLICIES: { value: WatermarkPolicy; label: string }[] = [
  { value: 'always', label: 'Always' },
  { value: 'master_plus', label: 'Master+' },
  { value: 'never', label: 'Never' },
];

// ── Main Component ─────────────────────────────────────────────────────

export function BrandingForm({ orgs }: BrandingFormProps): React.JSX.Element {
  const t = useTranslations('admin.branding');

  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [watermarkPolicy, setWatermarkPolicy] = useState<WatermarkPolicy>('master_plus');
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottom-right');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Load existing branding when org changes ──────────────────────────

  const handleOrgChange = useCallback(async (orgId: string) => {
    setSelectedOrgId(orgId);
    setSaveSuccess(null);
    setSaveError(null);

    if (!orgId) {
      resetForm();
      return;
    }

    setLoading(true);
    try {
      const result = await getWhiteLabelBranding(orgId);
      if (result.ok && result.value) {
        const branding = result.value;
        setAgencyName(branding.agency_name ?? '');
        setLogoUrl(branding.logo_url ?? '');
        setPrimaryColor(branding.primary_color ?? '#6366f1');
        setWatermarkPolicy(branding.watermark_policy);
        setWatermarkPosition(branding.watermark_position);
      } else {
        resetForm();
      }
    } catch {
      resetForm();
    } finally {
      setLoading(false);
    }
  }, []);

  function resetForm(): void {
    setAgencyName('');
    setLogoUrl('');
    setPrimaryColor('#6366f1');
    setWatermarkPolicy('master_plus');
    setWatermarkPosition('bottom-right');
  }

  // ── Save ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!selectedOrgId) return;

    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const result = await updateWhiteLabelBranding(selectedOrgId, {
        agencyName: agencyName.trim() || null,
        logoUrl: logoUrl.trim() || null,
        primaryColor: primaryColor.trim() || null,
        watermarkPolicy,
        watermarkPosition,
      });

      if (result.ok) {
        setSaveSuccess(t('brandingSaved'));
      } else {
        setSaveError(result.error.message);
      }
    } catch {
      setSaveError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }, [selectedOrgId, agencyName, logoUrl, primaryColor, watermarkPolicy, watermarkPosition, t]);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Org selector */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="org-select" className="text-xs text-muted-foreground">
            Organization
          </label>
          <select
            id="org-select"
            value={selectedOrgId}
            onChange={(e) => handleOrgChange(e.target.value)}
            className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
          >
            <option value="">Select an organization...</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.memberCount} members)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Branding form */}
      {selectedOrgId && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
          <h2 className="text-lg font-semibold">{t('brandingSettings')}</h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Agency name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="agency-name" className="text-xs text-muted-foreground">
                  {t('agencyName')}
                </label>
                <input
                  id="agency-name"
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="My Agency"
                  className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                />
              </div>

              {/* Logo URL */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="logo-url" className="text-xs text-muted-foreground">
                  {t('logoUrl')}
                </label>
                <input
                  id="logo-url"
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                />
                {logoUrl && (
                  <div className="mt-1 flex items-center gap-2">
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="w-8 h-8 rounded object-contain bg-white/10"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="text-[10px] text-muted-foreground">Preview</span>
                  </div>
                )}
              </div>

              {/* Primary color */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="primary-color" className="text-xs text-muted-foreground">
                  {t('primaryColor')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="primary-color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-border"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#6366f1"
                    className="flex-1 rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 font-mono"
                  />
                </div>
              </div>

              {/* Watermark policy */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="watermark-policy" className="text-xs text-muted-foreground">
                  {t('watermarkPolicy')}
                </label>
                <select
                  id="watermark-policy"
                  value={watermarkPolicy}
                  onChange={(e) => setWatermarkPolicy(e.target.value as WatermarkPolicy)}
                  className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                >
                  {WATERMARK_POLICIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Watermark position */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="watermark-position" className="text-xs text-muted-foreground">
                  {t('watermarkPosition')}
                </label>
                <select
                  id="watermark-position"
                  value={watermarkPosition}
                  onChange={(e) => setWatermarkPosition(e.target.value as WatermarkPosition)}
                  className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                >
                  {WATERMARK_POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Status messages */}
              {saveSuccess && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {saveSuccess}
                </div>
              )}

              {saveError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {saveError}
                </div>
              )}

              {/* Save button */}
              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1" aria-hidden="true" />
                      {t('saveBranding')}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* No org selected message */}
      {!selectedOrgId && orgs.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <PaletteIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('selectOrgPrompt')}</p>
        </div>
      )}

      {orgs.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('noOrgs')}</p>
        </div>
      )}
    </div>
  );
}

// ── Helper icon component ──────────────────────────────────────────────

function PaletteIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-10-10-10z" />
    </svg>
  );
}
