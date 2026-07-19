import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contextOverflowLog } from '../context-overflow-log';
import { createServerClient } from '@/seed/db/client';

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

describe('ContextOverflowLog', () => {
  let mockDb: any;
  let mockStatement: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStatement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      all: vi.fn().mockResolvedValue([]),
    };

    mockDb = {
      prepare: vi.fn().mockReturnValue(mockStatement),
    };

    (createServerClient as any).mockReturnValue(mockDb);
  });

  it('should log an overflow event', async () => {
    const event = {
      provider: 'openai',
      tokensUsed: 130000,
      limit: 128000,
      contextWindow: 'gpt-4-turbo',
      agentId: 'tester-agent',
      metadata: { reason: 'too many turns' },
    };

    await contextOverflowLog.log(event);

    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_context_overflow_logs'));
    expect(mockStatement.bind).toHaveBeenCalledWith(
      expect.any(Number),
      'tester-agent',
      'openai',
      130000,
      128000,
      'gpt-4-turbo',
      '',
      expect.stringContaining('too many turns')
    );
    expect(mockStatement.run).toHaveBeenCalled();
  });

  it('should log with default values when partial event is provided', async () => {
    await contextOverflowLog.log({ provider: 'claude' });

    expect(mockStatement.bind).toHaveBeenCalledWith(
      expect.any(Number),
      'system',
      'claude',
      0,
      0,
      'unknown',
      '',
      '{}'
    );
  });

  it('should not throw when database insertion fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockStatement.run.mockRejectedValue(new Error('DB Connection Error'));

    await expect(contextOverflowLog.log({ provider: 'fail' })).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to log event:'), expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should fetch recent events', async () => {
    const mockEvents = [
      { timestamp: 1, provider: 'openai', tokens_used: 100 },
      { timestamp: 2, provider: 'claude', tokens_used: 200 },
    ];
    mockStatement.all.mockResolvedValue(mockEvents);

    const result = await contextOverflowLog.getRecent(5);

    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM ai_context_overflow_logs ORDER BY timestamp DESC LIMIT ?'));
    expect(mockStatement.bind).toHaveBeenCalledWith(5);
    expect(result).toEqual(mockEvents);
  });

  it('should fetch aggregated stats', async () => {
    const mockStats = [
      { provider: 'openai', agent_id: 'agent1', count: 5, max_tokens: 130000 },
    ];
    mockStatement.all.mockResolvedValue(mockStats);

    const result = await contextOverflowLog.getStats();

    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('GROUP BY provider, agent_id'));
    expect(result).toEqual(mockStats);
  });

  it('should clear old logs', async () => {
    await contextOverflowLog.clear(14);

    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM ai_context_overflow_logs WHERE timestamp < ?'));
    expect(mockStatement.bind).toHaveBeenCalledWith(expect.any(Number));
    expect(mockStatement.run).toHaveBeenCalled();
  });
});
