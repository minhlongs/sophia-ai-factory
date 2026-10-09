/**
 * GET /api/sdk/typescript
 *
 * Returns a standalone single-file TypeScript SDK as `text/typescript`.
 * Provides full type-safe wrappers for:
 * - Missions lifecycle (create, get, streamEvents, list)
 * - MCU Credits (balance, consume)
 * - 7 Core algorithm endpoints
 *
 * Usage:
 *   curl https://sophia.agencyos.network/api/sdk/typescript > sophia.ts
 *   import { SophiaClient } from "./sophia";
 *   const sophia = new SophiaClient(token);
 *   const balance = await sophia.credits.balance();
 *   const { translated } = await sophia.translate({ text, fromLang, toLang });
 *
 * No auth required. Edge-cached 1 hour.
 *
 * @module app/api/sdk/typescript
 */

import { NextResponse } from 'next/server';
import { SDK_SOURCE } from './sdk-template';

export async function GET(): Promise<Response> {
  return new NextResponse(SDK_SOURCE, {
    status: 200,
    headers: {
      'Content-Type': 'text/typescript; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
      'Content-Disposition': 'inline; filename="sophia.ts"',
    },
  });
}
