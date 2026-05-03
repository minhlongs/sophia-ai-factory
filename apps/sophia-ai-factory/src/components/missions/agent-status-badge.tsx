'use client';

/**
 * AgentStatusBadge — displays agent status with appropriate variant
 */

import { Badge } from '@/seed/components/ui/badge';
import type { AgentStatus } from '@/app/api/agents/list/route';

interface AgentStatusBadgeProps {
  status: AgentStatus;
  label: string;
}

const variantMap: Record<AgentStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  idle: 'secondary',
  working: 'default',
  blocked: 'outline',
  error: 'destructive',
};

export function AgentStatusBadge({ status, label }: AgentStatusBadgeProps) {
  const variant = variantMap[status] ?? 'secondary';
  return (
    <Badge
      variant={variant}
      className={status === 'working' ? 'animate-pulse' : undefined}
    >
      {label}
    </Badge>
  );
}
