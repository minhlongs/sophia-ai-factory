export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramWebhookResult {
  ok: boolean;
  description?: string;
  [key: string]: unknown;
}

export interface TelegramMediaOptions {
  caption?: string;
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  reply_markup?: InlineKeyboardMarkup;
}

export interface TelegramVideoOptions extends TelegramMediaOptions {
  supports_streaming?: boolean;
}
