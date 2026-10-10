import React from 'react';
import { Clock, CheckCircle, FileText } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  variant?: 'default' | 'muted' | 'success' | 'primary' | 'warning';
}

export function StatCard({
  title,
  value,
  icon,
  variant = 'default',
}: StatCardProps) {
  const iconMap: Record<string, React.ReactNode> = {
    Clock: <Clock className="w-5 h-5" />,
    CheckCircle: <CheckCircle className="w-5 h-5" />,
    FileText: <FileText className="w-5 h-5" />,
  };

  const variantClasses = {
    default: 'bg-card border',
    muted: 'bg-card border border-muted',
    success: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    primary: 'bg-primary/10 border-primary/30',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
  };

  return (
    <div className={variantClasses[variant] + ' rounded-lg p-6'}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="text-primary">{iconMap[icon]}</div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
