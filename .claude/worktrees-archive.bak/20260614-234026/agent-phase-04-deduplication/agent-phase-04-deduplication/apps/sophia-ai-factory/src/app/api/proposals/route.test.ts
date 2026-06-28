/**
 * Proposal MCU Integration Tests
 *
 * Tests for POST /api/proposals endpoint with MCU balance checks,
 * cost deduction, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/mcu/credits-repo', () => ({
  getBalance: vi.fn(),
  deductCredits: vi.fn(),
}));

vi.mock('@/seed/ai/proposal-generator', () => ({
  generateProposal: vi.fn(),
}));

vi.mock('@/seed/ai/proposal-quality-check', () => ({
  checkProposalQuality: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST } from './route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getBalance, deductCredits } from '@/land/mcu/credits-repo';
import { generateProposal } from '@/seed/ai/proposal-generator';
import { checkProposalQuality } from '@/seed/ai/proposal-quality-check';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetBalance = vi.mocked(getBalance);
const mockDeductCredits = vi.mocked(deductCredits);
const mockGenerateProposal = vi.mocked(generateProposal);
const mockCheckProposalQuality = vi.mocked(checkProposalQuality);

/** Helper to extract JSON from response */
async function getJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

/** Helper to create request with JSON body */
function createRequest(body: Record<string, unknown>): NextRequest {
  const url = new URL('http://localhost:3000/api/proposals');
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Valid proposal body for testing */
const validProposalBody = {
  clientName: 'Acme Corp',
  clientCompany: 'Acme Inc',
  industry: 'Technology',
  painPoints: ['High CAC', 'Low conversion'],
  goals: ['Increase ROAS', 'Improve retention'],
  solutionDescription: 'Implement AI-driven marketing automation platform with real-time analytics',
  timeline: '3 months',
  investment: '$50k-100k',
  deliverables: ['Platform setup', 'Training', 'Support'],
  tone: 'professional' as const,
  length: 'medium' as const,
};

describe('POST /api/proposals (MCU Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = createRequest(validProposalBody);
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await getJson(response);
      expect(data.error).toBe('Authentication required');
    });
  });

  describe('MCU Balance Check', () => {
    it('should return 402 INSUFFICIENT_BALANCE when credits < cost (5)', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'user-123', email: 'test@example.com' });
      // Balance is 2, cost is 5
      mockGetBalance.mockResolvedValue({
        credits_remaining: 2,
        credits_total_purchased: 100,
        credits_total_used: 98,
      });

      const request = createRequest(validProposalBody);
      const response = await POST(request);

      expect(response.status).toBe(402);
      const data = await getJson(response);
      expect(data.error).toBe('Insufficient MCU credits');
      expect(data.code).toBe('INSUFFICIENT_BALANCE');
      expect(data.required).toBe(5);
      expect(data.available).toBe(2);
      expect(data.upgrade_url).toContain('dashboard/credits');
      // Should NOT call deductCredits or generateProposal
      expect(mockGenerateProposal).not.toHaveBeenCalled();
      expect(mockDeductCredits).not.toHaveBeenCalled();
    });
  });

  describe('Successful Generation', () => {
    it('should return 200 with mcuUsed and remainingBalance on success', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'user-123', email: 'test@example.com' });
      // Balance is 10, cost is 5, should succeed
      mockGetBalance.mockResolvedValue({
        credits_remaining: 10,
        credits_total_purchased: 100,
        credits_total_used: 90,
      });
      // Mock successful proposal generation
      mockGenerateProposal.mockResolvedValue({
        id: 'proposal-uuid',
        content: 'Generated proposal content',
        metadata: {
          clientName: validProposalBody.clientName,
          industry: validProposalBody.industry,
        },
      } as never);
      // Mock quality check
      mockCheckProposalQuality.mockReturnValue({
        overallScore: 85,
        passed: true,
        feedback: 'Well structured proposal',
      } as never);
      // Mock successful credit deduction
      mockDeductCredits.mockResolvedValue(true);

      const request = createRequest(validProposalBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await getJson(response);
      expect(data.success).toBe(true);
      expect(data.mcuUsed).toBe(5);
      expect(data.remainingBalance).toBe(5); // 10 - 5
      expect(data.quality).toBeDefined();
      const quality = data.quality as { score: number; passed: boolean };
      expect(quality.score).toBe(85);
      expect(quality.passed).toBe(true);
      // Verify deductCredits was called with correct params
      expect(mockDeductCredits).toHaveBeenCalledWith(
        'user-123',
        5,
        expect.any(String), // proposalRef UUID
        'proposal_generation',
      );
    });
  });
});
