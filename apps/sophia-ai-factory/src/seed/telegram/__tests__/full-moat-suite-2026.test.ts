/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { advanceConciergeFunnel } from '../concierge-funnel-fsm';
import { renderCarouselSlideSvg } from '@/seed/video/carousel-svg-builder';

describe('Sophia Full Moat Suite 2026 (Hub, Concierge FSM, Edge Carousel SVG)', () => {
  it('walks Telegram Concierge FSM from welcome -> vertical -> jurisdiction -> compliant shortlink', () => {
    const step1 = advanceConciergeFunnel(
      { step: 'welcome' },
      'start',
      'https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/demo',
    );
    expect(step1.nextState.step).toBe('choose_vertical');
    expect(step1.buttons).toHaveLength(2);

    const step2 = advanceConciergeFunnel(
      step1.nextState,
      'vertical:crypto',
      'https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/demo',
    );
    expect(step2.nextState.step).toBe('choose_jurisdiction');

    const step3 = advanceConciergeFunnel(
      step2.nextState,
      'jur:VN',
      'https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/demo',
    );
    expect(step3.nextState.step).toBe('offer_ready');
    expect(step3.messageText).toContain('/api/r/demo');
    expect(step3.messageText).toContain('#QuảngCáo');
  });

  it('renders valid XML-escaped 1080x1350 carousel SVG slide at 0ms', () => {
    const svg = renderCarouselSlideSvg({
      slideNumber: 2,
      totalSlides: 5,
      headline: 'Bybit & OKX <2026> Fee Guide',
      body: 'Save 30% on maker/taker fees.',
      footerUrl: 'sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/abc123',
      disclosureTag: '#ad',
    });
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('SLIDE 2 / 5');
    expect(svg).toContain('Bybit &amp; OKX &lt;2026&gt; Fee Guide');
    expect(svg).toContain('/api/r/abc123');
  });
});
