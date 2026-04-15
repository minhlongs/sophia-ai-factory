'use client';

/**
 * License List Pagination
 * Previous/Next pagination controls with count summary
 */

import { Button } from '@/components/ui/button';

interface LicenseListPaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function LicenseListPagination({
  page,
  limit,
  total,
  onPageChange,
}: LicenseListPaginationProps) {
  if (total <= limit) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-muted-foreground">
        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="border-border"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page * limit >= total}
          className="border-border"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
