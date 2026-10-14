/**
 * AWS Signature Version 4 signing helpers for Amazon PA-API v5.
 * @module land/affiliates/providers/amazon/sigv4
 */

import { PA_API_HOST, PA_API_REGION, SERVICE } from './constants';

/** AWS SigV4 signing helper for PA-API */
export async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const keyBuf: BufferSource = key instanceof ArrayBuffer
    ? key
    : new Uint8Array(key.buffer instanceof ArrayBuffer ? key.buffer : (key.buffer as unknown as ArrayBuffer), key.byteOffset, key.byteLength);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', keyMaterial, new TextEncoder().encode(data));
}

export async function getSigningKey(
  secretKey: string,
  date: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`), date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

export function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signPaApiRequest(
  accessKey: string,
  secretKey: string,
  body: string,
): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const bodyHash = bufToHex(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)),
  );
  const canonicalHeaders =
    `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${PA_API_HOST}\nx-amz-date:${amzDate}\nx-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = [
    'POST', '/paapi5/searchitems', '',
    canonicalHeaders, signedHeaders, bodyHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${PA_API_REGION}/${SERVICE}/aws4_request`;
  const canonicalHash = bufToHex(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest)),
  );
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalHash}`;
  const signingKey = await getSigningKey(secretKey, dateStamp, PA_API_REGION, SERVICE);
  const signature = bufToHex(await hmacSha256(signingKey, stringToSign));

  return {
    'Content-Encoding': 'amz-1.0',
    'Content-Type': 'application/json; charset=utf-8',
    'x-amz-date': amzDate,
    'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
