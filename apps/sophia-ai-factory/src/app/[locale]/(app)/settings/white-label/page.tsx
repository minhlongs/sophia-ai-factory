export const dynamic = 'force-dynamic';

/**
 * Enterprise White-Label Settings Route (Tenant Organization Settings)
 *
 * Route: /[locale]/(app)/settings/white-label
 * (and /vi/settings/white-label, /en/settings/white-label)
 *
 * @module app/[locale]/(app)/settings/white-label/page
 */

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { listCustomDomainsByOrg } from '@/tree/custom-domains/verification-service';
import { getOrgBranding } from '@/tree/branding/org-branding-repo';
import { WhiteLabelManager } from '@/forest/admin/white-label-manager';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import type { CustomDomainRecord } from '@/seed/types/custom-domains';
import {
  registerCustomDomainAction,
  verifyCustomDomainStatusAction,
  deleteCustomDomainAction,
} from '@/land/admin/custom-domain-actions';
import {
  saveWhiteLabelBrandingSettingsAction,
} from '@/land/admin/white-label-actions';
import { Sparkles, ArrowRight, ShieldCheck, Globe, Palette } from 'lucide-react';

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const isVi = resolved.locale === 'vi';

  return {
    title: isVi
      ? 'Cài Đặt Nhãn Trắng & Tên Miền Tùy Chỉnh — Sophia AI Factory'
      : 'White-Label & Custom Domain Settings — Sophia AI Factory',
    description: isVi
      ? 'Tùy biến nhận diện thương hiệu, tên miền riêng và chứng chỉ SSL cho đại lý.'
      : 'Configure custom domain, automated SSL, and sovereign tenant branding for your agency.',
  };
}

export default async function SettingsWhiteLabelPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?redirect=/settings/white-label`);
  }

  const db = await getD1();
  const { isAdmin } = await isUserAdminWithRole(user);
  const userTier = await getUserTier(user.id);

  const orgId = await resolveOrgId(user.id, db);

  // Check org tier if user is in an org
  let isMasterOrEnterprise = isAdmin || user.role === 'admin' || userTier === 'MASTER' || userTier === 'ENTERPRISE';

  if (!isMasterOrEnterprise && db && orgId) {
    try {
      const orgSub = await db
        .prepare("SELECT tier, plan FROM subscriptions WHERE org_id = ?1 AND status = 'active' LIMIT 1")
        .bind(orgId)
        .first<{ tier: string | null; plan: string | null }>();

      if (
        orgSub?.tier === 'MASTER' ||
        orgSub?.tier === 'ENTERPRISE' ||
        orgSub?.plan?.toLowerCase() === 'master' ||
        orgSub?.plan?.toLowerCase() === 'enterprise'
      ) {
        isMasterOrEnterprise = true;
      }
    } catch {
      // ignore
    }
  }

  // If unauthorized for White-Label (Sub-Master Tier), show enterprise upgrade card
  if (!isMasterOrEnterprise) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-12 md:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              {isVi ? 'Tính Năng Độc Quyền Gói Master & Enterprise' : 'Exclusive to Master & Enterprise Tiers'}
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {isVi ? 'Nhãn Trắng Toàn Diện & Tên Miền Riêng' : 'Full White-Label & Custom Domain Engine'}
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl mx-auto">
              {isVi
                ? 'Nâng cấp lên gói Master ($4,999 trọn đời) hoặc Enterprise ($799/tháng) để sở hữu cổng tạo video AI mang 100% thương hiệu và tên miền riêng của bạn.'
                : 'Upgrade to Master ($4,999 lifetime) or Enterprise ($799/mo) to unlock complete white-label customization, custom hostnames, and automated Cloudflare SSL certificates.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <Globe className="w-6 h-6 text-indigo-400" />
              <h3 className="text-base font-bold text-white">
                {isVi ? 'Tên Miền Tùy Chỉnh' : 'Custom Hostnames'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isVi
                  ? 'Gắn tên miền riêng (VD: portal.agency.com) với chứng chỉ Cloudflare SSL tự động kích hoạt.'
                  : 'Map your sovereign agency domain with automatic Cloudflare for SaaS edge SSL validation.'}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <Palette className="w-6 h-6 text-amber-400" />
              <h3 className="text-base font-bold text-white">
                {isVi ? 'Nhận Diện Thương Hiệu' : 'Custom Brand Palette'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isVi
                  ? 'Tùy biến bảng màu sắc, logo, favicon, tiêu đề trang và văn bản chân trang theo thương hiệu bạn.'
                  : 'Customize logo, favicon, primary/accent color CSS variables, and portal titles seamlessly.'}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <h3 className="text-base font-bold text-white">
                {isVi ? 'Cách Ly Khách Thuê Edge' : 'Edge Tenant Isolation'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isVi
                  ? 'Trích xuất ngữ cảnh khách thuê tức thì tại Cloudflare Edge mà không phát sinh độ trễ.'
                  : 'Real-time host-to-tenant routing at Cloudflare Workers edge with zero database bottlenecks.'}
              </p>
            </div>
          </div>

          <div className="text-center pt-4">
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow-xl transition-all"
            >
              <span>{isVi ? 'Nâng Cấp Gói Master Ngay' : 'Upgrade to Master Tier Now'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // User is authorized: load initial data
  const effectiveOrgId = orgId || `org-${user.id}`;

  let initialDomains: CustomDomainRecord[] = [];
  let initialBranding = null;

  if (db && orgId) {
    try {
      initialDomains = await listCustomDomainsByOrg(db, orgId);
    } catch {
      initialDomains = [];
    }

    try {
      const orgBranding = await getOrgBranding(db, orgId);
      const row = await db
        .prepare(`SELECT value FROM tenant_settings WHERE tenant_id = ?1 AND namespace = 'branding' LIMIT 1`)
        .bind(orgId)
        .first<{ value: string }>();

      let tenantSettings: Partial<BrandingSettings> | null = null;
      if (row?.value) {
        try {
          tenantSettings = JSON.parse(row.value) as Partial<BrandingSettings>;
        } catch {
          // ignore
        }
      }

      initialBranding = {
        orgId,
        agencyName: tenantSettings?.agencyName ?? orgBranding?.agency_name ?? null,
        logoUrl: tenantSettings?.logoUrl ?? orgBranding?.logo_url ?? null,
        faviconUrl: tenantSettings?.faviconUrl ?? DEFAULT_BRANDING.faviconUrl,
        primaryColor: tenantSettings?.primaryColor ?? orgBranding?.primary_color ?? DEFAULT_BRANDING.primaryColor,
        accentColor: tenantSettings?.accentColor ?? DEFAULT_BRANDING.accentColor ?? '#F59E0B',
        pageTitle: tenantSettings?.socialMeta?.title ?? null,
        footerText: tenantSettings?.emailFooter ?? null,
        welcomeMessage: tenantSettings?.welcomeMessage ?? DEFAULT_BRANDING.welcomeMessage,
      };
    } catch {
      initialBranding = null;
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 md:px-8">
      <WhiteLabelManager
        orgId={effectiveOrgId}
        initialDomains={initialDomains}
        initialBranding={initialBranding}
        actions={{
          registerCustomDomain: registerCustomDomainAction,
          verifyCustomDomainStatus: verifyCustomDomainStatusAction,
          deleteCustomDomain: deleteCustomDomainAction,
          saveWhiteLabelBrandingSettings: saveWhiteLabelBrandingSettingsAction,
        }}
      />
    </main>
  );
}
