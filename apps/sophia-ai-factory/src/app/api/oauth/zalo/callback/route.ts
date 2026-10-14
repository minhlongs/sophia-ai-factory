/**
 * GET /api/oauth/zalo/callback
 * Handles Zalo OA OAuth callback.
 * Exchanges code → access_token + refresh_token via Zalo OA API v3.
 * Stores encrypted tokens in publishing_channels (D1).
 */

export { GET } from './core';
