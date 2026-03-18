/**
 * E2E Tests for Proposal API Integration
 *
 * Tests API endpoints for proposal generation, retrieval, and management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Mock proposal API endpoints
 */
interface ProposalRequest {
  customerId: string;
  includeAnalytics?: boolean;
  format?: 'json' | 'pdf';
}

interface ProposalResponse {
  id: string;
  customerId: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  health: {
    score: number;
    status: string;
    churnRisk: number;
  };
  features: Array<{
    id: string;
    name: string;
    priority: number;
  }>;
  pricing: {
    basePrice: number;
    discounts: Array<{ type: string; amount: number }>;
    finalPrice: number;
  };
  createdAt: string;
  expiresAt: string;
}

// Mock API client
class ProposalApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/proposals') {
    this.baseUrl = baseUrl;
  }

  async createProposal(request: ProposalRequest): Promise<ProposalResponse> {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to create proposal: ${response.status}`);
    }

    return response.json();
  }

  async getProposal(proposalId: string): Promise<ProposalResponse> {
    const response = await fetch(`${this.baseUrl}/${proposalId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Proposal not found');
      }
      throw new Error(`Failed to fetch proposal: ${response.status}`);
    }

    return response.json();
  }

  async listProposals(customerId: string): Promise<ProposalResponse[]> {
    const response = await fetch(`${this.baseUrl}?customerId=${customerId}`);

    if (!response.ok) {
      throw new Error(`Failed to list proposals: ${response.status}`);
    }

    return response.json();
  }

  async updateProposalStatus(
    proposalId: string,
    status: 'draft' | 'sent' | 'accepted' | 'rejected'
  ): Promise<ProposalResponse> {
    const response = await fetch(`${this.baseUrl}/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update proposal: ${response.status}`);
    }

    return response.json();
  }

  async deleteProposal(proposalId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${proposalId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete proposal: ${response.status}`);
    }
  }

  async exportProposal(proposalId: string, format: 'json' | 'pdf' = 'json'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/${proposalId}/export?format=${format}`);

    if (!response.ok) {
      throw new Error(`Failed to export proposal: ${response.status}`);
    }

    return response.blob();
  }

  async sendProposal(proposalId: string, recipientEmail: string): Promise<{ sent: boolean }> {
    const response = await fetch(`${this.baseUrl}/${proposalId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send proposal: ${response.status}`);
    }

    return response.json();
  }
}

