/**
 * @module tree/mekong/__tests__/tunnel-client.test
 *
 * Comprehensive unit test suite for Cloudflare Tunnel communication client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidTunnelUrl,
  isCashclawTunnelUrl,
  normalizeTunnelUrl,
  probeEdgeTunnel,
  executeTunnelInference,
  MekongTunnelClient,
} from '../tunnel-client';
import { encryptPayload, hashAuthToken } from '../crypto';
import type { InferenceTask } from '../types';

describe('tree/mekong/tunnel-client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('URL validation & normalization', () => {
    it('accepts valid HTTPS tunnel URLs', () => {
      expect(isValidTunnelUrl('https://edge-m1.cashclaw.cc')).toBe(true);
      expect(isValidTunnelUrl('https://custom.cfargotunnel.com')).toBe(true);
      expect(isValidTunnelUrl('https://gpu-node.internal.net:8443')).toBe(true);
    });

    it('rejects non-HTTPS URLs by default', () => {
      expect(isValidTunnelUrl('http://edge-m1.cashclaw.cc')).toBe(false);
      expect(isValidTunnelUrl('http://localhost:8765')).toBe(false);
      expect(isValidTunnelUrl('http://127.0.0.1:8765')).toBe(false);
    });

    it('allows localhost and 127.0.0.1 when allowLocal is true', () => {
      expect(isValidTunnelUrl('http://localhost:8765', true)).toBe(true);
      expect(isValidTunnelUrl('http://127.0.0.1:8765', true)).toBe(true);
      expect(isValidTunnelUrl('http://remote.host.com', true)).toBe(false);
    });

    it('rejects invalid or dangerous protocols', () => {
      expect(isValidTunnelUrl('javascript:alert(1)')).toBe(false);
      expect(isValidTunnelUrl('ftp://example.com')).toBe(false);
      expect(isValidTunnelUrl('file:///etc/passwd')).toBe(false);
      expect(isValidTunnelUrl('')).toBe(false);
    });

    it('identifies cashclaw.cc tunnel domains', () => {
      expect(isCashclawTunnelUrl('https://node-1.cashclaw.cc')).toBe(true);
      expect(isCashclawTunnelUrl('https://edge.cashclaw.cc/')).toBe(true);
      expect(isCashclawTunnelUrl('https://cashclaw.cc.evil.com')).toBe(false);
      expect(isCashclawTunnelUrl('https://google.com')).toBe(false);
    });

    it('normalizes tunnel URLs by stripping trailing slashes and whitespace', () => {
      expect(normalizeTunnelUrl('  https://node-1.cashclaw.cc///  ')).toBe(
        'https://node-1.cashclaw.cc',
      );
      expect(normalizeTunnelUrl('')).toBe('');
    });
  });

  describe('probeEdgeTunnel', () => {
    it('fails closed immediately when timeoutMs < 500', async () => {
      const probe = await probeEdgeTunnel('https://edge.cashclaw.cc', 'tok_123', 400);
      expect(probe.status).toBe('OFFLINE');
      expect(probe.reachable).toBe(false);
      expect(probe.error).toBe('INVALID_PROBE_CONFIGURATION');
    });

    it('fails closed immediately on empty URL or empty token', async () => {
      const probeNoUrl = await probeEdgeTunnel('', 'tok_123');
      expect(probeNoUrl.status).toBe('OFFLINE');
      expect(probeNoUrl.reachable).toBe(false);

      const probeNoToken = await probeEdgeTunnel('https://edge.cashclaw.cc', '');
      expect(probeNoToken.status).toBe('OFFLINE');
      expect(probeNoToken.reachable).toBe(false);
    });

    it('simulates unreachable node when URL contains offline or unreachable', async () => {
      const probe = await probeEdgeTunnel('https://edge-offline.cashclaw.cc', 'tok_123', 1500);
      expect(probe.status).toBe('OFFLINE');
      expect(probe.reachable).toBe(false);
      expect(probe.latencyMs).toBe(1500);
    });

    it('probes a healthy node returning HTTP 200', async () => {
      const token = 'valid_token_xyz';
      const expectedTokenHash = await hashAuthToken(token);

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        expect(url).toBe('https://edge.cashclaw.cc/healthz');
        const headers = init.headers as Record<string, string>;
        expect(headers['Authorization']).toBe(`Bearer ${token}`);
        expect(headers['X-Mekong-Auth-Token-Hash']).toBe(expectedTokenHash);

        return new Response(
          JSON.stringify({ status: 'ok', runtime: 'mlx', version: '0.2.1' }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Mekong-Node-Auth-Hash': expectedTokenHash,
            },
          },
        );
      });

      const probe = await probeEdgeTunnel('https://edge.cashclaw.cc', token, 2500);
      expect(probe.status).toBe('ONLINE');
      expect(probe.reachable).toBe(true);
      expect(probe.runtime).toBe('mlx');
      expect(probe.version).toBe('0.2.1');
    });

    it('fails closed when node returns an invalid mutual auth response hash', async () => {
      const token = 'valid_token_xyz';

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({ status: 'ok' }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Mekong-Node-Auth-Hash': 'forged_or_invalid_hash_value',
            },
          },
        );
      });

      const probe = await probeEdgeTunnel('https://edge.cashclaw.cc', token, 2500);
      expect(probe.status).toBe('OFFLINE');
      expect(probe.reachable).toBe(false);
      expect(probe.error).toContain('Mutual authentication failed');
    });

    it('returns DEGRADED on HTTP 429 or 503', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response('Rate limited', { status: 429 });
      });

      const probe = await probeEdgeTunnel('https://edge.cashclaw.cc', 'tok', 2500);
      expect(probe.status).toBe('DEGRADED');
      expect(probe.reachable).toBe(true);
    });

    it('returns OFFLINE on HTTP 500 error or network failure', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response('Internal Server Error', { status: 500, statusText: 'Bad' });
      });

      const probe = await probeEdgeTunnel('https://edge.cashclaw.cc', 'tok', 2500);
      expect(probe.status).toBe('OFFLINE');
      expect(probe.reachable).toBe(false);
    });

    it('handles timeout abort gracefully', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      });

      const probe = await probeEdgeTunnel('https://edge.cashclaw.cc', 'tok', 2500);
      expect(probe.status).toBe('OFFLINE');
      expect(probe.reachable).toBe(false);
    });
  });

  describe('executeTunnelInference', () => {
    const token = 'super-secret-m1-max-token';
    const task: InferenceTask = {
      taskId: 'task_tunnel_1',
      type: 'llm',
      prompt: 'Summarize financial reports for Q4',
      model: 'qwen3:32b',
      maxTokens: 500,
    };

    it('encrypts payload with AES-256-GCM, sends to tunnel, and decrypts response', async () => {
      const expectedTokenHash = await hashAuthToken(token);

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        expect(url).toBe('https://edge.cashclaw.cc/v1/messages');
        const headers = init.headers as Record<string, string>;
        expect(headers['Authorization']).toBe(`Bearer ${token}`);
        expect(headers['X-Mekong-Auth-Token-Hash']).toBe(expectedTokenHash);

        const body = JSON.parse(init.body as string) as {
          encrypted: boolean;
          payload: { algorithm: string; iv: string; ciphertext: string };
        };
        expect(body.encrypted).toBe(true);
        expect(body.payload.algorithm).toBe('AES-256-GCM');

        // Create an encrypted response envelope
        const responseData = { output: 'Q4 Financial Summary: Net revenue surged 45%.' };
        const responseEnvelope = await encryptPayload(responseData, token);

        return new Response(
          JSON.stringify({
            encrypted: true,
            payload: responseEnvelope,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const result = await executeTunnelInference('https://edge.cashclaw.cc', token, task);
      expect(result.taskId).toBe(task.taskId);
      expect(result.provider).toBe('mekong_m1_max');
      expect(result.costKind).toBe('unmetered');
      expect(result.output).toBe('Q4 Financial Summary: Net revenue surged 45%.');
      expect(result.encrypted).toBe(true);
      expect(result.fallbackTriggered).toBe(false);
    });

    it('throws error when tunnel responds with non-200 status', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response('Gateway Timeout', { status: 504, statusText: 'Gateway Timeout' });
      });

      await expect(
        executeTunnelInference('https://edge.cashclaw.cc', token, task),
      ).rejects.toThrow('Edge tunnel request failed with status 504');
    });
  });

  describe('MekongTunnelClient Class', () => {
    it('initializes and wraps probe and inference', async () => {
      const client = new MekongTunnelClient('https://node-sub.cashclaw.cc/', 'token_123');
      expect(client.getTunnelUrl()).toBe('https://node-sub.cashclaw.cc');
      expect(client.isCashclaw()).toBe(true);

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
      );

      const probe = await client.probe();
      expect(probe.reachable).toBe(true);
    });
  });
});
