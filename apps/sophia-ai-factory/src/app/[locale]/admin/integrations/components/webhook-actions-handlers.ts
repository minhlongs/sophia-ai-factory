'use client';

import type { TransitionStartFunction } from 'react';
import type { WebhookSubscription } from '@/tree/integrations/types';
import { subscribeWebhook, testWebhookEndpointAction } from '@/land/integrations/integration-actions';
import type { StatusMessage, TestPingState } from './types';

interface WebhookHandlersContext {
  tenantId: string;
  isVi: boolean;
  newSubUrl: string;
  setNewSubUrl: (v: string) => void;
  newSubSecret: string;
  setNewSubSecret: (v: string) => void;
  newSubDesc: string;
  setNewSubDesc: (v: string) => void;
  selectedEvents: string[];
  startTransition: TransitionStartFunction;
  setSubscriptions: React.Dispatch<React.SetStateAction<WebhookSubscription[]>>;
  setTestResult: React.Dispatch<React.SetStateAction<Record<string, TestPingState>>>;
  setStatusMessage: (msg: StatusMessage | null) => void;
}

export function createWebhookHandlers(ctx: WebhookHandlersContext) {
  const handleTestPing = (subId: string, url: string, secret: string) => {
    ctx.startTransition(async () => {
      ctx.setTestResult((prev) => ({ ...prev, [subId]: { status: 'testing' } }));
      const res = await testWebhookEndpointAction(url, secret);
      if (res.success) {
        ctx.setTestResult((prev) => ({
          ...prev,
          [subId]: { status: 'success', http: res.data?.httpStatus || 200 },
        }));
        ctx.setStatusMessage({
          type: 'success',
          text: ctx.isVi
            ? `Ping thành công tới ${url} (HTTP ${res.data?.httpStatus || 200})`
            : `Ping succeeded to ${url} (HTTP ${res.data?.httpStatus || 200})`,
        });
      } else {
        ctx.setTestResult((prev) => ({
          ...prev,
          [subId]: { status: 'error', http: 500 },
        }));
        ctx.setStatusMessage({
          type: 'error',
          text: ctx.isVi
            ? `Thất bại khi gửi ping tới ${url}: ${res.error}`
            : `Failed ping to ${url}: ${res.error}`,
        });
      }
    });
  };

  const handleCreateSubscription = () => {
    if (!ctx.newSubUrl.startsWith('http')) {
      ctx.setStatusMessage({
        type: 'error',
        text: ctx.isVi ? 'URL Webhook không hợp lệ' : 'Invalid webhook URL',
      });
      return;
    }

    ctx.startTransition(async () => {
      ctx.setStatusMessage(null);
      const generatedSecret = ctx.newSubSecret || `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
      const res = await subscribeWebhook(
        ctx.tenantId,
        ctx.newSubUrl,
        generatedSecret,
        ctx.selectedEvents,
        ctx.newSubDesc
      );

      if (res.success && res.data) {
        ctx.setSubscriptions((prev) => [res.data!, ...prev]);
        ctx.setNewSubUrl('');
        ctx.setNewSubSecret('');
        ctx.setNewSubDesc('');
        ctx.setStatusMessage({
          type: 'success',
          text: ctx.isVi
            ? 'Đã tạo đăng ký Webhook mới thành công'
            : 'Successfully registered new webhook subscription',
        });
      } else {
        ctx.setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to subscribe webhook',
        });
      }
    });
  };

  return { handleTestPing, handleCreateSubscription };
}
