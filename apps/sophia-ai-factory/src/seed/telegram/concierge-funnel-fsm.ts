/**
 * Edge-Native Telegram Concierge Affiliate Funnel FSM.
 *
 * Clean-room state machine (MIT pattern from grammY + xstate) running on
 * Cloudflare Workers with zero Durable Objects / zero operator AI COGS:
 * qualifies Crypto/SaaS buyers by vertical + jurisdiction and returns a
 * policy-compliant /api/r/[code] recommendation with mandatory disclosure.
 *
 * Layer: seed/telegram (pure deterministic state machine)
 *
 * @module seed/telegram/concierge-funnel-fsm
 */

import {
  runPolicyPreflight,
  type ComplianceJurisdiction,
  type ComplianceVertical,
} from '@/seed/compliance/policy-preflight-engine';

export type ConciergeStep = 'welcome' | 'choose_vertical' | 'choose_jurisdiction' | 'offer_ready';

export interface ConciergeState {
  readonly step: ConciergeStep;
  readonly vertical?: ComplianceVertical;
  readonly jurisdiction?: ComplianceJurisdiction;
}

export interface ConciergeReply {
  readonly nextState: ConciergeState;
  readonly messageText: string;
  readonly buttons: ReadonlyArray<{ readonly label: string; readonly callbackData: string }>;
}

export function advanceConciergeFunnel(
  state: ConciergeState,
  callbackData: string,
  shortUrl: string,
): ConciergeReply {
  if (callbackData === 'start' || state.step === 'welcome') {
    return {
      nextState: { step: 'choose_vertical' },
      messageText: 'Chọn lĩnh vực bạn muốn nhận kèo & công cụ tốt nhất:',
      buttons: [
        { label: '⚡ Crypto / CEX Hoàn Phí', callbackData: 'vertical:crypto' },
        { label: '💼 Global SaaS AI Tools', callbackData: 'vertical:saas' },
      ],
    };
  }

  if (callbackData.startsWith('vertical:')) {
    const vertical = callbackData.endsWith('saas') ? 'saas' : 'crypto';
    return {
      nextState: { step: 'choose_jurisdiction', vertical },
      messageText: 'Bạn đang hoạt động ở khu vực nào (để áp dụng đúng luật hiển thị)?',
      buttons: [
        { label: '🇻🇳 Vietnam (VN)', callbackData: 'jur:VN' },
        { label: '🇺🇸 US / Global', callbackData: 'jur:US' },
        { label: '🇪🇺 EU (MiCA)', callbackData: 'jur:EU' },
      ],
    };
  }

  if (callbackData.startsWith('jur:')) {
    const rawJur = callbackData.slice(4).toUpperCase();
    const jurisdiction: ComplianceJurisdiction =
      rawJur === 'VN' || rawJur === 'US' || rawJur === 'UK' || rawJur === 'EU' || rawJur === 'SG'
        ? rawJur
        : 'GLOBAL';
    const vertical: ComplianceVertical = state.vertical ?? 'crypto';
    const preflight = runPolicyPreflight({
      text: `Gợi ý công cụ ${vertical.toUpperCase()} phù hợp nhất cho khu vực ${jurisdiction}.`,
      jurisdiction,
      vertical,
    });

    return {
      nextState: { step: 'offer_ready', vertical, jurisdiction },
      messageText: `${preflight.sanitizedText}\n\n🔗 ${shortUrl}\n${preflight.requiredDisclosure}`,
      buttons: [{ label: '🔄 Chọn lại', callbackData: 'start' }],
    };
  }

  return advanceConciergeFunnel({ step: 'welcome' }, 'start', shortUrl);
}
