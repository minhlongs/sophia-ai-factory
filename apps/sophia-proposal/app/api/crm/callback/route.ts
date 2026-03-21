/**
 * GET /api/crm/callback
 *
 * Handle HubSpot OAuth2 callback
 * Exchange authorization code for access token and store in crm_settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/supabase/client';
import { getOrgId } from '@/lib/org';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;

interface HubSpotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state'); // org_id passed via OAuth state param

    if (error) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?crm_error=oauth_denied', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?crm_error=no_code', request.url)
      );
    }

    if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?crm_error=not_configured', request.url)
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        code,
        redirect_uri: HUBSPOT_REDIRECT_URI || '',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData: HubSpotTokenResponse = await tokenResponse.json();

    // Resolve org_id: prefer state param, fallback to user session
    let orgId: string | null = state || null;

    if (!orgId) {
      const authHeader = request.headers.get('authorization');
      const accessTokenHeader = authHeader?.split(' ')[1];
      const authClient = createAuthClient(accessTokenHeader);
      const { data: { user } } = await authClient.auth.getUser();

      if (user) {
        const serverClient = createServerClient();
        orgId = await getOrgId(user.id, serverClient);
      }
    }

    if (!orgId) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?crm_error=no_org', request.url)
      );
    }

    // Fetch HubSpot portal info to get portal_id
    const portalResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokenData.access_token);
    const portalData = portalResponse.ok ? await portalResponse.json() : null;

    // Store tokens in crm_settings using service role (bypasses RLS)
    const serverClient = createServerClient();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { error: upsertError } = await serverClient
      .from('crm_settings')
      .upsert({
        org_id: orgId,
        hubspot_access_token: tokenData.access_token,
        hubspot_refresh_token: tokenData.refresh_token,
        hubspot_token_expires_at: expiresAt,
        hubspot_portal_id: portalData?.hub_id?.toString() || null,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('Failed to store HubSpot tokens:', upsertError);
      return NextResponse.redirect(
        new URL('/dashboard/settings?crm_error=storage_failed', request.url)
      );
    }

    return NextResponse.redirect(
      new URL('/dashboard/settings?crm_success=connected', request.url)
    );
  } catch (error) {
    console.error('HubSpot OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/settings?crm_error=exchange_failed', request.url)
    );
  }
}
