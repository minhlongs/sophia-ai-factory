/**
 * POST /api/crm/sync
 *
 * Sync contacts and deals from HubSpot into local database
 * Reads tokens from crm_settings, updates crm_sync_status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/supabase/client';
import { getOrgId } from '@/lib/org';
import { listContacts } from '@/lib/crm/hubspot-client';
import { listDeals } from '@/lib/crm/hubspot-deals-client';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authClient = createAuthClient(
      request.headers.get('authorization')?.split(' ')[1]
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get organization
    const serverClient = createServerClient();
    const orgId = await getOrgId(user.id, serverClient);

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // 3. Read HubSpot tokens from crm_settings
    const { data: crmSettings, error: settingsError } = await serverClient
      .from('crm_settings')
      .select('hubspot_access_token, hubspot_refresh_token, hubspot_token_expires_at')
      .eq('org_id', orgId)
      .single();

    if (settingsError || !crmSettings?.hubspot_access_token) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    const accessToken = crmSettings.hubspot_access_token;

    // 4. Mark sync as in-progress
    await serverClient.from('crm_sync_status').upsert({
      org_id: orgId,
      status: 'syncing',
      error_message: null,
    });

    let contactsSynced = 0;
    let dealsSynced = 0;

    // 5. Sync contacts
    let contactsAfter: string | undefined;
    let hasMoreContacts = true;

    while (hasMoreContacts) {
      const response = await listContacts(accessToken, contactsAfter, 100);

      for (const contact of response.results) {
        await serverClient.from('contacts').upsert(
          {
            org_id: orgId,
            external_id: contact.id,
            email: contact.properties.email ?? null,
            first_name: contact.properties.firstname ?? null,
            last_name: contact.properties.lastname ?? null,
            phone: contact.properties.phone ?? null,
            company: contact.properties.company ?? null,
            source: 'hubspot',
            external_data: contact,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,external_id,source' }
        );
        contactsSynced++;
      }

      contactsAfter = response.paging?.next?.after;
      hasMoreContacts = !!contactsAfter;
    }

    // 6. Sync deals
    let dealsAfter: string | undefined;
    let hasMoreDeals = true;

    while (hasMoreDeals) {
      const response = await listDeals(accessToken, dealsAfter, 100);

      for (const deal of response.results) {
        const amount = deal.properties.amount
          ? parseFloat(deal.properties.amount)
          : null;
        const closeDate = deal.properties.closedate
          ? deal.properties.closedate.split('T')[0]
          : null;

        await serverClient.from('deals').upsert(
          {
            org_id: orgId,
            external_id: deal.id,
            name: deal.properties.dealname ?? null,
            amount,
            stage: deal.properties.dealstage ?? null,
            pipeline: deal.properties.pipeline ?? null,
            close_date: closeDate,
            source: 'hubspot',
            external_data: deal,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,external_id,source' }
        );
        dealsSynced++;
      }

      dealsAfter = response.paging?.next?.after;
      hasMoreDeals = !!dealsAfter;
    }

    // 7. Update sync status to completed
    await serverClient.from('crm_sync_status').upsert({
      org_id: orgId,
      last_sync: new Date().toISOString(),
      status: 'completed',
      error_message: null,
      contacts_synced: contactsSynced,
      deals_synced: dealsSynced,
      companies_synced: 0,
    });

    return NextResponse.json({
      success: true,
      contactsSynced,
      dealsSynced,
      companiesSynced: 0,
    });
  } catch (error) {
    console.error('CRM sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync CRM data' },
      { status: 500 }
    );
  }
}
