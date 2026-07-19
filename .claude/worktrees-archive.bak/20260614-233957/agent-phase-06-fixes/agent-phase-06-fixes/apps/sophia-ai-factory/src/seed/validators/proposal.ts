import { z } from 'zod';

export const generateProposalSchema = z.object({
  templateId: z.string().uuid('Invalid template ID').optional(),
  clientName: z.string().min(2, 'Client name must be at least 2 characters'),
  clientCompany: z.string().min(2, 'Company name must be at least 2 characters'),
  clientEmail: z.string().email('Invalid email address').optional(),
  industry: z.string().min(1, 'Industry is required'),
  painPoints: z.array(z.string()).min(1, 'At least one pain point is required'),
  goals: z.array(z.string()).min(1, 'At least one goal is required'),
  solutionDescription: z.string().min(10, 'Solution description must be at least 10 characters'),
  timeline: z.string().min(1, 'Timeline is required'),
  investment: z.string().min(1, 'Investment range is required'),
  deliverables: z.array(z.string()).min(1, 'At least one deliverable is required'),
  tone: z.enum(['professional', 'friendly', 'technical']).default('professional'),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
});

export type GenerateProposalInput = z.infer<typeof generateProposalSchema>;

export const proposalSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  templateId: z.string().uuid(),
  clientName: z.string(),
  clientCompany: z.string().optional(),
  clientEmail: z.string().optional(),
  status: z.enum(['draft', 'generated', 'published', 'sent', 'accepted', 'rejected']),
  inputData: z.record(z.string(), z.unknown()),
  generatedContent: z.record(z.string(), z.unknown()).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  generatedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Proposal = z.infer<typeof proposalSchema>;

export const updateProposalSchema = z.object({
  clientName: z.string().min(2).optional(),
  clientCompany: z.string().min(2).optional(),
  clientEmail: z.string().email().optional(),
  status: z.enum(['draft', 'generated', 'published', 'sent', 'accepted', 'rejected']).optional(),
  inputData: z.record(z.string(), z.unknown()).optional(),
  generatedContent: z.record(z.string(), z.unknown()).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
});

export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
