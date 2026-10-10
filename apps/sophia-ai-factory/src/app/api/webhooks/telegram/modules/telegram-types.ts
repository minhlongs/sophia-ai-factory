export interface TelegramUpdate {
  callback_query?: {
    data?: string;
    message?: { chat?: { id?: number | string } };
  };
  message?: {
    text?: string;
    chat?: { id?: number | string; first_name?: string };
    from?: { username?: string; first_name?: string; id?: number | string };
  };
}
