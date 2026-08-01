import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BlueskyPublisher, createAtprotoSession } from '../bluesky';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('BlueskyPublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.BLUESKY_PDS_URL;
  });
  afterEach(() => { delete process.env.BLUESKY_PDS_URL; });

  describe('mock mode', () => {
    it('returns mock_bluesky_ id when BLUESKY_PDS_URL absent', async () => {
      const p = new BlueskyPublisher('tok', 'did:plc:123');
      const id = await p.publish('https://v.mp4', { caption: 'hi', hashtags: [] });
      expect(id.externalPostId).toMatch(/^mock_bluesky_/);
    });
    it('pollStatus returns live always', async () => {
      const p = new BlueskyPublisher('tok', 'did:plc:123');
      expect(await p.getStatus('some_rkey')).toBe('live');
    });
  });

  describe('real mode', () => {
    beforeEach(() => { process.env.BLUESKY_PDS_URL = 'https://bsky.social'; });

    it('calls createRecord and returns rkey from uri', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ uri: 'at://did:plc:abc/app.bsky.feed.post/rkey123', cid: 'bafyxyz' }),
          { status: 200 },
        ),
      );
      const p = new BlueskyPublisher('access_jwt', 'did:plc:abc');
      const id = await p.publish('https://v.mp4', { caption: 'test', hashtags: ['#ai'] });
      expect(id.externalPostId).toBe('rkey123');
      fetchSpy.mockRestore();
    });

    it('throws when createRecord fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response('bad', { status: 400 }));
      const p = new BlueskyPublisher('tok', 'did:plc:x');
      const _result = await p.publish('https://v.mp4', { caption: 'x', hashtags: [] });
      expect(_result.success).toBe(false);
      expect(_result.error).toMatch(/createRecord failed/);
      fetchSpy.mockRestore();
    });
  });
});

describe('createAtprotoSession', () => {
  it('returns session data on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessJwt: 'jwt_access', refreshJwt: 'jwt_refresh', did: 'did:plc:xyz', handle: 'alice.bsky.social' }),
        { status: 200 },
      ),
    );
    const session = await createAtprotoSession('alice.bsky.social', 'apppassword', 'https://bsky.social');
    expect(session.did).toBe('did:plc:xyz');
    expect(session.accessJwt).toBe('jwt_access');
    fetchSpy.mockRestore();
  });

  it('throws on failed session creation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'AuthenticationRequired' }), { status: 401 }));
    await expect(createAtprotoSession('alice', 'bad_pw')).rejects.toThrow(/createSession failed/);
    fetchSpy.mockRestore();
  });
});
