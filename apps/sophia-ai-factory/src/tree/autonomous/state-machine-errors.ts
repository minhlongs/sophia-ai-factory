/**
 * Autonomous Engine State Machine Errors
 *
 * Layer: tree/autonomous (Pure domain engine, zero side effects)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module tree/autonomous/state-machine-errors
 */

export class AutonomousEngineError extends Error {
  readonly code: string;
  constructor(message: string, code = 'ERR_AUTONOMOUS_ENGINE') {
    super(message);
    this.name = 'AutonomousEngineError';
    this.code = code;
  }
}

export class AutonomousStateTransitionError extends AutonomousEngineError {
  constructor(
    public readonly currentState: string,
    public readonly event: string
  ) {
    super(
      `Invalid transition: Cannot process '${event}' while in '${currentState}' state`,
      'ERR_INVALID_TRANSITION'
    );
    this.name = 'AutonomousStateTransitionError';
  }
}

export class AutonomousCircuitBrokenError extends AutonomousEngineError {
  constructor(
    public readonly service: string,
    public readonly consecutiveFailures: number
  ) {
    super(
      `Circuit breaker is OPEN for '${service}' (${consecutiveFailures} consecutive failures)`,
      'ERR_CIRCUIT_BROKEN'
    );
    this.name = 'AutonomousCircuitBrokenError';
  }
}

export class AutonomousBudgetLimitExceededError extends AutonomousEngineError {
  constructor(
    public readonly limitType: 'daily' | 'monthly',
    public readonly current: number,
    public readonly max: number
  ) {
    super(
      `Autonomous spending limit exceeded for ${limitType}: ${current} >= ${max}`,
      'ERR_BUDGET_EXCEEDED'
    );
    this.name = 'AutonomousBudgetLimitExceededError';
  }
}
