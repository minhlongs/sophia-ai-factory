"use client";

/**
 * AccountTabs — wraps the 3 account tabs in a shadcn Tabs component.
 */

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountProfileTab } from './account-profile-tab';
import { AccountSubscriptionTab } from './account-subscription-tab';
import { AccountBillingTab } from './account-billing-tab';

interface AccountTabsProps {
  profileData: {
    email: string;
    display_name: string;
    locale: string;
    timezone: string;
  };
  tier: string;
  tierLabel: string;
  tierFeatures: string[];
}

export function AccountTabs({ profileData, tier, tierLabel, tierFeatures }: AccountTabsProps) {
  const t = useTranslations('account');

  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm">
        <TabsTrigger value="profile" className="cursor-pointer">{t('tab_profile')}</TabsTrigger>
        <TabsTrigger value="subscription" className="cursor-pointer">{t('tab_subscription')}</TabsTrigger>
        <TabsTrigger value="billing" className="cursor-pointer">{t('tab_billing')}</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <AccountProfileTab initial={profileData} />
      </TabsContent>

      <TabsContent value="subscription">
        <AccountSubscriptionTab
          tier={tier}
          tierLabel={tierLabel}
          features={tierFeatures}
        />
      </TabsContent>

      <TabsContent value="billing">
        <AccountBillingTab />
      </TabsContent>
    </Tabs>
  );
}
