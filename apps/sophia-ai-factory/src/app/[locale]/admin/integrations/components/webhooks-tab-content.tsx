import React from 'react';
import type { WebhookSubscription } from '@/tree/integrations/types';
import type { TestPingState } from './types';
import { WebhookRegisterForm } from './webhook-register-form';
import { WebhookSubscriptionsList } from './webhook-subscriptions-list';

interface WebhooksTabContentProps {
  isVi: boolean;
  isPending: boolean;
  subscriptions: WebhookSubscription[];
  newSubUrl: string;
  setNewSubUrl: (val: string) => void;
  newSubSecret: string;
  setNewSubSecret: (val: string) => void;
  newSubDesc: string;
  setNewSubDesc: (val: string) => void;
  selectedEvents: string[];
  setSelectedEvents: (events: string[]) => void;
  testResult: Record<string, TestPingState>;
  onTestPing: (subId: string, url: string, secret: string) => void;
  onCreateSubscription: () => void;
}

export function WebhooksTabContent({
  isVi,
  isPending,
  subscriptions,
  newSubUrl,
  setNewSubUrl,
  newSubSecret,
  setNewSubSecret,
  newSubDesc,
  setNewSubDesc,
  selectedEvents,
  setSelectedEvents,
  testResult,
  onTestPing,
  onCreateSubscription,
}: WebhooksTabContentProps) {
  return (
    <div className="space-y-6">
      <WebhookRegisterForm
        isVi={isVi}
        isPending={isPending}
        newSubUrl={newSubUrl}
        setNewSubUrl={setNewSubUrl}
        newSubSecret={newSubSecret}
        setNewSubSecret={setNewSubSecret}
        newSubDesc={newSubDesc}
        setNewSubDesc={setNewSubDesc}
        selectedEvents={selectedEvents}
        setSelectedEvents={setSelectedEvents}
        onCreateSubscription={onCreateSubscription}
      />

      <WebhookSubscriptionsList
        isVi={isVi}
        isPending={isPending}
        subscriptions={subscriptions}
        testResult={testResult}
        onTestPing={onTestPing}
      />
    </div>
  );
}
