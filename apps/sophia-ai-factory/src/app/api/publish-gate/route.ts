/**
 * /api/publish-gate — Compliance Publish Gate HTTP Route (MOCK_ONLY).
 *
 * Fail-closed behind `FEATURE_B2_COMPLIANCE_PUBLISH_GATE === 'true'`.
 * Zero external social platform network calls.
 *
 * @module app/api/publish-gate/route
 */

import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  resolveOrgId,
  verifyWorkspaceAccess,
  verifyWorkspaceRole,
} from '@/seed/auth/workspace-access';
import { isB2CompliancePublishGateEnabled } from '@/seed/config/flags';
import { getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { verifyCsrfToken } from '@/seed/security/csrf';
import {
  handlePublishGateGet,
  handlePublishGatePost,
  type PublishGateHttpDeps,
} from '@/land/publish-gate/publish-gate-http-handler';

export const dynamic = 'force-dynamic';

function buildLiveDeps(): PublishGateHttpDeps {
  return {
    isFeatureEnabled: isB2CompliancePublishGateEnabled,
    getD1,
    getCurrentUser: async () => {
      const user = await getCurrentUser();
      if (!user) {
        return null;
      }
      return { id: user.id, orgId: '' };
    },
    resolveUserOrgId: async (userId, d1) => resolveOrgId(userId, d1),
    verifyWorkspaceAccess: (userId, orgId, d1) =>
      verifyWorkspaceAccess(orgId, userId, d1),
    verifyWorkspaceWriteRole: (userId, orgId, d1) =>
      verifyWorkspaceRole(orgId, userId, 'MEMBER', d1),
    verifyWorkspaceAdminRole: (userId, orgId, d1) =>
      verifyWorkspaceRole(orgId, userId, 'ADMIN', d1),
    verifyCsrf: async (req) => verifyCsrfToken(req as NextRequest),
    emitGateRequested: async (data) => {
      if (!process.env.INNGEST_EVENT_KEY) {
        return;
      }
      await inngest.send({ name: 'campaign/publish.gate_requested', data });
    },
    emitHumanApproved: async (data) => {
      if (!process.env.INNGEST_EVENT_KEY) {
        return;
      }
      await inngest.send({ name: 'campaign/publish.human_approved', data });
    },
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  return handlePublishGateGet(request, buildLiveDeps());
}

export async function POST(request: NextRequest): Promise<Response> {
  return handlePublishGatePost(request, buildLiveDeps());
}
