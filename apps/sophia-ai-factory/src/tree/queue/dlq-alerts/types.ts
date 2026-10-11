/**
 * Result returned by the alert dispatcher
 */
export interface DlqAlertDispatchResult {
  jobId: string;
  telegramSent: boolean;
  webhookSent: boolean;
  loggedFallback: boolean;
  errors?: string[];
}

/**
 * Dispatcher configuration overrides
 */
export interface AlertDispatcherConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
  incidentWebhookUrl?: string;
}
