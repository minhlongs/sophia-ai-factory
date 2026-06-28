import { describe, it, expect } from 'vitest';
import {
  validateAgentResult,
  tryParseAndCorrect,
  AgentResultValidationError,
} from '../agent-result-contracts';

describe('agent-result-contracts', () => {
  describe('validateAgentResult', () => {
    it('accepts valid success result', () => {
      const result = validateAgentResult({
        success: true,
        data: { output: 'hello world' },
        metadata: { agentRole: 'analyst', executionTimeMs: 1500 },
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.success).toBe(true);
        expect(result.data.data).toEqual({ output: 'hello world' });
      }
    });

    it('accepts valid error result', () => {
      const result = validateAgentResult({
        success: false,
        error: { code: 'TIMEOUT', message: 'Request timed out', retryable: true },
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.success).toBe(false);
        expect(result.data.error?.retryable).toBe(true);
      }
    });

    it('rejects success=true without data', () => {
      const result = validateAgentResult({ success: true });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBeInstanceOf(AgentResultValidationError);
        expect(result.correctionHint).toContain('Fix');
      }
    });

    it('rejects success=false without error', () => {
      const result = validateAgentResult({ success: false });
      expect(result.valid).toBe(false);
    });

    it('rejects error with missing code', () => {
      const result = validateAgentResult({
        success: false,
        error: { message: 'fail', retryable: false },
      });
      expect(result.valid).toBe(false);
    });

    it('accepts minimal success with null-ish data', () => {
      const result = validateAgentResult({ success: true, data: null });
      expect(result.valid).toBe(true);
    });

    it('accepts success with metadata', () => {
      const result = validateAgentResult({
        success: true,
        data: 'ok',
        metadata: { modelUsed: 'qwen3:32b', tokensUsed: 500 },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('tryParseAndCorrect', () => {
    it('parses valid JSON string', () => {
      const json = JSON.stringify({ success: true, data: { x: 1 } });
      const result = tryParseAndCorrect(json);
      expect(result.valid).toBe(true);
    });

    it('fixes trailing commas', () => {
      const malformed = '{"success": true, "data": {"x": 1,},}';
      const result = tryParseAndCorrect(malformed);
      expect(result.valid).toBe(true);
    });

    it('extracts JSON from surrounding text', () => {
      const wrapped = 'Here is the result: {"success": true, "data": "hello"} -- end';
      const result = tryParseAndCorrect(wrapped);
      expect(result.valid).toBe(true);
    });

    it('handles truncated JSON by closing braces', () => {
      const truncated = '{"success": true, "data": {"nested": "value"';
      const result = tryParseAndCorrect(truncated);
      expect(result.valid).toBe(true);
    });

    it('returns invalid for completely unparseable input', () => {
      const result = tryParseAndCorrect('not json at all');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.correctionHint).toContain('not valid JSON');
      }
    });

    it('returns invalid for empty string', () => {
      const result = tryParseAndCorrect('');
      expect(result.valid).toBe(false);
    });
  });
});
