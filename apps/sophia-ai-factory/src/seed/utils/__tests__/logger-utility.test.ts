/**
 * Unit tests for logger utility
 * @module seed/utils/__tests__/logger-utility.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, Logger } from '../logger-utility';

describe('LoggerUtility', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('createLogger', () => {
    it('should create logger with context', () => {
      const logger = createLogger('test-module');

      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should log info messages with correct format', () => {
      const logger = createLogger('test-module');
      logger.info('Test message');

      const loggedArg = consoleSpy.mock.calls[0][0] as string;
      expect(loggedArg).toContain('[INFO]');
      expect(loggedArg).toContain('test-module');
      expect(loggedArg).toContain('Test message');
    });

    it('should log error messages with correct format', () => {
      const logger = createLogger('test-module');
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      const loggedArg = consoleSpy.mock.calls[0][0] as string;
      expect(loggedArg).toContain('[ERROR]');
      expect(loggedArg).toContain('test-module');
      expect(loggedArg).toContain('Error occurred');
      expect(loggedArg).toContain('Test error');
    });

    it('should log warn messages with correct format', () => {
      const logger = createLogger('test-module');
      logger.warn('Warning message');

      const loggedArg = consoleSpy.mock.calls[0][0] as string;
      expect(loggedArg).toContain('[WARN]');
      expect(loggedArg).toContain('test-module');
      expect(loggedArg).toContain('Warning message');
    });

    it('should log debug messages with correct format', () => {
      const logger = createLogger('test-module');
      logger.debug('Debug message', { key: 'value' });

      const loggedArg = consoleSpy.mock.calls[0][0] as string;
      expect(loggedArg).toContain('[DEBUG]');
      expect(loggedArg).toContain('test-module');
      expect(loggedArg).toContain('Debug message');
      expect(loggedArg).toContain('"key":"value"');
    });

    it('should include timestamp in logs', () => {
      const logger = createLogger('test-module');
      logger.info('Timestamp test');

      const loggedArg = consoleSpy.mock.calls[0][0] as string;
      // Check that timestamp format exists (YYYY-MM-DD)
      expect(loggedArg).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('Logger methods', () => {
    it('should chain context correctly', () => {
      const logger = createLogger('parent').child('child');

      expect(logger.context).toContain('parent');
      expect(logger.context).toContain('child');
    });

    it('should handle empty context', () => {
      const logger = createLogger('');

      expect(logger.context).toBe('');
    });

    it('should handle special characters in context', () => {
      const logger = createLogger('test-module-with-dashes_and_underscores');

      logger.info('Special chars test');

      const loggedArg = consoleSpy.mock.calls[0][0] as string;
      expect(loggedArg).toContain('test-module-with-dashes_and_underscores');
      expect(loggedArg).toContain('Special chars test');
    });
  });
});
