/**
 * HMAC-SHA256 signing utilities for crypto exchange API clients.
 * Uses Web Crypto API (compatible with Cloudflare Workers and Node 18+).
 * @module seed/utils/crypto-exchange-hmac-signing
 */

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function buildBinanceSignedParams(
  apiSecret: string,
  params: Record<string, string>,
): Promise<URLSearchParams> {
  const qs = new URLSearchParams({ ...params, timestamp: Date.now().toString() });
  const sig = await hmacSha256Hex(apiSecret, qs.toString());
  qs.set('signature', sig);
  return qs;
}

export async function buildBybitSignedHeaders(
  apiKey: string,
  apiSecret: string,
  queryString: string,
  recvWindow = '5000',
): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  const message = `${timestamp}${apiKey}${recvWindow}${queryString}`;
  const signature = await hmacSha256Hex(apiSecret, message);
  return {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
  };
}

export async function buildBitgetSignedHeaders(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  method: string,
  path: string,
  body = '',
): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  const message = `${timestamp}${method.toUpperCase()}${path}${body}`;
  const signature = await hmacSha256Base64(apiSecret, message);
  const signedPassphrase = await hmacSha256Base64(apiSecret, passphrase);
  return {
    'ACCESS-KEY': apiKey,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-PASSPHRASE': signedPassphrase,
    'Content-Type': 'application/json',
  };
}

export async function buildCoinbaseSignedHeaders(
  apiKey: string,
  apiSecret: string,
  method: string,
  path: string,
  body = '',
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}${method.toUpperCase()}${path}${body}`;
  const signature = await hmacSha256Hex(apiSecret, message);
  return {
    'CB-ACCESS-KEY': apiKey,
    'CB-ACCESS-SIGN': signature,
    'CB-ACCESS-TIMESTAMP': timestamp,
    'Content-Type': 'application/json',
  };
}

export async function buildOkxSignedHeaders(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  method: string,
  requestPath: string,
  body = '',
): Promise<Record<string, string>> {
  const timestamp = new Date().toISOString();
  const message = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  const signature = await hmacSha256Base64(apiSecret, message);
  return {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json',
  };
}
