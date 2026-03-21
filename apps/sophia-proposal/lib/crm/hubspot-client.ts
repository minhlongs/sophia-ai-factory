/**
 * HubSpot CRM Client
 *
 * Wrapper for HubSpot CRM API v3
 * Docs: https://developers.hubspot.com/docs/api/crm/contacts
 */

import type {
  HubSpotContact,
  HubSpotDeal,
  HubSpotCompany,
  HubSpotApiRequest,
  HubSpotApiResponse,
  HubSpotToken,
} from '@/types/hubspot';

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

/**
 * Get OAuth2 access token from refresh token
 */
export async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<HubSpotToken> {
  const response = await fetch(`${HUBSPOT_BASE_URL}/oauth/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`HubSpot OAuth error: ${response.status}`);
  }

  return response.json();
}

/**
 * Create or update contact
 */
export async function upsertContact(
  contact: Partial<HubSpotContact['properties']>,
  accessToken: string
): Promise<HubSpotContact> {
  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: contact,
      }),
    }
  );

  if (!response.ok) {
    // Try update if contact exists
    if (response.status === 409) {
      return updateContact(contact.email!, contact, accessToken);
    }
    throw new Error(`HubSpot API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Update existing contact
 */
export async function updateContact(
  email: string,
  properties: Partial<HubSpotContact['properties']>,
  accessToken: string
): Promise<HubSpotContact> {
  // First get contact ID by email
  const getResponse = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${email}?idProperty=email`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!getResponse.ok) {
    throw new Error(`Failed to find contact: ${getResponse.status}`);
  }

  const existingContact = await getResponse.json();

  // Then update
  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${existingContact.id}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    }
  );

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get contact by email
 */
export async function getContactByEmail(
  email: string,
  accessToken: string
): Promise<HubSpotContact | null> {
  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${email}?idProperty=email`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status}`);
  }

  return response.json();
}

/**
 * List contacts with pagination
 */
export async function listContacts(
  accessToken: string,
  after?: string,
  limit = 100
): Promise<HubSpotApiResponse<HubSpotContact>> {
  const url = new URL(`${HUBSPOT_BASE_URL}/crm/v3/objects/contacts`);
  url.searchParams.append('limit', limit.toString());
  url.searchParams.append('properties', 'email,firstname,lastname,phone,company');
  if (after) {
    url.searchParams.append('after', after);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Create or update deal
 */
export async function upsertDeal(
  deal: Partial<HubSpotDeal['properties']>,
  accessToken: string
): Promise<HubSpotDeal> {
  const response = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/deals`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: deal,
    }),
  });

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Associate contact with company
 */
export async function associateContactWithCompany(
  contactId: string,
  companyId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${contactId}/associations/companies/${companyId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status}`);
  }
}

/**
 * Search company by domain
 */
export async function searchCompanyByDomain(
  domain: string,
  accessToken: string
): Promise<HubSpotCompany | null> {
  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/companies/search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'domain',
                operator: 'EQ',
                value: domain,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`HubSpot API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results?.[0] || null;
}
