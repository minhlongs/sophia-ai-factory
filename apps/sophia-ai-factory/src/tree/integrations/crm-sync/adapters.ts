/**
 * @file adapters.ts
 * @description Salesforce Opportunity and HubSpot Deal bi-directional payload adapters.
 * @layer tree
 */

import type {
  HubSpotDealPayload,
  SalesforceOpportunityPayload,
  SophiaDealSnapshot,
} from '../types';
import {
  centsToDecimalAmount,
  decimalAmountToCents,
  HUBSPOT_TO_SOPHIA_STAGE_MAP,
  SALESFORCE_TO_SOPHIA_STAGE_MAP,
  SOPHIA_TO_HUBSPOT_STAGE_MAP,
  SOPHIA_TO_SALESFORCE_STAGE_MAP,
} from './stage-maps';

/**
 * Transforms a Sophia deal into a Salesforce Opportunity payload.
 */
export function transformSophiaToSalesforce(deal: SophiaDealSnapshot): SalesforceOpportunityPayload {
  const sfStage = SOPHIA_TO_SALESFORCE_STAGE_MAP[deal.dealStage] || 'Prospecting';
  const truncatedName = (deal.companyName ? `${deal.companyName} - Enterprise AI` : 'Enterprise Deal').slice(0, 120);

  return {
    Sophia_Deal_Id__c: deal.id,
    Name: truncatedName,
    StageName: sfStage,
    Amount: centsToDecimalAmount(deal.dealValueEstimateCents),
    CurrencyIsoCode: deal.currency || 'USD',
    CloseDate: deal.closeDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    Description: deal.notes || undefined,
    Contact_Email__c: deal.leadEmail || undefined,
    Contact_Phone__c: deal.leadPhone || undefined,
    Account_Domain__c: deal.companyDomain,
  };
}

/**
 * Transforms a Salesforce Opportunity payload into a partial Sophia deal.
 */
export function transformSalesforceToSophia(sfOpp: SalesforceOpportunityPayload): Partial<SophiaDealSnapshot> {
  const sophiaStage = SALESFORCE_TO_SOPHIA_STAGE_MAP[sfOpp.StageName] || 'new_lead';
  const dealValueCents = decimalAmountToCents(sfOpp.Amount);

  const partial: Partial<SophiaDealSnapshot> = {
    dealStage: sophiaStage,
    dealValueEstimateCents: dealValueCents,
    currency: sfOpp.CurrencyIsoCode || 'USD',
  };

  if (sfOpp.Sophia_Deal_Id__c) partial.id = sfOpp.Sophia_Deal_Id__c;
  if (sfOpp.Account_Domain__c) partial.companyDomain = sfOpp.Account_Domain__c;
  if (sfOpp.Contact_Email__c) partial.leadEmail = sfOpp.Contact_Email__c;
  if (sfOpp.Contact_Phone__c) partial.leadPhone = sfOpp.Contact_Phone__c;
  if (sfOpp.Description) partial.notes = sfOpp.Description;
  if (sfOpp.CloseDate) partial.closeDate = sfOpp.CloseDate;

  return partial;
}

/**
 * Transforms a Sophia deal into a HubSpot Deal payload.
 */
export function transformSophiaToHubSpot(deal: SophiaDealSnapshot): HubSpotDealPayload {
  const hsStage = SOPHIA_TO_HUBSPOT_STAGE_MAP[deal.dealStage] || 'appointmentscheduled';
  const truncatedName = (deal.companyName ? `${deal.companyName} - Enterprise AI` : 'Enterprise Deal').slice(0, 120);

  return {
    sophia_deal_id: deal.id,
    dealname: truncatedName,
    dealstage: hsStage,
    amount: centsToDecimalAmount(deal.dealValueEstimateCents),
    deal_currency_code: deal.currency || 'USD',
    closedate: deal.closeDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    description: deal.notes || undefined,
    contact_email: deal.leadEmail || undefined,
    contact_phone: deal.leadPhone || undefined,
    company_domain: deal.companyDomain,
  };
}

/**
 * Transforms a HubSpot Deal payload into a partial Sophia deal.
 */
export function transformHubSpotToSophia(hsDeal: HubSpotDealPayload): Partial<SophiaDealSnapshot> {
  const sophiaStage = HUBSPOT_TO_SOPHIA_STAGE_MAP[hsDeal.dealstage] || 'new_lead';
  const dealValueCents = decimalAmountToCents(hsDeal.amount);

  let closeDateStr: string | undefined = undefined;
  if (typeof hsDeal.closedate === 'string') {
    closeDateStr = hsDeal.closedate.split('T')[0];
  } else if (typeof hsDeal.closedate === 'number') {
    closeDateStr = new Date(hsDeal.closedate).toISOString().split('T')[0];
  }

  const partial: Partial<SophiaDealSnapshot> = {
    dealStage: sophiaStage,
    dealValueEstimateCents: dealValueCents,
    currency: hsDeal.deal_currency_code || 'USD',
  };

  if (hsDeal.sophia_deal_id) partial.id = hsDeal.sophia_deal_id;
  if (hsDeal.company_domain) partial.companyDomain = hsDeal.company_domain;
  if (hsDeal.contact_email) partial.leadEmail = hsDeal.contact_email;
  if (hsDeal.contact_phone) partial.leadPhone = hsDeal.contact_phone;
  if (hsDeal.description) partial.notes = hsDeal.description;
  if (closeDateStr) partial.closeDate = closeDateStr;

  return partial;
}
