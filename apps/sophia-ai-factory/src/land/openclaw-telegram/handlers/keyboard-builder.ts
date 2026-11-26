export interface TelegramInlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineButton[][];
}

export function buildDashboardSettingsKeyboard(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        {
          text: '🔗 Connect Telegram',
          url: 'https://sophia-ai-factory.agencyos-openclaw.workers.dev/dashboard/settings',
        },
      ],
    ],
  };
}

export function buildAffiliateKeyboard(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        {
          text: '💼 Go to Affiliate Dashboard',
          url: 'https://sophia-ai-factory.agencyos-openclaw.workers.dev/dashboard/affiliate',
        },
      ],
    ],
  };
}

export function buildFree100Keyboard(magicLink: string): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        {
          text: '🚀 Launch Dashboard',
          url: magicLink,
        },
      ],
    ],
  };
}
