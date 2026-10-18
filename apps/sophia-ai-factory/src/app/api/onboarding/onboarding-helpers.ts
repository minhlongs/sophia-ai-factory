import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';

export const startSchema = z.object({
  tenantId: z.string().min(1),
  tenantName: z.string().min(1),
  ceoEmail: z.string().email(),
  ceoName: z.string().min(1),
  amEmail: z.string().email().optional(),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE']).optional(),
  pilotStartDate: z.string().datetime().optional(),
});

export interface TenantOnboardingRow {
  onboarding_status: string;
  onboarding_started_at: string;
  onboarding_completed_at: string | null;
  pilot_start_date: string | null;
  pilot_end_date: string | null;
  tier: string;
  ceo_email: string;
  ceo_name: string;
  am_email: string | null;
}

export function getNextMilestone(day: number): string | null {
  if (day < 0) return 'Day 0: Contract signed';
  if (day < 1) return 'Day 1-3: Welcome + Discovery';
  if (day < 4) return 'Day 1-3: Discovery call';
  if (day < 8) return 'Day 4-7: Setup + Integration';
  if (day < 15) return 'Day 8-14: First value + Training';
  if (day < 28) return 'Week 3-4: First checkpoint';
  if (day < 56) return 'Week 8: Mid-pilot review';
  if (day < 70) return 'Week 10: 90-day report';
  if (day < 84) return 'Week 12: Decision call';
  return 'Pilot complete — renewal decision';
}

export function formatTenantOnboardingStatus(
  tenantId: string,
  tenant: TenantOnboardingRow,
) {
  const pilotStart = tenant.pilot_start_date
    ? new Date(tenant.pilot_start_date)
    : new Date(tenant.onboarding_started_at);
  const now = new Date();
  const dayInPilot = Math.floor(
    (now.getTime() - pilotStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  const status: 'not_started' | 'in_progress' | 'completed' | 'paused' =
    tenant.onboarding_completed_at
      ? 'completed'
      : tenant.onboarding_status === 'paused'
        ? 'paused'
        : tenant.onboarding_started_at
          ? 'in_progress'
          : 'not_started';

  return {
    tenantId,
    status,
    dayInPilot: Math.max(0, dayInPilot),
    tier: tenant.tier,
    ceoName: tenant.ceo_name,
    ceoEmail: tenant.ceo_email,
    amEmail: tenant.am_email,
    pilotStartDate: tenant.pilot_start_date,
    pilotEndDate: tenant.pilot_end_date,
    onboardingStartedAt: tenant.onboarding_started_at,
    onboardingCompletedAt: tenant.onboarding_completed_at,
    nextMilestone: getNextMilestone(dayInPilot),
  };
}

export async function sendWelcomeEmail(
  _tenantId: string,
  ceoEmail: string,
  _ceoName: string,
  amEmail: string,
): Promise<void> {
  logger.info('[onboarding] Welcome email queued', { ceoEmail, amEmail });
}
