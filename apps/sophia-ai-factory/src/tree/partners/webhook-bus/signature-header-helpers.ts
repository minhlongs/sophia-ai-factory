/**
 * Header parsing and extraction helpers for Partner Webhook Signature Verifier.
 * @module tree/partners/webhook-bus/signature-header-helpers
 */

import type { WebhookSignatureHeader } from './types';

/**
 * Parses the X-Sophia-Signature-256 header value into timestamp and signature.
 */
export function parseSignatureHeader(headerValue: string): WebhookSignatureHeader | null {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const parts = headerValue.split(',');
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('t=')) {
      const parsed = parseInt(trimmed.slice(2), 10);
      if (!Number.isNaN(parsed)) {
        timestamp = parsed;
      }
    } else if (trimmed.startsWith('v1=')) {
      signature = trimmed.slice(3).trim();
    }
  }

  if (timestamp === null || !signature) {
    return null;
  }

  return { timestamp, signature };
}

export function extractHeader(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    if ('headerValue' in val && typeof (val as { headerValue: string }).headerValue === 'string') {
      return (val as { headerValue: string }).headerValue;
    }
    if ('signature' in val && typeof (val as { signature: string }).signature === 'string') {
      const sigObj = val as { signature: string; timestamp?: number };
      const ts = sigObj.timestamp ?? Math.floor(Date.now() / 1000);
      return `t=${ts},v1=${sigObj.signature}`;
    }
  }
  return '';
}

export function isHeaderLike(val: unknown): boolean {
  if (typeof val === 'string') {
    return val.includes('t=') || val.includes('v1=');
  }
  if (typeof val === 'object' && val !== null) {
    return 'headerValue' in val || 'signature' in val;
  }
  return false;
}
