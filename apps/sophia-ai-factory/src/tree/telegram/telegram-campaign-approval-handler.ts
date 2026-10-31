/**
 * Telegram Campaign Approval Handler
 *
 * Implements CEO approval workflow via Telegram Inline Keyboard callbacks:
 * - `capprove:<approvalId>` -> calls `approveCampaignApprovalCAS`
 * - `creject:<approvalId>` -> calls `rejectCampaignApproval`
 *
 * Validates workspace ownership via `getUserWorkspaceIds` to prevent cross-tenant IDOR.
 * Concurrency-safe via Compare-And-Swap (CAS) on D1.
 *
 * Layer: tree/telegram (Domain Logic)
 * @module tree/telegram/telegram-campaign-approval-handler
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getUserWorkspaceIds, hasWorkspaceRole } from '@/seed/auth/workspace-access';
import { getUserByChatId } from '@/tree/telegram/user-mappings-service';
import {
  approveCampaignApprovalCAS,
  rejectCampaignApproval,
  type StoredCampaignApproval,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import { sendApprovalContinuation } from '@/tree/affiliate/approval/approval-continuation';
import { sendMessage, sendMessageWithKeyboard } from '@/tree/telegram/handlers/utils';
import {
  buildCampaignApprovalKeyboard,
  toReplyMarkup,
} from '@/tree/telegram/telegram-keyboard-builder';
import { escapeMarkdownV2 } from './format-markdown-v2';

export interface TelegramApprovalCallbackResult {
  ok: boolean;
  action: 'approve' | 'reject' | 'unknown';
  approvalId?: string;
  reason?: string;
}

export interface SendApprovalNotificationInput {
  chatId: string;
  approval: StoredCampaignApproval;
  productName?: string;
  affiliateUrl?: string;
  budgetUsd?: number;
  locale?: 'vi' | 'en';
}

/**
 * Dispatches campaign approval prompt with inline buttons to CEO via Telegram.
 */
