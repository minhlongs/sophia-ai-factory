/**
 * Helper to generate partner code and partner ID for affiliate invite acceptance.
 * Layer: forest/actions/affiliate
 * @module forest/actions/affiliate/accept-invite-helpers
 */

export function generatePartnerCode(
  preferredCode: string | undefined,
  partnerName: string,
): { partnerId: string; partnerCode: string } {
  const partnerId = `partner_${crypto.randomUUID().slice(0, 12)}`;
  let baseCode = (preferredCode || partnerName)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 16);

  if (!baseCode || baseCode.length < 3) {
    baseCode = 'PARTNER';
  }

  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const partnerCode = `${baseCode}_${randomSuffix}`;
  return { partnerId, partnerCode };
}
