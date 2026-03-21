/**
 * POST /api/crm/connect
 *
 * Initiate HubSpot OAuth2 connection
 * Returns OAuth2 authorization URL
 */

import { NextRequest, NextResponse } from 'next/server';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;

const SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
];

export async function POST(request: NextRequest) {
  try {
    if (!HUBSPOT_CLIENT_ID || !HUBSPOT_REDIRECT_URI) {
      return NextResponse.json(
        { error: 'HubSpot credentials not configured' },
        { status: 500 }
      );
    }

    const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
    authUrl.searchParams.append('client_id', HUBSPOT_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', HUBSPOT_REDIRECT_URI);
    authUrl.searchParams.append('scope', SCOPES.join(' '));
    authUrl.searchParams.append('response_type', 'code');

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
    });
  } catch (error) {
    console.error('Error creating HubSpot connection:', error);
    return NextResponse.json(
      { error: 'Failed to create HubSpot connection' },
      { status: 500 }
    );
  }
}
