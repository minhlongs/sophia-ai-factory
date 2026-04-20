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

  it('wraps plain object without message — .message equals "[object Object]"', () => {
    const result = toError({ foo: 'bar' })
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

  it('preserves Supabase PostgrestError shape (message + code/details/hint)', () => {
    const pgErr = {
      message: 'relation "users" does not exist',
      code: '42P01',
      details: 'Schema public scanned',
      hint: 'Did you mean table "user"?',
    }
    const result = toError(pgErr)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('relation "users" does not exist')
    expect((result as Error & { code?: string }).code).toBe('42P01')
    expect((result as Error & { details?: string }).details).toBe('Schema public scanned')
    expect((result as Error & { hint?: string }).hint).toBe('Did you mean table "user"?')
  })

  it('preserves partial PostgrestError (message + code only)', () => {
    const pgErr = { message: 'permission denied', code: '42501' }
    const result = toError(pgErr)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('permission denied')
    expect((result as Error & { code?: string }).code).toBe('42501')
    expect('details' in result).toBe(false)
    expect('hint' in result).toBe(false)
  })

  it('handles AuthError-like object (message + status)', () => {
    const authErr = { message: 'JWT expired', status: 401 }
    const result = toError(authErr)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('JWT expired')
  })
})
