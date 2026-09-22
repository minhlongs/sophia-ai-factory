import { describe, it, expect } from 'vitest';
import {
  buildNicheSelectionKeyboard,
  buildBudgetSelectionKeyboard,
  buildDemoActionKeyboard,
  buildGreetingKeyboard,
  buildCheckoutKeyboard,
} from '../telegram-lead-keyboards';

describe('telegram-lead-keyboards', () => {
  it('builds niche selection keyboard with 4 primary options', () => {
    const keyboard = buildNicheSelectionKeyboard();
    expect(keyboard.inline_keyboard).toHaveLength(2);

    const buttons = keyboard.inline_keyboard.flat();
    expect(buttons).toHaveLength(4);

    const callbacks = buttons.map((b) => b.callback_data);
    expect(callbacks).toContain('lead_niche:ai_agency');
    expect(callbacks).toContain('lead_niche:ecommerce');
    expect(callbacks).toContain('lead_niche:solopreneur');
    expect(callbacks).toContain('lead_niche:other');
  });

  it('builds budget selection keyboard with 3 tier options', () => {
    const keyboard = buildBudgetSelectionKeyboard();
    expect(keyboard.inline_keyboard).toHaveLength(3);

    const callbacks = keyboard.inline_keyboard.flat().map((b) => b.callback_data);
    expect(callbacks).toContain('lead_budget:low');
    expect(callbacks).toContain('lead_budget:mid');
    expect(callbacks).toContain('lead_budget:high');
  });

  it('builds demo action keyboard with required CTA buttons', () => {
    const videoUrl = 'https://assets.agencyos.network/demos/demo_ecommerce.mp4';
    const keyboard = buildDemoActionKeyboard(videoUrl);

    const buttons = keyboard.inline_keyboard.flat();
    const texts = buttons.map((b) => b.text);

    expect(texts.some((t) => t.includes('Watch Sample Video Demo'))).toBe(true);
    expect(texts.some((t) => t.includes('Get Starter ($99) - SOLO100'))).toBe(true);
    expect(texts.some((t) => t.includes('Pay with VietQR'))).toBe(true);
    expect(texts.some((t) => t.includes('Pay with USDT'))).toBe(true);
    expect(texts.some((t) => t.includes('Chat with Founder'))).toBe(true);
  });

  it('builds greeting keyboard with survey and demo triggers', () => {
    const keyboard = buildGreetingKeyboard();
    const callbacks = keyboard.inline_keyboard.flat().map((b) => b.callback_data);

    expect(callbacks).toContain('lead_action:start_survey');
    expect(callbacks).toContain('lead_action:watch_demo');
    expect(callbacks).toContain('lead_action:get_starter');
  });

  it('builds checkout keyboard with provided payment links', () => {
    const keyboard = buildCheckoutKeyboard({
      nowpaymentsUrl: 'https://nowpayments.io/payment/?iid=123',
      payosUrl: 'https://pay.payos.vn/web/456',
      founderUsername: 'minhlongdo',
    });

    const buttons = keyboard.inline_keyboard.flat();
    const urls = buttons.map((b) => b.url).filter(Boolean);

    expect(urls).toContain('https://pay.payos.vn/web/456');
    expect(urls).toContain('https://nowpayments.io/payment/?iid=123');
    expect(urls).toContain('https://t.me/minhlongdo');
  });
});
