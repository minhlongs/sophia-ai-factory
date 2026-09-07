import { describe, it, expect } from 'vitest'
import {
  FailureKind,
  CircuitState,
  classifyHttpStatus,
  classifyError,
} from '@/seed/types/failure-kind'

describe('FailureKind enum', () => {
  it('has all expected values', () => {
    expect(Object.values(FailureKind)).toEqual([
      'RATE_LIMIT',
      'SERVER_ERROR',
      'AUTH_FAILURE',
      'TIMEOUT',
      'NETWORK',
      'UNKNOWN',
      'PROVIDER_NOT_CERTIFIED',
    ])
  })
})

describe('CircuitState enum', () => {
  it('has all expected values', () => {
    expect(Object.values(CircuitState)).toEqual([
      'CLOSED',
      'DEGRADED',
      'OPEN',
      'HALF_OPEN',
    ])
  })
})

describe('classifyHttpStatus', () => {
  it('classifies 401 as AUTH_FAILURE', () => {
    expect(classifyHttpStatus(401)).toBe(FailureKind.AUTH_FAILURE)
  })

  it('classifies 403 as AUTH_FAILURE', () => {
    expect(classifyHttpStatus(403)).toBe(FailureKind.AUTH_FAILURE)
  })

  it('classifies 429 as RATE_LIMIT', () => {
    expect(classifyHttpStatus(429)).toBe(FailureKind.RATE_LIMIT)
  })

  it('classifies 500 as SERVER_ERROR', () => {
    expect(classifyHttpStatus(500)).toBe(FailureKind.SERVER_ERROR)
  })

  it('classifies 502 as SERVER_ERROR', () => {
    expect(classifyHttpStatus(502)).toBe(FailureKind.SERVER_ERROR)
  })

  it('classifies 503 as SERVER_ERROR', () => {
    expect(classifyHttpStatus(503)).toBe(FailureKind.SERVER_ERROR)
  })

  it('classifies 408 as TIMEOUT', () => {
    expect(classifyHttpStatus(408)).toBe(FailureKind.TIMEOUT)
  })

  it('classifies 200 as UNKNOWN', () => {
    expect(classifyHttpStatus(200)).toBe(FailureKind.UNKNOWN)
  })

  it('classifies 400 as UNKNOWN', () => {
    expect(classifyHttpStatus(400)).toBe(FailureKind.UNKNOWN)
  })
})

describe('classifyError', () => {
  it('classifies timeout error', () => {
    const error = new Error('Request timed out')
    expect(classifyError(error)).toBe(FailureKind.TIMEOUT)
  })

  it('classifies AbortError as TIMEOUT', () => {
    const error = new Error('aborted')
    error.name = 'AbortError'
    expect(classifyError(error)).toBe(FailureKind.TIMEOUT)
  })

  it('classifies connection refused as NETWORK', () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:3000')
    expect(classifyError(error)).toBe(FailureKind.NETWORK)
  })

  it('classifies DNS not found as NETWORK', () => {
    const error = new Error('getaddrinfo ENOTFOUND api.example.com')
    expect(classifyError(error)).toBe(FailureKind.NETWORK)
  })

  it('classifies 401 in message as AUTH_FAILURE', () => {
    const error = new Error('HTTP 401: Unauthorized')
    expect(classifyError(error)).toBe(FailureKind.AUTH_FAILURE)
  })

  it('classifies 429 in message as RATE_LIMIT', () => {
    const error = new Error('HTTP 429: Too Many Requests')
    expect(classifyError(error)).toBe(FailureKind.RATE_LIMIT)
  })

  it('classifies 500 in message as SERVER_ERROR', () => {
    const error = new Error('HTTP 500: Internal Server Error')
    expect(classifyError(error)).toBe(FailureKind.SERVER_ERROR)
  })

  it('returns UNKNOWN for non-Error values', () => {
    expect(classifyError('string error')).toBe(FailureKind.UNKNOWN)
    expect(classifyError(null)).toBe(FailureKind.UNKNOWN)
    expect(classifyError(undefined)).toBe(FailureKind.UNKNOWN)
    expect(classifyError(42)).toBe(FailureKind.UNKNOWN)
  })

  it('returns UNKNOWN for unclassified Error', () => {
    const error = new Error('something weird happened')
    expect(classifyError(error)).toBe(FailureKind.UNKNOWN)
  })
})
