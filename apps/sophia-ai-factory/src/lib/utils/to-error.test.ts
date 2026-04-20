/**
 * toError() helper unit tests
 */

import { describe, it, expect } from 'vitest'
import { toError } from './to-error'

describe('toError', () => {
  it('returns Error instance unchanged (identity preserved)', () => {
    const err = new Error('original')
    expect(toError(err)).toBe(err)
  })

  it('wraps string — .message equals the string', () => {
    const result = toError('something went wrong')
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('something went wrong')
  })

  it('wraps number — .message equals String(n)', () => {
    const result = toError(42)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('42')
  })

  it('wraps plain object — .message equals "[object Object]"', () => {
    const result = toError({ code: 500 })
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('[object Object]')
  })

  it('wraps null — .message equals "null"', () => {
    const result = toError(null)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('null')
  })

  it('wraps undefined — .message equals "undefined"', () => {
    const result = toError(undefined)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('undefined')
  })
})
