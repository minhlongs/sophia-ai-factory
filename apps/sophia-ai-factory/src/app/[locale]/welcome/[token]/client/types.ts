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

export interface TelegramCtaProps {
  telegramLinked: boolean;
  telegramLinking: boolean;
  onConnectTelegram: () => void;
}

export interface InvalidLinkViewProps {
  locale: string;
  message: string | null;
}
