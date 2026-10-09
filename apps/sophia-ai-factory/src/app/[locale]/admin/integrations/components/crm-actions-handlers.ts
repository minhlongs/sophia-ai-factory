'use client';

import type { TransitionStartFunction } from 'react';
import type { EnterpriseCrmConfig, CrmSyncEvent, CrmProvider } from '@/tree/integrations/types';
import { configureCrm, triggerCrmSync } from '@/land/integrations/integration-actions';
import type { StatusMessage } from './types';

interface CrmHandlersContext {
  tenantId: string;
  isVi: boolean;
  selectedProvider: CrmProvider;
  crmEndpoint: string;
  crmClientId: string;
  syncDirection: 'bidirectional' | 'inbound' | 'outbound';
  startTransition: TransitionStartFunction;
  setConfigs: React.Dispatch<React.SetStateAction<EnterpriseCrmConfig[]>>;
  setSyncEvents: React.Dispatch<React.SetStateAction<CrmSyncEvent[]>>;
  setStatusMessage: (msg: StatusMessage | null) => void;
}

export function createCrmHandlers(ctx: CrmHandlersContext) {
  const handleSaveCrmConfig = () => {
    ctx.startTransition(async () => {
      ctx.setStatusMessage(null);
      const res = await configureCrm({
        tenantId: ctx.tenantId,
        provider: ctx.selectedProvider,
        apiEndpoint: ctx.crmEndpoint || null,
        clientId: ctx.crmClientId || null,
        syncDirection: ctx.syncDirection,
        isActive: true,
      });

      if (res.success && res.data) {
        const saved = res.data;
        ctx.setConfigs((prev) => {
          const index = prev.findIndex((c) => c.provider === saved.provider);
          if (index >= 0) {
            const next = [...prev];
            next[index] = saved;
            return next;
          }
          return [...prev, saved];
        });
        ctx.setStatusMessage({
          type: 'success',
          text: ctx.isVi
            ? `Đã lưu cấu hình kết nối ${ctx.selectedProvider.toUpperCase()}`
            : `Successfully configured ${ctx.selectedProvider.toUpperCase()} connector`,
        });
      } else {
        ctx.setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to save CRM config',
        });
      }
    });
  };

  const handleTriggerSync = (provider: CrmProvider) => {
    ctx.startTransition(async () => {
      ctx.setStatusMessage(null);
      const res = await triggerCrmSync(ctx.tenantId, provider, 'deal', 'test_deal_sample');
      if (res.success && res.data) {
        ctx.setSyncEvents((prev) => [res.data!, ...prev]);
        ctx.setStatusMessage({
          type: 'success',
          text: ctx.isVi
            ? `Đã kích hoạt đồng bộ ${provider.toUpperCase()}`
            : `Successfully triggered ${provider.toUpperCase()} sync event`,
        });
      } else {
        ctx.setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to trigger sync',
        });
      }
    });
  };

  return { handleSaveCrmConfig, handleTriggerSync };
}
