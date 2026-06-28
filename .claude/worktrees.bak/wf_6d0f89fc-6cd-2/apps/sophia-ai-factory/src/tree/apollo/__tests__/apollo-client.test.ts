import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apolloPeopleSearch,
  apolloPeopleBulkSearch,
  ApolloSearchRequest,
  ApolloBulkSearchRequest,
  ApolloPerson,
  ApolloSearchResponse,
} from '../apollo-client';

describe('tree/apollo/apollo-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('apolloPeopleSearch', () => {
    it('searches people with keywords', async () => {
      const mockResponse: ApolloSearchResponse = {
        people: [
          {
            id: 'p1',
            name: 'John Doe',
            first_name: 'John',
            last_name: 'Doe',
            title: 'CEO',
            email: 'john@example.com',
            linkedin_url: 'https://linkedin.com/in/john',
            organization: {
              id: 'org1',
              name: 'Acme Corp',
              primary_domain: 'acme.com',
              industry: 'Tech',
            },
          },
        ],
        pagination: {
          page: 1,
          per_page: 25,
          total_entries: 1,
          total_pages: 1,
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await apolloPeopleSearch('test-api-key', {
        q_keywords: 'marketing',
      });

      expect(result.people).toHaveLength(1);
      expect(result.people[0].name).toBe('John Doe');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.apollo.io/api/v1/mixed_people/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Api-Key': 'test-api-key',
          }),
        })
      );
    });

    it('handles pagination parameters', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ people: [], pagination: { page: 2, per_page: 50, total_entries: 0, total_pages: 0 } }),
      } as any);

      await apolloPeopleSearch('key', {
        q_keywords: 'test',
        page: 2,
        per_page: 50,
      });

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callBody.page).toBe(2);
      expect(callBody.per_page).toBe(50);
    });

    it('clamps page size to max 100', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ people: [], pagination: { page: 1, per_page: 100, total_entries: 0, total_pages: 0 } }),
      } as any);

      await apolloPeopleSearch('key', {
        q_keywords: 'test',
        per_page: 200,
      });

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callBody.per_page).toBe(100);
    });

    it('throws on non-2xx response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      } as any);

      await expect(
        apolloPeopleSearch('invalid-key', { q_keywords: 'test' })
      ).rejects.toMatchObject({
        code: 'apollo_401',
        status: 401,
      });
    });
  });

  describe('apolloPeopleBulkSearch', () => {
    it('paginates through multiple pages', async () => {
      const page1 = {
        people: Array.from({ length: 100 }, (_, i) => ({
          id: `p${i}`,
          name: `Person ${i}`,
          first_name: null,
          last_name: null,
          title: null,
          email: null,
          linkedin_url: null,
          organization: null,
        })),
      };

      const page2 = {
        people: Array.from({ length: 50 }, (_, i) => ({
          id: `p${100 + i}`,
          name: `Person ${100 + i}`,
          first_name: null,
          last_name: null,
          title: null,
          email: null,
          linkedin_url: null,
          organization: null,
        })),
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page1),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page2),
        } as any);

      const result = await apolloPeopleBulkSearch('key', {
        niche: 'technology',
        maxRows: 120,
      });

      expect(result).toHaveLength(120);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('stops early when page returns fewer results than requested', async () => {
      const page1 = {
        people: Array.from({ length: 50 }, (_, i) => ({
          id: `p${i}`,
          name: `Person ${i}`,
          first_name: null,
          last_name: null,
          title: null,
          email: null,
          linkedin_url: null,
          organization: null,
        })),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page1),
      } as any);

      const result = await apolloPeopleBulkSearch('key', {
        niche: 'tech',
        maxRows: 100,
      });

      expect(result).toHaveLength(50);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('respects maxRows limit across pages', async () => {
      const page1 = {
        people: Array.from({ length: 100 }, (_, i) => ({
          id: `p${i}`,
          name: `Person ${i}`,
          first_name: null,
          last_name: null,
          title: null,
          email: null,
          linkedin_url: null,
          organization: null,
        })),
      };

      const page2 = {
        people: Array.from({ length: 100 }, (_, i) => ({
          id: `p${100 + i}`,
          name: `Person ${100 + i}`,
          first_name: null,
          last_name: null,
          title: null,
          email: null,
          linkedin_url: null,
          organization: null,
        })),
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page1),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page2),
        } as any);

      const result = await apolloPeopleBulkSearch('key', {
        niche: 'tech',
        maxRows: 150,
      });

      expect(result).toHaveLength(150);
    });
  });

  describe('type exports', () => {
    it('ApolloPerson has correct shape', () => {
      const person: ApolloPerson = {
        id: '1',
        name: 'Test',
        first_name: 'Test',
        last_name: null,
        title: 'Engineer',
        email: 'test@example.com',
        linkedin_url: 'https://linkedin.com/in/test',
        organization: {
          id: 'org1',
          name: 'Acme',
          primary_domain: 'acme.com',
          industry: 'Tech',
        },
      };

      expect(person.id).toBe('1');
      expect(person.organization?.name).toBe('Acme');
    });
  });
});
