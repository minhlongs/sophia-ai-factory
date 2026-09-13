/**
 * GET /api/provenance?assetId=X
 * List provenance chain for a specific asset.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getProvenanceChain, getDerivatives } from '@/tree/provenance';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('assetId');
  if (!assetId) {
    return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
  }

  // Verify user has access to the workspace this asset belongs to
  // assetId format: "ws_<workspaceId>_..." or we look up via chain
  const chain = await getProvenanceChain(assetId);
  if (chain.length > 0) {
    const workspaceId = chain[0].workspaceId;
    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const includeDerivatives = searchParams.get('includeDerivatives') === 'true';
  let derivatives: typeof chain = [];
  if (includeDerivatives) {
    derivatives = await getDerivatives(assetId);
  }

  return NextResponse.json({ chain, derivatives });
}