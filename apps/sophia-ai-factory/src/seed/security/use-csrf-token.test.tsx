import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { getCsrfHeaders, useCsrfToken } from './use-csrf-token';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf';

describe('use-csrf-token & getCsrfHeaders', () => {
  beforeEach(() => {
    document.cookie = `${CSRF_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });

  it('returns empty object when csrf cookie is absent', () => {
    expect(getCsrfHeaders()).toEqual({});
    const { result } = renderHook(() => useCsrfToken());
    expect(result.current).toEqual({});
  });

  it('reads csrf-token cookie accurately even alongside other cookies', () => {
    document.cookie = 'locale=vi; path=/';
    document.cookie = `${CSRF_COOKIE_NAME}=tok_abc_123==; path=/`;
    expect(getCsrfHeaders()).toEqual({ [CSRF_HEADER_NAME]: 'tok_abc_123==' });
    const { result } = renderHook(() => useCsrfToken());
    expect(result.current).toEqual({ [CSRF_HEADER_NAME]: 'tok_abc_123==' });
  });
});
