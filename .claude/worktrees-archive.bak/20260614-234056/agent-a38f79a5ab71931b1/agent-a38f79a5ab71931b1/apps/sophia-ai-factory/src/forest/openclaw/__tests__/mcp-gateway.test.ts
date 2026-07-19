/**
 * mcp-gateway.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mcp,
  MCPDeniedError,
  MCPCallError,
  _registerMockMCP,
  _clearMCPRegistry,
} from '../mcp-gateway';

describe('mcp-gateway', () => {
  beforeEach(() => {
    _clearMCPRegistry();
    vi.clearAllMocks();
  });

  it('throws MCPDeniedError for unwhitelisted server (polar)', async () => {
    await expect(mcp('polar', 'createProduct', {})).rejects.toThrow(MCPDeniedError);
  });

  it('throws MCPDeniedError for unwhitelisted server (arbitrary)', async () => {
    await expect(mcp('stripe', 'charge', {})).rejects.toThrow(MCPDeniedError);
  });

  it('allows whitelisted server (youtube)', async () => {
    const mockClient = { call: vi.fn().mockResolvedValue({ videoId: 'yt-123' }) };
    _registerMockMCP('youtube', mockClient);

    const result = await mcp('youtube', 'upload', { videoUrl: 'https://cdn.example.com/v.mp4' });
    expect(result).toEqual({ videoId: 'yt-123' });
    expect(mockClient.call).toHaveBeenCalledWith('upload', expect.objectContaining({ videoUrl: expect.any(String) }));
  });

  it('allows whitelisted server (tiktok)', async () => {
    const mockClient = { call: vi.fn().mockResolvedValue({ postId: 'tt-456' }) };
    _registerMockMCP('tiktok', mockClient);

    const result = await mcp('tiktok', 'publish', { videoUrl: 'https://cdn.example.com/v.mp4' });
    expect(result).toEqual({ postId: 'tt-456' });
  });

  it('injects tenantId into args when ctx provided', async () => {
    const mockClient = { call: vi.fn().mockResolvedValue({}) };
    _registerMockMCP('supabase', mockClient);

    await mcp('supabase', 'query', { table: 'videos' }, { ctx: { tenantId: 'tenant-inject' } });

    const callArgs = mockClient.call.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs._tenantId).toBe('tenant-inject');
  });

  it('throws MCPCallError when registered server call fails', async () => {
    const mockClient = { call: vi.fn().mockRejectedValue(new Error('upload failed')) };
    _registerMockMCP('youtube', mockClient);

    await expect(mcp('youtube', 'upload', {})).rejects.toThrow(MCPCallError);
  });

  it('throws MCPCallError when server not registered', async () => {
    // tiktok in whitelist but not registered
    await expect(mcp('tiktok', 'method', {})).rejects.toThrow(MCPCallError);
  });

  it('polar is permanently banned even if registered', async () => {
    // Even if someone tries to register polar, the whitelist check fires first
    const mockClient = { call: vi.fn().mockResolvedValue({}) };
    _registerMockMCP('polar', mockClient);

    await expect(mcp('polar', 'createProduct', {})).rejects.toThrow(MCPDeniedError);
    expect(mockClient.call).not.toHaveBeenCalled();
  });
});
