/**
 * Telegram Pairing State Tests
 *
 * Telegram is a protected flow, so this component must not claim it is done when
 * it is not. Opening the bot link in a tab is not a pairing: the customer still
 * has to send /start and the server has to record the chat id. The UI must show
 * a pending state until the server confirms, and a customer whose pairing failed
 * must still be able to retry.
 *
 * @module app/[locale]/welcome/[token]/client/__tests__/telegram-pairing-state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { TelegramCta } from '../telegram-cta';
import type { TelegramPairingState } from '../types';

const MESSAGES = {
  welcome: {
    telegram: {
      title: 'Connect Telegram',
      description: 'Get notifications + quick commands on Telegram.',
      connectButton: 'Open Telegram and connect',
      pairedHint: 'Telegram connected',
      awaitingPairingHint: 'Telegram is open. Press Start, then check.',
      checkPairingButton: 'Check connection',
    },
  },
};

function renderCta(state: TelegramPairingState) {
  return render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <TelegramCta
        telegramPairingState={state}
        onConnectTelegram={() => {}}
        onCheckPairing={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

describe('TelegramCta pairing state honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the connect action before pairing is attempted', () => {
    const { container } = renderCta('idle');
    expect(container.querySelector('[data-pairing-state]')?.getAttribute('data-pairing-state')).toBe('idle');
    expect(screen.getByRole('button', { name: /Open Telegram and connect/i })).toBeDefined();
    expect(screen.queryByText(/Telegram connected/i)).toBeNull();
  });

  it('never reports connected while the tab is merely open', () => {
    // The old behaviour set "linked" right after window.open(), which told a
    // customer a protected flow was finished when it was not.
    for (const state of ['idle', 'linking', 'awaiting_pairing'] as TelegramPairingState[]) {
      const { unmount } = renderCta(state);
      expect(screen.queryByText(/Telegram connected/i)).toBeNull();
      unmount();
    }
  });

  it('shows a pending state with instructions while awaiting the /start', () => {
    renderCta('awaiting_pairing');
    expect(screen.getByTestId('telegram-awaiting-hint').textContent).toContain('Press Start');
    expect(screen.getByRole('button', { name: /Check connection/i })).toBeDefined();
  });

  it('keeps the connect action available so a failed pairing can be retried', () => {
    renderCta('awaiting_pairing');
    expect(screen.getByRole('button', { name: /Open Telegram and connect/i })).toBeDefined();
  });

  it('reports connected only in the linked state', () => {
    renderCta('linked');
    expect(screen.getByText(/Telegram connected/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Open Telegram and connect/i })).toBeNull();
    expect(screen.queryByTestId('telegram-awaiting-hint')).toBeNull();
  });

  it('disables the connect action while the token is being generated', () => {
    renderCta('linking');
    expect(screen.getByRole('button', { name: /Open Telegram and connect/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: /Check connection/i })).toBeNull();
  });
});
