'use client';

import * as React from 'react';
import { cn } from '@/seed/utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

const Pagination = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & {
    totalItems: number;
    itemsPerPage: number;
    currentPage: number;
    onPageChange: (page: number) => void;
  }
>(({ totalItems, itemsPerPage, currentPage, onPageChange, className, ...props }, ref) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  return (
    <nav
      ref={ref}
      aria-label="pagination"
      className={cn('flex items-center justify-center gap-2', className)}
      {...props}
    />
  );
});
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentPropsWithoutRef<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

const PaginationLink = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'> & {
    isActive?: boolean;
  }
>(({ className, isActive, children, ...props }, ref) => (
  <button
    ref={ref}
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      'flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      className
    )}
    {...props}
  >
    {children}
  </button>
));
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>(({ className, ...props }, ref) => (
  <Button
    ref={ref}
    variant="outline"
    size="icon"
    className={cn('h-9 w-9', className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span className="sr-only">Previous page</span>
  </Button>
));
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>(({ className, ...props }, ref) => (
  <Button
    ref={ref}
    variant="outline"
    size="icon"
    className={cn('h-9 w-9', className)}
    {...props}
  >
    <ChevronRight className="h-4 w-4" />
    <span className="sr-only">Next page</span>
  </Button>
));
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
));
PaginationEllipsis.displayName = 'PaginationEllipsis';

// Helper component for more icon
function MoreHorizontal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
