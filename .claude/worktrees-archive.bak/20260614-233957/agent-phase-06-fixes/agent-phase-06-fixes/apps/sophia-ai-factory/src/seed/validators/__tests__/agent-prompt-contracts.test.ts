/**
 * agent-prompt-contracts.test.ts
 *
 * Tests for Zod-based prompt contract validation (Phase 03).
 * Covers: happy path per role, missing fields, invalid enums, oversized payloads,
 * and backwards compatibility (no contract = no validation).
 */

import { describe, it, expect } from 'vitest';
import {
  validatePromptContract,
  PromptContractError,
  scriptWriterSchema,
  voiceGeneratorSchema,
  videoProducerSchema,
  publisherSchema,
  analystSchema,
  supervisorSchema,
} from '../agent-prompt-contracts';

// ---------------------------------------------------------------------------
// Happy path — one valid contract per role
// ---------------------------------------------------------------------------

describe('validatePromptContract — valid contracts', () => {
  it('accepts a valid script_writer contract', () => {
    const contract = {
      objective: 'Write a 30-second intro script',
      outputFormat: 'markdown',
      topic: 'AI productivity tools',
      tone: 'casual',
      targetLength: 'short',
    };
    const result = validatePromptContract('script_writer', contract);
    expect(result.topic).toBe('AI productivity tools');
    expect(result.tone).toBe('casual');
  });

  it('accepts a valid voice_generator contract', () => {
    const contract = {
      objective: 'Generate TTS audio',
      outputFormat: 'json',
      voiceId: 'elevenlabs-rachel',
      language: 'en-US',
      scriptText: 'Hello, welcome to Sophia AI.',
    };
    const result = validatePromptContract('voice_generator', contract);
    expect(result.voiceId).toBe('elevenlabs-rachel');
  });

  it('accepts a valid video_producer contract', () => {
    const contract = {
      objective: 'Assemble final video',
      outputFormat: 'json',
      audioUrl: 'https://cdn.example.com/audio.mp3',
      visualStyle: 'corporate-clean',
    };
    const result = validatePromptContract('video_producer', contract);
    expect(result.visualStyle).toBe('corporate-clean');
  });

  it('accepts a valid publisher contract', () => {
    const contract = {
      objective: 'Publish to social channels',
      outputFormat: 'structured',
      platforms: ['youtube', 'tiktok'],
    };
    const result = validatePromptContract('publisher', contract);
    expect(result.platforms).toEqual(['youtube', 'tiktok']);
  });

  it('accepts a valid analyst contract', () => {
    const contract = {
      objective: 'Analyse Q2 campaign metrics',
      outputFormat: 'json',
      metrics: ['views', 'ctr', 'conversions'],
      timeRange: {
        start: '2024-04-01T00:00:00Z',
        end: '2024-06-30T23:59:59Z',
      },
    };
    const result = validatePromptContract('analyst', contract);
    expect(result.metrics).toHaveLength(3);
  });

  it('accepts a valid supervisor contract', () => {
    const contract = {
      objective: 'Orchestrate full content pipeline',
      outputFormat: 'structured',
      pipeline: ['script_writer', 'voice_generator', 'video_producer', 'publisher'],
    };
    const result = validatePromptContract('supervisor', contract);
    expect((result.pipeline as string[]).length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Failure cases
// ---------------------------------------------------------------------------

describe('validatePromptContract — invalid contracts', () => {
  it('throws PromptContractError when required role-specific field is missing', () => {
    // script_writer missing 'topic'
    const contract = {
      objective: 'Write a script',
      outputFormat: 'markdown',
      tone: 'casual',
      targetLength: 'short',
      // topic intentionally omitted
    };
    expect(() => validatePromptContract('script_writer', contract)).toThrow(
      PromptContractError,
    );
    try {
      validatePromptContract('script_writer', contract);
    } catch (err) {
      expect(err).toBeInstanceOf(PromptContractError);
      const e = err as PromptContractError;
      expect(e.role).toBe('script_writer');
      expect(e.issues.some((i) => i.path.includes('topic'))).toBe(true);
    }
  });

  it('throws PromptContractError for invalid enum value', () => {
    const contract = {
      objective: 'Write a script',
      outputFormat: 'markdown',
      topic: 'AI',
      tone: 'angry', // invalid — not in enum
      targetLength: 'short',
    };
    expect(() => validatePromptContract('script_writer', contract)).toThrow(
      PromptContractError,
    );
    try {
      validatePromptContract('script_writer', contract);
    } catch (err) {
      const e = err as PromptContractError;
      expect(e.issues.some((i) => i.path.includes('tone'))).toBe(true);
    }
  });

  it('throws PromptContractError when objective exceeds 2000 characters', () => {
    const contract = {
      objective: 'x'.repeat(2001),
      outputFormat: 'text',
      topic: 'Test',
      tone: 'professional',
      targetLength: 'medium',
    };
    expect(() => validatePromptContract('script_writer', contract)).toThrow(
      PromptContractError,
    );
    try {
      validatePromptContract('script_writer', contract);
    } catch (err) {
      const e = err as PromptContractError;
      expect(e.issues.some((i) => i.path.includes('objective'))).toBe(true);
    }
  });

  it('throws PromptContractError when publisher platforms array is empty', () => {
    const contract = {
      objective: 'Publish now',
      outputFormat: 'json',
      platforms: [], // min(1) violated
    };
    expect(() => validatePromptContract('publisher', contract)).toThrow(
      PromptContractError,
    );
  });

  it('throws PromptContractError for invalid audioUrl in video_producer', () => {
    const contract = {
      objective: 'Make video',
      outputFormat: 'json',
      audioUrl: 'not-a-url',
      visualStyle: 'clean',
    };
    expect(() => validatePromptContract('video_producer', contract)).toThrow(
      PromptContractError,
    );
    try {
      validatePromptContract('video_producer', contract);
    } catch (err) {
      const e = err as PromptContractError;
      expect(e.issues.some((i) => i.path.includes('audioUrl'))).toBe(true);
    }
  });

  it('error message includes role name and field path', () => {
    const contract = {
      objective: 'Generate TTS',
      outputFormat: 'json',
      // voiceId missing
      language: 'en',
      scriptText: 'Hello world',
    };
    try {
      validatePromptContract('voice_generator', contract);
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      const e = err as PromptContractError;
      expect(e.message).toContain('voice_generator');
      expect(e.message).toContain('voiceId');
    }
  });
});

// ---------------------------------------------------------------------------
// Optional fields — should not cause failures
// ---------------------------------------------------------------------------

describe('validatePromptContract — optional fields', () => {
  it('accepts script_writer without maxTokens or escalationRules', () => {
    const contract = {
      objective: 'Script for product launch',
      outputFormat: 'text',
      topic: 'Product launch',
      tone: 'professional',
      targetLength: 'long',
    };
    expect(() => validatePromptContract('script_writer', contract)).not.toThrow();
  });

  it('accepts analyst with compareWith omitted', () => {
    const contract = {
      objective: 'Analyse monthly retention',
      outputFormat: 'json',
      metrics: ['retention', 'churn'],
      timeRange: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-31T23:59:59Z',
      },
    };
    expect(() => validatePromptContract('analyst', contract)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Schema exports — individual schema unit tests
// ---------------------------------------------------------------------------

describe('exported schemas', () => {
  it('scriptWriterSchema.safeParse returns success:true for valid data', () => {
    const result = scriptWriterSchema.safeParse({
      objective: 'Write intro',
      outputFormat: 'markdown',
      topic: 'Productivity',
      tone: 'educational',
      targetLength: 'medium',
    });
    expect(result.success).toBe(true);
  });

  it('voiceGeneratorSchema.safeParse returns success:false for missing scriptText', () => {
    const result = voiceGeneratorSchema.safeParse({
      objective: 'TTS',
      outputFormat: 'json',
      voiceId: 'v1',
      language: 'vi',
    });
    expect(result.success).toBe(false);
  });

  it('supervisorSchema.safeParse rejects empty pipeline array', () => {
    const result = supervisorSchema.safeParse({
      objective: 'Run pipeline',
      outputFormat: 'structured',
      pipeline: [],
    });
    expect(result.success).toBe(false);
  });

  it('videoProducerSchema, publisherSchema, analystSchema are exported', () => {
    expect(videoProducerSchema).toBeDefined();
    expect(publisherSchema).toBeDefined();
    expect(analystSchema).toBeDefined();
  });
});
