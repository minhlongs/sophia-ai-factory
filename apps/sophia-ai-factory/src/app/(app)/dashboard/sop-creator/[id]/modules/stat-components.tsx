import React from 'react';
import { DollarSign, Download, Star, Calendar } from 'lucide-react';

export function StatusBadge({
  status,
  labels,
}: {
  status: string;
  labels: Record<string, string>;
}) {
  const statusConfig: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
    published: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    archived: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
    pending_review: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}
    >
      {labels[status] || status}
    </span>
  );
}

export function StatCard({
  title,
  value,
  icon,
  variant = 'default',
}: {
  title: string;
  value: string;
  icon: string;
  variant?: 'default' | 'muted' | 'success' | 'primary';
}) {
  const iconMap: Record<string, React.ReactNode> = {
    DollarSign: <DollarSign className="w-5 h-5" />,
    Download: <Download className="w-5 h-5" />,
    Star: <Star className="w-5 h-5" />,
    Calendar: <Calendar className="w-5 h-5" />,
  };

  const variantClasses = {
    default: 'bg-card border',
    muted: 'bg-card border border-muted',
    success: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    primary: 'bg-primary/10 border-primary/30',
  };

  return (
    <div className={variantClasses[variant] + ' rounded-lg p-5'}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="text-primary">{iconMap[icon]}</div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
