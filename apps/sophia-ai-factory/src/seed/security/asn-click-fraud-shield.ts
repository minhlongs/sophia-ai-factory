/**
 * Edge ASN Datacenter/VPN Click-Fraud Shield.
 *
 * Clean-room edge primitive (inspired by MIT brianhama/bad-asn-list):
 * scores incoming Cloudflare Workers requests by ASN (request.cf.asn) in 0ms
 * with zero external API calls to filter datacenter/cloud/VPN bot farms from
 * affiliate click attribution and EPC calculations.
 *
 * Layer: seed/security (pure function, zero external deps)
 *
 * @module seed/security/asn-click-fraud-shield
 */

/** High-volume cloud/datacenter/VPN ASNs commonly associated with automated click traffic. */
const DATACENTER_AND_HOSTING_ASNS = new Set<number>([
  16509, // Amazon AWS
  14618, // Amazon AWS
  15169, // Google Cloud
  396982, // Google Cloud
  8075, // Microsoft Azure
  14061, // DigitalOcean
  20473, // Vultr / Choopa
  24940, // Hetzner
  16276, // OVH
  63949, // Akamai / Linode
  31898, // Oracle Cloud
  45102, // Alibaba Cloud
  132203, // Tencent Cloud
  9009, // M247 (VPN/Proxy)
  212238, // Datacamp (VPN)
  60068, // Datacamp
  136787, // PacketHub / VPN
]);

export interface ClickFraudScore {
  readonly suspicious: boolean;
  readonly asn: number | null;
  readonly reason: string | null;
}

export function evaluateAsnClickFraud(rawAsn: number | string | null | undefined): ClickFraudScore {
  if (rawAsn === null || rawAsn === undefined || rawAsn === '') {
    return { suspicious: false, asn: null, reason: null };
  }
  const parsed = typeof rawAsn === 'number' ? rawAsn : Number.parseInt(String(rawAsn).trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { suspicious: false, asn: null, reason: null };
  }
  if (DATACENTER_AND_HOSTING_ASNS.has(parsed)) {
    return { suspicious: true, asn: parsed, reason: `DATACENTER_VPN_ASN_${parsed}` };
  }
  return { suspicious: false, asn: parsed, reason: null };
}
