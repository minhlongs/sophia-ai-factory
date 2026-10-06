import { describe, expect, it } from 'vitest';
import {
  AutonomousBudgetLimitExceededError,
  AutonomousCircuitBrokenError,
  AutonomousEngineError,
  AutonomousStateTransitionError,
  canTransition,
  transitionAutonomousState,
} from '../state-machine';

describe('Autonomous State Machine Engine', () => {
  describe('IDLE State Transitions', () => {
    it('transitions to RUNNING on START when budget is healthy', () => {
      const res = transitionAutonomousState('IDLE', 'START', {
        isBudgetExceeded: false,
      });
      expect(res.nextState).toBe('RUNNING');
      expect(res.changed).toBe(true);
      expect(res.allowed).toBe(true);
    });

    it('transitions to PAUSED on START when budget is exceeded', () => {
      const res = transitionAutonomousState('IDLE', 'START', {
        isBudgetExceeded: true,
      });
      expect(res.nextState).toBe('PAUSED');
      expect(res.reason).toContain('budget');
    });

    it('transitions to RUNNING on TRIGGER_CYCLE when budget is healthy', () => {
      const res = transitionAutonomousState('IDLE', 'TRIGGER_CYCLE', {
        isBudgetExceeded: false,
      });
      expect(res.nextState).toBe('RUNNING');
      expect(res.changed).toBe(true);
    });

    it('transitions to PAUSED on TRIGGER_CYCLE when budget is exceeded', () => {
      const res = transitionAutonomousState('IDLE', 'TRIGGER_CYCLE', {
        isBudgetExceeded: true,
      });
      expect(res.nextState).toBe('PAUSED');
    });

    it('transitions to PAUSED on PAUSE_CMD', () => {
      const res = transitionAutonomousState('IDLE', 'PAUSE_CMD');
      expect(res.nextState).toBe('PAUSED');
    });

    it('transitions to PAUSED on BUDGET_EXCEEDED', () => {
      const res = transitionAutonomousState('IDLE', 'BUDGET_EXCEEDED');
      expect(res.nextState).toBe('PAUSED');
    });

    it('remains IDLE and resets failure count on MANUAL_RESET (idempotent)', () => {
      const res = transitionAutonomousState('IDLE', 'MANUAL_RESET');
      expect(res.nextState).toBe('IDLE');
      expect(res.changed).toBe(false);
      expect(res.resetFailureCount).toBe(true);
    });

    it('transitions to PAUSED on EMERGENCY_HALT', () => {
      const res = transitionAutonomousState('IDLE', 'EMERGENCY_HALT');
      expect(res.nextState).toBe('PAUSED');
    });
  });

  describe('RUNNING State Transitions', () => {
    it('transitions to IDLE and resets failures on CYCLE_SUCCESS', () => {
      const res = transitionAutonomousState('RUNNING', 'CYCLE_SUCCESS');
      expect(res.nextState).toBe('IDLE');
      expect(res.resetFailureCount).toBe(true);
    });

    it('transitions to IDLE on NO_TASKS_DUE', () => {
      const res = transitionAutonomousState('RUNNING', 'NO_TASKS_DUE');
      expect(res.nextState).toBe('IDLE');
    });

    it('transitions to RECOVERING on TASK_FAILURE', () => {
      const res = transitionAutonomousState('RUNNING', 'TASK_FAILURE');
      expect(res.nextState).toBe('RECOVERING');
    });

    it('transitions to CIRCUIT_BROKEN on CONSECUTIVE_FAILURES', () => {
      const res = transitionAutonomousState('RUNNING', 'CONSECUTIVE_FAILURES');
      expect(res.nextState).toBe('CIRCUIT_BROKEN');
    });

    it('transitions to CIRCUIT_BROKEN on CRITICAL_ERROR', () => {
      const res = transitionAutonomousState('RUNNING', 'CRITICAL_ERROR');
      expect(res.nextState).toBe('CIRCUIT_BROKEN');
    });

    it('transitions to PAUSED on PAUSE_CMD', () => {
      const res = transitionAutonomousState('RUNNING', 'PAUSE_CMD');
      expect(res.nextState).toBe('PAUSED');
    });

    it('transitions to PAUSED on EMERGENCY_HALT', () => {
      const res = transitionAutonomousState('RUNNING', 'EMERGENCY_HALT');
      expect(res.nextState).toBe('PAUSED');
    });

    it('transitions to PAUSED on BUDGET_EXCEEDED', () => {
      const res = transitionAutonomousState('RUNNING', 'BUDGET_EXCEEDED');
      expect(res.nextState).toBe('PAUSED');
    });
  });

  describe('RECOVERING State Transitions', () => {
    it('transitions to RUNNING on RECOVERY_SUCCESS', () => {
      const res = transitionAutonomousState('RECOVERING', 'RECOVERY_SUCCESS');
      expect(res.nextState).toBe('RUNNING');
    });

    it('transitions to IDLE on MAX_RETRIES_EXCEEDED when consecutive failures < threshold', () => {
      const res = transitionAutonomousState('RECOVERING', 'MAX_RETRIES_EXCEEDED', {
        consecutiveFailures: 2,
        maxConsecutiveFailuresThreshold: 5,
      });
      expect(res.nextState).toBe('IDLE');
      expect(res.reason).toContain('quarantined to DLQ');
    });

    it('transitions to CIRCUIT_BROKEN on MAX_RETRIES_EXCEEDED when consecutive failures >= threshold', () => {
      const res = transitionAutonomousState('RECOVERING', 'MAX_RETRIES_EXCEEDED', {
        consecutiveFailures: 5,
        maxConsecutiveFailuresThreshold: 5,
      });
      expect(res.nextState).toBe('CIRCUIT_BROKEN');
      expect(res.reason).toContain('circuit tripped');
    });

    it('transitions to CIRCUIT_BROKEN on CONSECUTIVE_FAILURES', () => {
      const res = transitionAutonomousState('RECOVERING', 'CONSECUTIVE_FAILURES');
      expect(res.nextState).toBe('CIRCUIT_BROKEN');
    });

    it('transitions to CIRCUIT_BROKEN on CRITICAL_ERROR', () => {
      const res = transitionAutonomousState('RECOVERING', 'CRITICAL_ERROR');
      expect(res.nextState).toBe('CIRCUIT_BROKEN');
    });

    it('transitions to PAUSED on PAUSE_CMD', () => {
      const res = transitionAutonomousState('RECOVERING', 'PAUSE_CMD');
      expect(res.nextState).toBe('PAUSED');
    });

    it('transitions to PAUSED on EMERGENCY_HALT', () => {
      const res = transitionAutonomousState('RECOVERING', 'EMERGENCY_HALT');
      expect(res.nextState).toBe('PAUSED');
    });
  });

  describe('PAUSED State Transitions', () => {
    it('transitions to IDLE on RESUME_CMD when budget is within limits', () => {
      const res = transitionAutonomousState('PAUSED', 'RESUME_CMD', {
        isBudgetExceeded: false,
      });
      expect(res.nextState).toBe('IDLE');
    });

    it('remains PAUSED on RESUME_CMD when budget remains exceeded', () => {
      const res = transitionAutonomousState('PAUSED', 'RESUME_CMD', {
        isBudgetExceeded: true,
      });
      expect(res.nextState).toBe('PAUSED');
      expect(res.changed).toBe(false);
    });

    it('transitions to RUNNING on FORCE_CYCLE_CMD (admin override)', () => {
      const res = transitionAutonomousState('PAUSED', 'FORCE_CYCLE_CMD');
      expect(res.nextState).toBe('RUNNING');
    });

    it('remains PAUSED on PAUSE_CMD (idempotent)', () => {
      const res = transitionAutonomousState('PAUSED', 'PAUSE_CMD');
      expect(res.nextState).toBe('PAUSED');
      expect(res.changed).toBe(false);
    });

    it('remains PAUSED on EMERGENCY_HALT (idempotent)', () => {
      const res = transitionAutonomousState('PAUSED', 'EMERGENCY_HALT');
      expect(res.nextState).toBe('PAUSED');
      expect(res.changed).toBe(false);
    });
  });

  describe('CIRCUIT_BROKEN State Transitions', () => {
    it('transitions to RECOVERING on COOLDOWN_EXPIRED for canary probe', () => {
      const res = transitionAutonomousState('CIRCUIT_BROKEN', 'COOLDOWN_EXPIRED');
      expect(res.nextState).toBe('RECOVERING');
    });

    it('transitions to IDLE on MANUAL_RESET and resets failures', () => {
      const res = transitionAutonomousState('CIRCUIT_BROKEN', 'MANUAL_RESET');
      expect(res.nextState).toBe('IDLE');
      expect(res.resetFailureCount).toBe(true);
    });

    it('transitions to PAUSED on EMERGENCY_HALT', () => {
      const res = transitionAutonomousState('CIRCUIT_BROKEN', 'EMERGENCY_HALT');
      expect(res.nextState).toBe('PAUSED');
    });

    it('transitions to PAUSED on PAUSE_CMD', () => {
      const res = transitionAutonomousState('CIRCUIT_BROKEN', 'PAUSE_CMD');
      expect(res.nextState).toBe('PAUSED');
    });

    it('remains CIRCUIT_BROKEN on CRITICAL_ERROR (idempotent)', () => {
      const res = transitionAutonomousState('CIRCUIT_BROKEN', 'CRITICAL_ERROR');
      expect(res.nextState).toBe('CIRCUIT_BROKEN');
      expect(res.changed).toBe(false);
    });
  });

  describe('Illegal Transitions & Fail-Closed Guardrails', () => {
    it('throws AutonomousStateTransitionError when triggering cycle from CIRCUIT_BROKEN', () => {
      expect(() => {
        transitionAutonomousState('CIRCUIT_BROKEN', 'TRIGGER_CYCLE');
      }).toThrowError(AutonomousStateTransitionError);
    });

    it('throws AutonomousStateTransitionError when attempting START while RUNNING', () => {
      expect(() => {
        transitionAutonomousState('RUNNING', 'START');
      }).toThrowError(AutonomousStateTransitionError);
    });

    it('throws AutonomousStateTransitionError when attempting CYCLE_SUCCESS from IDLE', () => {
      expect(() => {
        transitionAutonomousState('IDLE', 'CYCLE_SUCCESS');
      }).toThrowError(AutonomousStateTransitionError);
    });

    it('canTransition returns false for illegal transitions', () => {
      expect(canTransition('CIRCUIT_BROKEN', 'START')).toBe(false);
      expect(canTransition('IDLE', 'CYCLE_SUCCESS')).toBe(false);
      expect(canTransition('PAUSED', 'TRIGGER_CYCLE')).toBe(false);
    });

    it('canTransition returns true for legal transitions', () => {
      expect(canTransition('IDLE', 'START')).toBe(true);
      expect(canTransition('RUNNING', 'CYCLE_SUCCESS')).toBe(true);
      expect(canTransition('CIRCUIT_BROKEN', 'COOLDOWN_EXPIRED')).toBe(true);
    });
  });

  describe('Error Classes Hierarchy', () => {
    it('verifies custom error inheritance and codes', () => {
      const baseErr = new AutonomousEngineError('test base', 'ERR_BASE');
      expect(baseErr).toBeInstanceOf(Error);
      expect(baseErr.code).toBe('ERR_BASE');

      const transErr = new AutonomousStateTransitionError('IDLE', 'CYCLE_SUCCESS');
      expect(transErr).toBeInstanceOf(AutonomousEngineError);
      expect(transErr.code).toBe('ERR_INVALID_TRANSITION');
      expect(transErr.message).toContain("Cannot process 'CYCLE_SUCCESS'");

      const circuitErr = new AutonomousCircuitBrokenError('affiliate-scout', 5);
      expect(circuitErr).toBeInstanceOf(AutonomousEngineError);
      expect(circuitErr.code).toBe('ERR_CIRCUIT_BROKEN');
      expect(circuitErr.message).toContain('affiliate-scout');

      const budgetErr = new AutonomousBudgetLimitExceededError('daily', 105, 100);
      expect(budgetErr).toBeInstanceOf(AutonomousEngineError);
      expect(budgetErr.code).toBe('ERR_BUDGET_EXCEEDED');
      expect(budgetErr.message).toContain('daily');
    });
  });
});
