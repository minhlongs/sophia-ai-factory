# Research: Telegraf AbortController Compatibility

## Findings
- Telegraf 4.x `sendMessage` API: `bot.telegram.sendMessage(chatId, text, options?)`
- `options` accepts Telegraf-specific Markup options, NOT native Telegram API `signal` param
- TS errors confirmed: property `signal` does not exist on Telegraf SendMessageOptions type
- No AbortController support in the wrapper layer

## Verdict
- AbortController approach incompatible without upgrading Telegraf or forking
- Alternative: reduce payload size (truncation + row limit)