export async function sendCampaignApprovalNotification(
  input: SendApprovalNotificationInput,
): Promise<boolean> {
  const { chatId, approval, productName, affiliateUrl, budgetUsd, locale = 'vi' } = input;
  const safeCamp = escapeMarkdownV2(approval.campaignId);
  const safeProd = escapeMarkdownV2(productName ?? approval.niche ?? 'Affiliate Video');
  const safeLink = affiliateUrl ? escapeMarkdownV2(affiliateUrl) : null;
  const budgetText = budgetUsd != null ? `$${budgetUsd.toFixed(2)}` : 'N/A';
  const safeBudget = escapeMarkdownV2(budgetText);
  const safeJurisdiction = escapeMarkdownV2(approval.jurisdiction ?? 'GLOBAL');

  let text: string;
  if (locale === 'en') {
    text = `📋 *CAMPAIGN APPROVAL REQUIRED*

🆔 *Campaign ID:* \`${safeCamp}\`
📦 *Product / Offer:* ${safeProd}
⚖️ *Jurisdiction:* ${safeJurisdiction}
💵 *Max Render Budget:* *${safeBudget}*`;
    if (safeLink) {
      text += `\n🔗 *Target Link:* ${safeLink}`;
    }
    text += `\n\n_Review the campaign details above. Tap below to approve or reject._`;
  } else {
    text = `📋 *YÊU CẦU PHÊ DUYỆT CHIẾN DỊCH AFFILIATE*

🆔 *Mã chiến dịch:* \`${safeCamp}\`
📦 *Sản phẩm:* ${safeProd}
⚖️ *Thị trường:* ${safeJurisdiction}
💵 *Ngân sách render tối đa:* *${safeBudget}*`;
    if (safeLink) {
      text += `\n🔗 *Link tiếp thị:* ${safeLink}`;
    }
    text += `\n\n_Vui lòng kiểm tra kỹ kịch bản & thông tin trên trước khi duyệt để hệ thống tiến hành sản xuất video._`;
  }

  const keyboard = buildCampaignApprovalKeyboard(approval.id, locale);
  try {
    await sendMessageWithKeyboard(chatId, text, toReplyMarkup(keyboard));
    logger.info('[sendCampaignApprovalNotification] Sent approval notification', {
      chatId,
      approvalId: approval.id,
      campaignId: approval.campaignId,
    });
    return true;
  } catch (error) {
    logger.warn('[sendCampaignApprovalNotification] Failed to send notification', {
      chatId,
      approvalId: approval.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

interface ExecuteDecisionInput {
  db: D1Database;
  chatId: string;
  isApprove: boolean;
  approvalId: string;
  row: { tenant_id: string; campaign_id: string; status: string };
  userId: string;
}

async function executeApprovalDecision(
  input: ExecuteDecisionInput,
): Promise<TelegramApprovalCallbackResult> {
  const { db, chatId, isApprove, approvalId, row, userId } = input;
  const action = isApprove ? 'approve' : 'reject';
  const resolveInput = {
    tenantId: row.tenant_id,
    approvalId,
    operatorId: `telegram:${chatId}:${userId}`,
    reason: isApprove ? 'Approved via Telegram Inline Button' : 'Rejected via Telegram Inline Button',
  };

  if (isApprove) {
    const result = await approveCampaignApprovalCAS(db, resolveInput);
    if (!result.ok) {
      if (result.error.code === 'APPROVAL_STATE_CONFLICT') {
        await sendMessage(
          chatId,
          `ℹ️ Chiến dịch này đã được xử lý trước đó (Trạng thái hiện tại: ${row.status}).\n\nThis campaign has already been resolved.`,
        );
      } else {
        await sendMessage(chatId, `⚠️ Không thể phê duyệt: ${result.error.message}`);
      }
      return { ok: false, action, approvalId, reason: result.error.message };
    }

    const continuation = await sendApprovalContinuation(db, row.tenant_id, result.value);
    if (!continuation.ok) {
      logger.warn('[TelegramApproval] Continuation send was blocked or deferred', {
        approvalId,
        tenantId: row.tenant_id,
        code: continuation.code,
        message: continuation.message,
      });
      await sendMessage(
        chatId,
        `⚠️ *ĐÃ GHI NHẬN PHÊ DUYỆT NHƯNG CHƯA THỂ KÍCH HOẠT TỰ ĐỘNG*\n\nLý do: ${continuation.message}\nVui lòng kiểm tra lại điều khoản chiến dịch trên Web dashboard.`,
      );
      return { ok: true, action, approvalId, reason: continuation.message };
    }

    await sendMessage(
      chatId,
      `✅ *ĐÃ PHÊ DUYỆT THÀNH CÔNG!*\n\nChiến dịch \`${row.campaign_id}\` đã được phê duyệt bởi CEO. Hệ thống Sophia AI Factory đang tiến hành sản xuất video tự động.\n\n_Campaign approved successfully. Agents are initiating video render._`,
    );
    return { ok: true, action, approvalId };
  }

  const rejectResult = await rejectCampaignApproval(db, resolveInput);
  if (!rejectResult.ok) {
    await sendMessage(chatId, `⚠️ Không thể từ chối: ${rejectResult.error.message}`);
    return { ok: false, action, approvalId, reason: rejectResult.error.message };
  }

  await sendMessage(
    chatId,
    `❌ *ĐÃ TỪ CHỐI CHIẾN DỊCH!*\n\nChiến dịch \`${row.campaign_id}\` đã bị hủy bỏ và sẽ không được sản xuất hay phân phối.\n\n_Campaign rejected. Render halted._`,
  );
  return { ok: true, action, approvalId };
}

/**
 * Handles Telegram callback query for campaign approvals (`capprove:<id>` or `creject:<id>`).
 */
export async function handleTelegramCampaignApprovalCallback(
  chatId: string,
  callbackData: string,
): Promise<TelegramApprovalCallbackResult> {
  const isApprove = callbackData.startsWith('capprove:');
  const isReject = callbackData.startsWith('creject:');

  if (!isApprove && !isReject) {
    return { ok: false, action: 'unknown', reason: 'Unrecognized callback prefix' };
  }

  const action = isApprove ? 'approve' : 'reject';
  const approvalId = callbackData.replace(isApprove ? 'capprove:' : 'creject:', '').trim();

  if (!approvalId) {
    await sendMessage(chatId, '❌ Mã phê duyệt không hợp lệ / Invalid approval ID.');
    return { ok: false, action, reason: 'Empty approval ID' };
  }

  const userId = await getUserByChatId(chatId);
  if (!userId) {
    await sendMessage(
      chatId,
      '⚠️ Tài khoản Telegram của bạn chưa được liên kết với Sophia. Vui lòng đăng nhập trên Web.\n\nYour Telegram account is not linked to Sophia. Please log in on the Web dashboard.',
    );
    return { ok: false, action, approvalId, reason: 'Unlinked telegram user' };
  }

  const db = await getD1();
  if (!db) {
    await sendMessage(chatId, '⚠️ Hệ thống đang bảo trì cơ sở dữ liệu. Vui lòng thử lại sau.');
    return { ok: false, action, approvalId, reason: 'D1 database binding unavailable' };
  }

  // Find tenant ID for this approval to enforce IDOR checks
  const row = await db
    .prepare('SELECT tenant_id, campaign_id, status FROM agent_campaign_approvals WHERE id = ? LIMIT 1')
    .bind(approvalId)
    .first<{ tenant_id: string; campaign_id: string; status: string }>();

  if (!row) {
    await sendMessage(chatId, `❌ Không tìm thấy yêu cầu phê duyệt ${approvalId}.`);
    return { ok: false, action, approvalId, reason: 'Approval not found' };
  }

  // IDOR & RBAC Protection: verify user belongs to workspace AND has ADMIN role
  const userWorkspaces = await getUserWorkspaceIds(userId, db);
  const isMember = userWorkspaces.includes(row.tenant_id) || row.tenant_id === userId;
  const isAdmin = isMember && (await hasWorkspaceRole(row.tenant_id, userId, 'ADMIN', db));

  if (!isMember || !isAdmin) {
    logger.warn('[TelegramApproval] Cross-tenant or non-admin access attempt blocked', {
      chatId,
      userId,
      approvalId,
      targetTenantId: row.tenant_id,
      userWorkspaces,
      isMember,
      isAdmin,
    });
    await sendMessage(
      chatId,
      '⛔ Bạn không có quyền quản trị viên (ADMIN) để phê duyệt chiến dịch của workspace này.',
    );
    return { ok: false, action, approvalId, reason: 'Cross-tenant access or non-admin forbidden' };
  }

  return executeApprovalDecision({ db, chatId, isApprove, approvalId, row, userId });
}
