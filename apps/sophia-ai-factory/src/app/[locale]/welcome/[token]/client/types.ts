import type { WelcomeData, OnboardingStep } from '../welcome-onboarding-steps';

export type { WelcomeData, OnboardingStep };

export interface WelcomePageClientProps {
  token: string;
  locale: string;
}

export interface WelcomeHeroProps {
  agencyName: string;
  tier: string;
  started: boolean;
  onGetStarted: () => void;
}

/**
 * Telegram pairing state.
 *
 * `linked` is only reachable once the server confirms the pairing, so an opened
 * tab never shows as a completed connection.
 */
export type TelegramPairingState =
  | 'idle'
  | 'linking'
  | 'awaiting_pairing'
  | 'linked';

export interface TelegramCtaProps {
  telegramPairingState: TelegramPairingState;
  onConnectTelegram: () => void;
  onCheckPairing: () => void;
}

export interface InvalidLinkViewProps {
  locale: string;
  message: string | null;
}
