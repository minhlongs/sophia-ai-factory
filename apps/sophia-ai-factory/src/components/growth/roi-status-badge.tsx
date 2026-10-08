import * as React from 'react';
import { useTranslations } from 'next-intl';

interface RoiStatusBadgeProps {
  status: 'winner' | 'culled' | 'pending';
  className?: string;
}

export function RoiStatusBadge({ status, className = '' }: RoiStatusBadgeProps) {
  const t = useTranslations('Growth');

  let bgColor = 'bg-gray-100 text-gray-800';
  let dotColor = 'bg-gray-500';

  if (status === 'winner') {
    bgColor = 'bg-amber-100 text-amber-800';
    dotColor = 'bg-amber-500';
  } else if (status === 'culled') {
    bgColor = 'bg-red-100 text-red-800';
    dotColor = 'bg-red-500';
  } else if (status === 'pending') {
    bgColor = 'bg-indigo-100 text-indigo-800';
    dotColor = 'bg-indigo-500';
  }

  const labelKey = `status_${status}`;
  const label = t.has(labelKey) ? t(labelKey) : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${className}`}>
      <span className={`mr-1.5 h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
      {label}
    </div>
  );
}
