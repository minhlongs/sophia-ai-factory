/**
 * Interactive Client Video Review & Approval Portal Page
 *
 * Route: /[locale]/client-review/[token]
 * - Server Component fetching review token payload, client branding & status
 * - Renders interactive ClientVideoReviewPortal with bilingual support
 * - Fail-safe invalid token / expired token state rendering
 *
 * @module app/[locale]/client-review/[token]/page
 */

import React from 'react';
import type { Metadata } from 'next';
import { getD1 } from '@/seed/db/client';
import { resolveReviewByToken } from '@/tree/organizations/review-service';
import { ClientVideoReviewPortal } from '@/forest/agency/client-video-review-portal';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { VideoReviewPayload } from '@/seed/types/agency-multitenancy';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    locale: string;
    token: string;
  }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, token } = await props.params;
  const isVi = locale === 'vi';

  const defaultTitle = isVi
    ? 'Duyệt Video Khách Hàng | Sophia AI Factory'
    : 'Client Video Review | Sophia AI Factory';

  try {
    const db = await getD1();
    if (!db) return { title: defaultTitle };
    const review = await resolveReviewByToken(db, token);
    const clientName = review.subaccountBranding?.clientName;
    const title = clientName
      ? `${isVi ? 'Duyệt Video' : 'Review Video'}: ${review.videoTitle} — ${clientName}`
      : `${isVi ? 'Duyệt Video' : 'Review Video'}: ${review.videoTitle}`;
    return {
      title,
      description: isVi
        ? 'Cổng phê duyệt video bản thảo và gửi góp ý trực tiếp.'
        : 'Interactive draft video preview, feedback, and approval portal.',
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: defaultTitle,
      robots: { index: false, follow: false },
    };
  }
}

export default async function ClientReviewPage(props: PageProps) {
  const { locale, token } = await props.params;
  const isVi = locale === 'vi';

  let review: VideoReviewPayload | null = null;
  let errorState: string | null = null;

  try {
    const db = await getD1();
    if (!db) {
      errorState = isVi
        ? 'Dịch vụ lưu trữ dữ liệu tạm thời không khả dụng. Vui lòng thử lại sau.'
        : 'Database service is temporarily unavailable. Please refresh or try again shortly.';
    } else {
      review = await resolveReviewByToken(db, token);
      if (review.isExpired) {
        errorState = isVi
          ? 'Liên kết duyệt video này đã hết hạn. Vui lòng liên hệ agency để nhận liên kết mới.'
          : 'This video review link has expired. Please contact your managing agency for a new link.';
        review = null;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('REVIEW_NOT_FOUND')) {
      errorState = isVi
        ? 'Liên kết duyệt video không tồn tại hoặc mã truy cập không chính xác.'
        : 'This video review link does not exist or the token is invalid.';
    } else {
      errorState = isVi
        ? 'Không thể tải bản thảo video. Vui lòng liên hệ Agency phụ trách.'
        : 'Unable to load video draft. Please contact your managing agency.';
    }
  }

  if (errorState || !review) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl border border-red-500/30 bg-slate-900/90 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-white">
            {isVi ? 'Không thể truy cập bản thảo' : 'Unable to Access Video Review'}
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            {errorState || (isVi ? 'Liên kết không hợp lệ.' : 'Invalid link.')}
          </p>
          <div className="pt-2 text-[11px] text-slate-500">
            {isVi
              ? 'Nếu bạn cho rằng đây là sự cố, vui lòng liên hệ trực tiếp với người gửi.'
              : 'If you believe this is an error, please reach out to your agency contact.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClientVideoReviewPortal
      review={review}
      locale={isVi ? 'vi' : 'en'}
    />
  );
}
