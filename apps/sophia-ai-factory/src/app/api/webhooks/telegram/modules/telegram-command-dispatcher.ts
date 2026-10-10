import {
  handleStart,
  handleHelp,
  handleEmail,
  handleStatus,
  handleResults,
  handleSubscribe,
  handleDiscover,
  handleCampaignList,
  handleCampaignCancel,
  handleAnalytics,
  handlePayout,
} from '@/tree/telegram/telegram-command-handlers';
import {
  handleCampaign as handleCampaignFsm,
  handleConfirmCommand,
} from '@/tree/telegram/telegram-bot-campaign-handlers';
import { TelegramFSM } from '@/tree/telegram/telegram-fsm-state-manager';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { handleNicheVideoTelegramCommand } from '@/tree/telegram/niche-video-telegram-handler';

export async function dispatchTelegramCommand(chatId: string, text: string): Promise<void> {
  if (text === '/start' || text.startsWith('/start ')) {
    await handleStart(chatId);
  } else if (text === '/help') {
    await handleHelp(chatId);
  } else if (text === '/subscribe') {
    await handleSubscribe(chatId);
  } else if (text === '/discover') {
    await handleDiscover(chatId);
  } else if (text.startsWith('/email')) {
    const email = text.replace('/email', '').trim();
    await handleEmail(chatId, email);
  } else if (text.startsWith('/campaign')) {
    const arg = text.replace('/campaign', '').trim();
    if (arg === 'list') {
      await handleCampaignList(chatId);
    } else if (arg.startsWith('cancel ')) {
      const id = arg.replace('cancel ', '').trim();
      await handleCampaignCancel(chatId, id);
    } else if (arg === 'cancel') {
      await sendTelegramMessage(
        chatId,
        '⚠️ Usage: /campaign cancel <campaign_id>\n\nGet campaign IDs with: /campaign list',
      );
    } else {
      await handleCampaignFsm(chatId, arg);
    }
  } else if (text === '/confirm') {
    await handleConfirmCommand(chatId);
  } else if (text === '/cancel') {
    await TelegramFSM.clearContext(chatId);
  } else if (
    text.startsWith('/niche_video') ||
    text.startsWith('/saas_video') ||
    text.startsWith('/crypto_video')
  ) {
    const parts = text.split(' ');
    const cmd = parts[0];
    const args = text.slice(cmd.length).trim();
    await handleNicheVideoTelegramCommand(chatId, cmd, args, `tg_${chatId}`);
  } else if (text === '/status' || text.startsWith('/status ')) {
    const arg = text.slice(7).trim();
    await handleStatus(chatId, arg || undefined);
  } else if (text === '/analytics') {
    await handleAnalytics(chatId);
  } else if (text === '/payout' || text.startsWith('/payout ')) {
    await handlePayout(chatId);
  } else if (text === '/results') {
    await handleResults(chatId);
  }
}
