import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './is-safe-url';

describe('is-safe-url', () => {
  describe('allows valid HTTPS URLs', () => {
    it('accepts standard HTTPS URLs', () => {
      expect(isSafeUrl('https://example.com')).toBe(true);
      expect(isSafeUrl('https://api.example.com/v1/users')).toBe(true);
      expect(isSafeUrl('https://sub.domain.example.com/path?query=1')).toBe(true);
    });

    it('accepts URLs with standard ports', () => {
      expect(isSafeUrl('https://example.com:443')).toBe(true);
    });

    it('accepts URLs with auth credentials', () => {
      expect(isSafeUrl('https://user:pass@example.com')).toBe(true);
    });
  });

  describe('blocks non-HTTPS URLs', () => {
    it('rejects HTTP URLs', () => {
      expect(isSafeUrl('http://example.com')).toBe(false);
      expect(isSafeUrl('http://insecure.example.com')).toBe(false);
    });

    it('rejects protocol-relative URLs', () => {
      expect(isSafeUrl('//example.com')).toBe(false);
    });

    it('rejects file and data URLs', () => {
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('blocks private/internal IPs and hostnames', () => {
    it('rejects localhost', () => {
      expect(isSafeUrl('https://localhost')).toBe(false);
      expect(isSafeUrl('https://localhost:3000')).toBe(false);
    });

    it('rejects 127.0.0.1', () => {
      expect(isSafeUrl('https://127.0.0.1')).toBe(false);
      expect(isSafeUrl('https://127.0.0.1:8080')).toBe(false);
    });

    it('rejects 0.0.0.0', () => {
      expect(isSafeUrl('https://0.0.0.0')).toBe(false);
    });

    it('rejects 169.254.169.254 (cloud metadata)', () => {
      expect(isSafeUrl('https://169.254.169.254')).toBe(false);
      expect(isSafeUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    });

    it('rejects metadata.google.internal', () => {
      expect(isSafeUrl('https://metadata.google.internal')).toBe(false);
    });

    it('rejects 10.0.0.0/8', () => {
      expect(isSafeUrl('https://10.0.0.1')).toBe(false);
      expect(isSafeUrl('https://10.255.255.255')).toBe(false);
    });

    it('rejects 172.16.0.0/12', () => {
      expect(isSafeUrl('https://172.16.0.1')).toBe(false);
      expect(isSafeUrl('https://172.31.255.255')).toBe(false);
    });

    it('rejects 192.168.0.0/16', () => {
      expect(isSafeUrl('https://192.168.0.1')).toBe(false);
      expect(isSafeUrl('https://192.168.255.255')).toBe(false);
    });

    it('rejects IPv6 localhost', () => {
      expect(isSafeUrl('https://[::1]')).toBe(false);
    });
  });

  describe('blocks internal TLDs', () => {
    it('rejects .local domains', () => {
      expect(isSafeUrl('https://service.local')).toBe(false);
      expect(isSafeUrl('https://host.internal.local')).toBe(false);
    });

    it('rejects .internal domains', () => {
      expect(isSafeUrl('https://service.internal')).toBe(false);
      expect(isSafeUrl('https://host.example.internal')).toBe(false);
    });
  });

  describe('blocks hostnames containing internal patterns', () => {
    it('rejects hostnames starting with "internal"', () => {
      expect(isSafeUrl('https://internal-api.example.com')).toBe(false);
      expect(isSafeUrl('https://internal')).toBe(false);
    });

    it('rejects hostnames ending with .internal', () => {
      expect(isSafeUrl('https://myinternalhost')).toBe(true); // contains but not start/end - allowed
      expect(isSafeUrl('https://service.internal')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('rejects malformed URLs', () => {
      expect(isSafeUrl('not-a-url')).toBe(false);
      expect(isSafeUrl('')).toBe(false);
    });

    it('handles uppercase hostnames', () => {
      expect(isSafeUrl('https://LOCALHOST')).toBe(false);
      expect(isSafeUrl('https://EXAMPLE.COM')).toBe(true);
    });

    it('accepts URLs with complex paths and queries', () => {
      expect(isSafeUrl('https://api.example.com/v1/users?id=123&filter=active')).toBe(true);
      expect(isSafeUrl('https://example.com/path/to/resource?deep[nested][field]=value')).toBe(true);
    });

    it('accepts URLs with fragments', () => {
      expect(isSafeUrl('https://example.com/page#section')).toBe(true);
    });
  });
});
