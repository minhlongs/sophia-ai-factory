import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { listInstallationsForUser } from '@/seed/sop/sop-repo';
import { getCustomerHandover } from '@/tree/handover/customer-handover-service';
import { verifyUserReadiness } from '@/tree/readiness/readiness-checker';

export interface RunbookLiveTelemetry {
  readonly handoverStatus: string;
  readonly certificateHash: string | null;
  readonly installedSopCount: number;
  readonly readinessScore: number;
  readonly readyForMissions: boolean;
}

export async function loadRunbookLiveTelemetry(): Promise<RunbookLiveTelemetry> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      handoverStatus: 'active',
      certificateHash: null,
      installedSopCount: 0,
      readinessScore: 100,
      readyForMissions: true,
    };
  }

  let handoverStatus = 'active';
  let certificateHash: string | null = null;
  let installedSopCount = 0;
  let readinessScore = 100;
  let readyForMissions = true;

  try {
    const db = await getD1();
    if (db) {
      const [handover, installations] = await Promise.all([
        getCustomerHandover(db, user.id),
        listInstallationsForUser(db, user.id),
      ]);
      if (handover) {
        handoverStatus = handover.acceptance_status || handover.status || 'active';
        certificateHash = handover.certificate_hash ?? null;
      }
      installedSopCount = installations.length;
    }

    const readiness = await verifyUserReadiness({
      userId: user.id,
      userEmail: user.email,
      emailVerified: (user as { emailVerified?: boolean }).emailVerified,
    });
    readyForMissions = readiness.readyForMissions;
    const totalChecks = 4;
    const passedChecks = Math.max(0, totalChecks - readiness.issues.length);
    readinessScore = Math.round((passedChecks / totalChecks) * 100);
  } catch {
    // Graceful fallback if local D1 binding is unavailable
  }

  return {
    handoverStatus,
    certificateHash,
    installedSopCount,
    readinessScore,
    readyForMissions,
  };
}
