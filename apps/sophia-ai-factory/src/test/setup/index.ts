/**
 * Vitest environment setup orchestrator
 */

import * as React from 'react';
import { vi } from 'vitest';
import './storage-mocks';
import './headers-polyfill';
import './console-mocks';
import { NextResponseMock, configureNextResponse } from './next-response-mock';
import { MockNextRequest } from './request-mocks';

// Mock next/server
vi.mock('next/server', () => ({
  NextResponse: NextResponseMock,
  NextRequest: MockNextRequest,
}));

// Mock next/link
type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href?: string | (() => string);
  children?: React.ReactNode;
};

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: LinkProps) => {
    const h = typeof href === 'function' ? href() : href;
    return React.createElement('a', { href: h, ...props }, children);
  },
}));

export { configureNextResponse };
