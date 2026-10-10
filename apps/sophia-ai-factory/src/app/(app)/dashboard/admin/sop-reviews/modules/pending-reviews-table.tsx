import React from 'react';
import { FileText } from 'lucide-react';
import { SopReviewActionsClient } from '../sop-review-actions-client';
import type { SopListing } from './types';

export interface PendingReviewsTableProps {
  listings: SopListing[];
  locale: string;
  t: (key: string) => string;
  formatDate: (timestamp: number) => string;
  formatPrice: (cents: number) => string;
}

export function PendingReviewsTable({
  listings,
  locale,
  t,
  formatDate,
  formatPrice,
}: PendingReviewsTableProps) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <h2 className="text-lg font-semibold text-foreground">{t('sections.pendingReviews')}</h2>
      </div>

      {listings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="p-4 font-medium">{t('table.columns.title')}</th>
                <th className="p-4 font-medium">{t('table.columns.creator')}</th>
                <th className="p-4 font-medium">{t('table.columns.category')}</th>
                <th className="p-4 font-medium">{t('table.columns.price')}</th>
                <th className="p-4 font-medium">{t('table.columns.submitted')}</th>
                <th className="p-4 font-medium">{t('table.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing: SopListing) => (
                <tr key={listing.id} className="border-b hover:bg-muted/30">
                  <td className="p-4">
                    <div className="font-medium text-foreground">{listing.title}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">
                      {listing.sop_template_id}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-foreground">{listing.creator_name}</div>
                    <div className="text-sm text-muted-foreground">{listing.creator_user_id}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-muted rounded text-sm text-muted-foreground">
                      {listing.category || t('table.uncategorized')}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-foreground">
                    {formatPrice(listing.price_cents)}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {formatDate(listing.created_at)}
                  </td>
                  <td className="p-4">
                    <SopReviewActionsClient
                      listingId={listing.id}
                      locale={locale}
                      labels={{
                        view: t('actions.view'),
                        approve: t('actions.approve'),
                        reject: t('actions.reject'),
                        rejectPrompt: locale === 'vi' ? 'Lý do từ chối (tùy chọn):' : 'Rejection reason (optional):',
                        defaultRejectReason: locale === 'vi' ? 'Không được quản trị viên duyệt' : 'Not approved by admin',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.pending.title')}</h3>
          <p className="text-muted-foreground">{t('empty.pending.description')}</p>
        </div>
      )}
    </div>
  );
}
