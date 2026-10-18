import React from 'react';
import { Link } from '@/navigation';

export interface RenderButtonLinkParams {
  href: string;
  classes: string;
  isDisabled: boolean;
  loading: boolean;
  content: React.ReactNode;
}

export function renderButtonLink(params: RenderButtonLinkParams) {
  const { href, classes, isDisabled, loading, content } = params;
  const isExternal = /^https?:\/\/|^mailto:|^tel:/.test(href);
  const ariaDisabled = isDisabled ? 'true' : undefined;
  const ariaBusy = loading ? 'true' : undefined;
  const tabIndex = isDisabled ? -1 : undefined;

  if (isExternal) {
    return (
      <a
        href={isDisabled ? undefined : href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={ariaDisabled}
        aria-busy={ariaBusy}
        tabIndex={tabIndex}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={isDisabled ? '#' : href}
      className={classes}
      aria-disabled={ariaDisabled}
      aria-busy={ariaBusy}
      tabIndex={tabIndex}
    >
      {content}
    </Link>
  );
}