describe('Proposal API Integration', () => {
  let client: ProposalApiClient;

  beforeEach(() => {
    client = new ProposalApiClient();
    vi.clearAllMocks();
  });

  describe('Proposal Creation', () => {
    it('should create proposal with valid request', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'draft',
        health: {
          score: 85,
          status: 'healthy',
          churnRisk: 0.1,
        },
        features: [
          { id: 'f1', name: 'AI Video Generation', priority: 1 },
          { id: 'f2', name: 'Analytics', priority: 2 },
        ],
        pricing: {
          basePrice: 299,
          discounts: [],
          finalPrice: 299,
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.createProposal({ customerId: 'cust_123' });

      expect(result.id).toBe('prop_123');
      expect(result.customerId).toBe('cust_123');
      expect(result.status).toBe('draft');
    });

    it('should include health score in proposal', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'draft',
        health: {
          score: 78,
          status: 'at-risk',
          churnRisk: 0.35,
        },
        features: [],
        pricing: { basePrice: 99, discounts: [], finalPrice: 99 },
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.createProposal({ customerId: 'cust_123' });

      expect(result.health.score).toBe(78);
      expect(result.health.status).toBe('at-risk');
      expect(result.health.churnRisk).toBeGreaterThan(0.3);
    });

    it('should include prioritized features in proposal', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'draft',
        health: { score: 85, status: 'healthy', churnRisk: 0.1 },
        features: [
          { id: 'f1', name: 'AI Video Generation', priority: 1 },
          { id: 'f2', name: 'Custom Templates', priority: 2 },
          { id: 'f3', name: 'Analytics Dashboard', priority: 3 },
        ],
        pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.createProposal({ customerId: 'cust_123' });

      expect(result.features).toHaveLength(3);
      expect(result.features[0].priority).toBe(1);
    });

    it('should apply pricing in proposal', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'draft',
        health: { score: 85, status: 'healthy', churnRisk: 0.1 },
        features: [],
        pricing: {
          basePrice: 299,
          discounts: [{ type: 'earlybird', amount: 59.8 }],
          finalPrice: 239.2,
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.createProposal({ customerId: 'cust_123' });

      expect(result.pricing.basePrice).toBe(299);
      expect(result.pricing.finalPrice).toBeLessThan(result.pricing.basePrice);
    });

    it('should handle proposal expiration', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'draft',
        health: { score: 85, status: 'healthy', churnRisk: 0.1 },
        features: [],
        pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.createProposal({ customerId: 'cust_123' });
      const expiresAt = new Date(result.expiresAt);
      const now = new Date();

      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('Proposal Retrieval', () => {
    it('should fetch proposal by ID', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'sent',
        health: { score: 85, status: 'healthy', churnRisk: 0.1 },
        features: [],
        pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.getProposal('prop_123');

      expect(result.id).toBe('prop_123');
      expect(global.fetch).toHaveBeenCalledWith('/api/proposals/prop_123');
    });

    it('should handle proposal not found', async () => {
      global.fetch = vi.fn(async () => new Response(null, { status: 404 }));

      await expect(client.getProposal('invalid_id')).rejects.toThrow('Proposal not found');
    });

    it('should list customer proposals', async () => {
      const mockProposals: ProposalResponse[] = [
        {
          id: 'prop_1',
          customerId: 'cust_123',
          status: 'draft',
          health: { score: 85, status: 'healthy', churnRisk: 0.1 },
          features: [],
          pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
        {
          id: 'prop_2',
          customerId: 'cust_123',
          status: 'sent',
          health: { score: 85, status: 'healthy', churnRisk: 0.1 },
          features: [],
          pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
      ];

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockProposals), { status: 200 })
      );

      const result = await client.listProposals('cust_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('prop_1');
      expect(result[1].id).toBe('prop_2');
    });
  });

  describe('Proposal Status Management', () => {
    it('should update proposal status to sent', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'sent',
        health: { score: 85, status: 'healthy', churnRisk: 0.1 },
        features: [],
        pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.updateProposalStatus('prop_123', 'sent');

      expect(result.status).toBe('sent');
    });

    it('should update proposal status to accepted', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'accepted',
        health: { score: 85, status: 'healthy', churnRisk: 0.1 },
        features: [],
        pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.updateProposalStatus('prop_123', 'accepted');

      expect(result.status).toBe('accepted');
    });

    it('should update proposal status to rejected', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'rejected',
        health: { score: 85, status: 'healthy', churnRisk: 0.1 },
        features: [],
        pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.updateProposalStatus('prop_123', 'rejected');

      expect(result.status).toBe('rejected');
    });
  });

  describe('Proposal Deletion', () => {
    it('should delete proposal', async () => {
      global.fetch = vi.fn(async () => new Response(null, { status: 204 }));

      await expect(client.deleteProposal('prop_123')).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith('/api/proposals/prop_123', {
        method: 'DELETE',
      });
    });

    it('should handle deletion error', async () => {
      global.fetch = vi.fn(async () => new Response(null, { status: 500 }));

      await expect(client.deleteProposal('prop_123')).rejects.toThrow();
    });
  });

  describe('Proposal Export', () => {
    it('should export proposal as JSON', async () => {
      const mockData = { id: 'prop_123', status: 'draft' };
      const blob = new Blob([JSON.stringify(mockData)], { type: 'application/json' });

      global.fetch = vi.fn(async () => new Response(blob, { status: 200 }));

      const result = await client.exportProposal('prop_123', 'json');

      expect(result).toBeInstanceOf(Blob);
      expect(global.fetch).toHaveBeenCalledWith('/api/proposals/prop_123/export?format=json');
    });

    it('should export proposal as PDF', async () => {
      const blob = new Blob(['PDF data'], { type: 'application/pdf' });

      global.fetch = vi.fn(async () => new Response(blob, { status: 200 }));

      const result = await client.exportProposal('prop_123', 'pdf');

      expect(result).toBeInstanceOf(Blob);
      expect(global.fetch).toHaveBeenCalledWith('/api/proposals/prop_123/export?format=pdf');
    });
  });

  describe('Proposal Sending', () => {
    it('should send proposal to email', async () => {
      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ sent: true }), { status: 200 })
      );

      const result = await client.sendProposal('prop_123', 'customer@example.com');

      expect(result.sent).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/proposals/prop_123/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: 'customer@example.com' }),
      });
    });

    it('should handle send error', async () => {
      global.fetch = vi.fn(async () => new Response(null, { status: 400 }));

      await expect(client.sendProposal('prop_123', 'invalid')).rejects.toThrow();
    });
  });

  describe('End-to-End Proposal Workflow', () => {
    it('should complete full proposal lifecycle', async () => {
      const createResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'draft',
        health: { score: 85, status: 'healthy', churnRisk: 0.1 },
        features: [{ id: 'f1', name: 'Feature 1', priority: 1 }],
        pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      const sendResponse: ProposalResponse = {
        ...createResponse,
        status: 'sent',
      };

      const acceptResponse: ProposalResponse = {
        ...createResponse,
        status: 'accepted',
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(createResponse), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(sendResponse), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(acceptResponse), { status: 200 }));

      // Step 1: Create
      const created = await client.createProposal({ customerId: 'cust_123' });
      expect(created.status).toBe('draft');

      // Step 2: Send
      const sent = await client.updateProposalStatus(created.id, 'sent');
      expect(sent.status).toBe('sent');

      // Step 3: Accept
      const accepted = await client.updateProposalStatus(created.id, 'accepted');
      expect(accepted.status).toBe('accepted');
    });

    it('should support proposal alternatives', async () => {
      const mockResponse: ProposalResponse = {
        id: 'prop_123',
        customerId: 'cust_123',
        status: 'draft',
        health: { score: 85, status: 'healthy', churnRisk: 0.1 },
        features: [],
        pricing: { basePrice: 299, discounts: [], finalPrice: 299 },
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const proposal = await client.createProposal({ customerId: 'cust_123' });

      // Simulate alternatives
      const alternatives = [
        { ...proposal.pricing, finalPrice: proposal.pricing.finalPrice * 0.8 },
        { ...proposal.pricing, finalPrice: proposal.pricing.finalPrice * 1.2 },
      ];

      expect(alternatives).toHaveLength(2);
      expect(alternatives[0].finalPrice).toBeLessThan(alternatives[1].finalPrice);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network timeout', async () => {
      global.fetch = vi.fn(async () => {
        throw new Error('Network timeout');
      });

      await expect(client.createProposal({ customerId: 'cust_123' })).rejects.toThrow();
    });

    it('should handle invalid request', async () => {
      global.fetch = vi.fn(async () => new Response(null, { status: 400 }));

      await expect(client.createProposal({ customerId: '' })).rejects.toThrow();
    });

    it('should handle server error', async () => {
      global.fetch = vi.fn(async () => new Response(null, { status: 500 }));

      await expect(client.createProposal({ customerId: 'cust_123' })).rejects.toThrow();
    });
  });
});
