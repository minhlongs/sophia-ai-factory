'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { User, Bell, Lock, CreditCard, Globe, Trash2 } from 'lucide-react';
import { DashboardLayout, Card, CardHeader, CardContent, Button, Input, Badge } from '@/components/stitch';

const navItems = [
  { id: 'profile', labelKey: 'nav.profile', icon: User },
  { id: 'notifications', labelKey: 'nav.notifications', icon: Bell },
  { id: 'security', labelKey: 'nav.security', icon: Lock },
  { id: 'billing', labelKey: 'nav.billing', icon: CreditCard },
  { id: 'integrations', labelKey: 'nav.integrations', icon: Globe },
];

export default function SettingsPage() {
  const t = useTranslations('stitch.settings');
  const [activeTab, setActiveTab] = React.useState('profile');

  return (
    <DashboardLayout
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-xl">
        {/* Sidebar */}
        <Card className="lg:col-span-1" padding="none">
          <div className="p-md">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`
                  w-full flex items-center gap-md px-md py-sm rounded-xl mb-xs
                  font-body-md text-body-md transition-all duration-200
                  ${activeTab === item.id
                    ? 'bg-secondary-container text-on-secondary-container font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-low'}
                `}
              >
                <item.icon className="w-5 h-5" />
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('profile.title')}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t('profile.description')}
                </p>
              </CardHeader>
              <CardContent className="space-y-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                  <div className="space-y-sm">
                    <label className="font-label-md text-label-md text-on-surface">{t('profile.workspaceName')}</label>
                    <Input defaultValue="OPC Platform" />
                  </div>
                  <div className="space-y-sm">
                    <label className="font-label-md text-label-md text-on-surface">{t('profile.timezone')}</label>
                    <select className="w-full py-md px-md bg-surface border border-outline-variant rounded-xl font-body-md text-body-md">
                      <option>UTC-8 (Pacific Time)</option>
                      <option>UTC-5 (Eastern Time)</option>
                      <option>UTC+0 (GMT)</option>
                      <option>UTC+1 (Central Europe)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">{t('profile.descriptionLabel')}</label>
                  <textarea
                    className="w-full py-md px-md bg-surface border border-outline-variant rounded-xl font-body-md text-body-md resize-none h-24"
                    placeholder={t('profile.descriptionPlaceholder')}
                  />
                </div>
                <div className="pt-md border-t border-outline-variant flex justify-end">
                  <Button>{t('profile.saveChanges')}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('notifications.title')}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t('notifications.description')}
                </p>
              </CardHeader>
              <CardContent className="space-y-lg">
                {[
                  { key: 'paymentReceived', labelKey: 'notifications.items.paymentReceived.label', descKey: 'notifications.items.paymentReceived.description', enabled: true },
                  { key: 'newSubscriber', labelKey: 'notifications.items.newSubscriber.label', descKey: 'notifications.items.newSubscriber.description', enabled: true },
                  { key: 'affiliateCommission', labelKey: 'notifications.items.affiliateCommission.label', descKey: 'notifications.items.affiliateCommission.description', enabled: false },
                  { key: 'weeklyDigest', labelKey: 'notifications.items.weeklyDigest.label', descKey: 'notifications.items.weeklyDigest.description', enabled: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <p className="font-label-md text-on-surface">{t(item.labelKey)}</p>
                      <p className="text-sm text-on-surface-variant">{t(item.descKey)}</p>
                    </div>
                    <button
                      className={`
                        w-12 h-6 rounded-full transition-colors duration-300
                        ${item.enabled ? 'bg-primary' : 'bg-surface-container-high'}
                      `}
                    >
                      <span
                        className={`
                          inline-block w-4 h-4 bg-white rounded-full transition-transform duration-300 mt-1
                          ${item.enabled ? 'translate-x-7' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('security.title')}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t('security.description')}
                </p>
              </CardHeader>
              <CardContent className="space-y-lg">
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">{t('security.currentPassword')}</label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">{t('security.newPassword')}</label>
                  <Input type="password" placeholder={t('security.newPassword')} />
                </div>
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">{t('security.confirmPassword')}</label>
                  <Input type="password" placeholder={t('security.confirmPassword')} />
                </div>
                <div className="pt-md border-t border-outline-variant flex justify-between items-center">
                  <div>
                    <p className="font-label-md text-on-surface">{t('security.twoFactor.title')}</p>
                    <p className="text-sm text-on-surface-variant">{t('security.twoFactor.description')}</p>
                  </div>
                  <Button variant="outline">{t('security.enable')}</Button>
                </div>
                <div className="pt-md border-t border-outline-variant flex justify-end">
                  <Button>{t('security.updatePassword')}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'billing' && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('billing.title')}</h3>
              </CardHeader>
              <CardContent>
                <div className="bg-surface-container-low rounded-xl p-lg mb-lg">
                  <div className="flex items-center justify-between mb-md">
                    <div>
                      <p className="font-label-md text-label-md text-on-surface-variant">{t('billing.currentPlan')}</p>
                      <p className="font-headline-md text-headline-md text-on-surface">{t('billing.planName')}</p>
                    </div>
                    <Button variant="outline">{t('billing.changePlan')}</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-label-md text-label-md text-on-surface-variant">{t('billing.nextBilling')}</p>
                      <p className="font-body-md text-body-md text-on-surface">{t('billing.nextBillingValue')}</p>
                    </div>
                    <Badge variant="soft" color="success">{t('billing.active')}</Badge>
                  </div>
                </div>
                <h4 className="font-label-md text-label-md text-on-surface mb-md">{t('billing.recentInvoices')}</h4>
                <div className="space-y-sm">
                  {['Oct 2023 - $79', 'Sep 2023 - $79', 'Aug 2023 - $79'].map((invoice, idx) => {
                    const [month, amount] = invoice.split(' - ');
                    return (
                      <div key={idx} className="flex items-center justify-between p-md bg-surface rounded-xl">
                        <span className="font-body-md text-on-surface">{t('billing.invoice', { month, amount })}</span>
                        <Button variant="ghost" size="sm">{t('billing.download')}</Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'integrations' && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('integrations.title')}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t('integrations.description')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                  {[
                    { key: 'slack', connected: true },
                    { key: 'zapier', connected: false },
                    { key: 'webhooks', connected: true },
                    { key: 'googleAnalytics', connected: false },
                  ].map((integration) => (
                    <Card key={integration.key} padding="lg" hoverable>
                      <CardHeader className="!p-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-label-lg text-on-surface">{t(`integrations.cards.${integration.key}.name`)}</h4>
                          <Badge variant={integration.connected ? 'soft' : 'outline'} color={integration.connected ? 'success' : 'neutral'}>
                            {t(`integrations.cards.${integration.key}.${integration.connected ? 'connected' : 'notConnected'}`)}
                          </Badge>
                        </div>
                        <p className="text-sm text-on-surface-variant mt-xs">{t(`integrations.cards.${integration.key}.description`)}</p>
                      </CardHeader>
                      <CardContent className="!p-0 mt-lg">
                        <Button variant={integration.connected ? 'outline' : 'primary'} fullWidth size="sm">
                          {t(`integrations.cards.${integration.key}.${integration.connected ? 'manage' : 'connect'}`)}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
