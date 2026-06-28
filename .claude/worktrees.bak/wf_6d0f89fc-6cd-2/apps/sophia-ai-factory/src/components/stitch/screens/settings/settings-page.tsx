'use client';

import React from 'react';
import { User, Bell, Lock, CreditCard, Globe, Trash2 } from 'lucide-react';
import { DashboardLayout, Card, CardHeader, CardContent, Button, Input, Badge } from '@/components/stitch';

const navItems = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'integrations', label: 'Integrations', icon: Globe },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState('profile');

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your workspace preferences and configuration"
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
                {item.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Profile Settings</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Update your workspace information and preferences
                </p>
              </CardHeader>
              <CardContent className="space-y-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                  <div className="space-y-sm">
                    <label className="font-label-md text-label-md text-on-surface">Workspace Name</label>
                    <Input defaultValue="OPC Platform" />
                  </div>
                  <div className="space-y-sm">
                    <label className="font-label-md text-label-md text-on-surface">Timezone</label>
                    <select className="w-full py-md px-md bg-surface border border-outline-variant rounded-xl font-body-md text-body-md">
                      <option>UTC-8 (Pacific Time)</option>
                      <option>UTC-5 (Eastern Time)</option>
                      <option>UTC+0 (GMT)</option>
                      <option>UTC+1 (Central Europe)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">Description</label>
                  <textarea
                    className="w-full py-md px-md bg-surface border border-outline-variant rounded-xl font-body-md text-body-md resize-none h-24"
                    placeholder="Describe your workspace..."
                  />
                </div>
                <div className="pt-md border-t border-outline-variant flex justify-end">
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Notification Preferences</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Choose how and when you want to be notified
                </p>
              </CardHeader>
              <CardContent className="space-y-lg">
                {[
                  { label: 'Payment received', desc: 'Get notified when a payment is received', enabled: true },
                  { label: 'New subscriber', desc: 'Alert when someone subscribes', enabled: true },
                  { label: 'Affiliate commission', desc: 'Commission payout notifications', enabled: false },
                  { label: 'Weekly digest', desc: 'Summary of your activity every Monday', enabled: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <p className="font-label-md text-on-surface">{item.label}</p>
                      <p className="text-sm text-on-surface-variant">{item.desc}</p>
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
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Security</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Manage your password and security settings
                </p>
              </CardHeader>
              <CardContent className="space-y-lg">
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">Current Password</label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">New Password</label>
                  <Input type="password" placeholder="Enter new password" />
                </div>
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">Confirm Password</label>
                  <Input type="password" placeholder="Re-enter new password" />
                </div>
                <div className="pt-md border-t border-outline-variant flex justify-between items-center">
                  <div>
                    <p className="font-label-md text-on-surface">Two-Factor Authentication</p>
                    <p className="text-sm text-on-surface-variant">Add an extra layer of security</p>
                  </div>
                  <Button variant="outline">Enable</Button>
                </div>
                <div className="pt-md border-t border-outline-variant flex justify-end">
                  <Button>Update Password</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'billing' && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Billing & Invoices</h3>
              </CardHeader>
              <CardContent>
                <div className="bg-surface-container-low rounded-xl p-lg mb-lg">
                  <div className="flex items-center justify-between mb-md">
                    <div>
                      <p className="font-label-md text-label-md text-on-surface-variant">Current Plan</p>
                      <p className="font-headline-md text-headline-md text-on-surface">Professional</p>
                    </div>
                    <Button variant="outline">Change Plan</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-label-md text-label-md text-on-surface-variant">Next Billing</p>
                      <p className="font-body-md text-body-md text-on-surface">Nov 24, 2023 ($79)</p>
                    </div>
                    <Badge variant="soft" color="success">Active</Badge>
                  </div>
                </div>
                <h4 className="font-label-md text-label-md text-on-surface mb-md">Recent Invoices</h4>
                <div className="space-y-sm">
                  {['Oct 2023 - $79', 'Sep 2023 - $79', 'Aug 2023 - $79'].map((invoice, idx) => (
                    <div key={idx} className="flex items-center justify-between p-md bg-surface rounded-xl">
                      <span className="font-body-md text-on-surface">{invoice}</span>
                      <Button variant="ghost" size="sm">Download</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'integrations' && (
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Integrations</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Connect third-party services to enhance your workspace
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                  {[
                    { name: 'Slack', desc: 'Send notifications to Slack channels', connected: true },
                    { name: 'Zapier', desc: 'Automate workflows across apps', connected: false },
                    { name: 'Webhooks', desc: 'Receive real-time event data', connected: true },
                    { name: 'Google Analytics', desc: 'Track conversions and events', connected: false },
                  ].map((integration) => (
                    <Card key={integration.name} padding="lg" hoverable>
                      <CardHeader className="!p-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-label-lg text-on-surface">{integration.name}</h4>
                          <Badge variant={integration.connected ? 'soft' : 'outline'} color={integration.connected ? 'success' : 'neutral'}>
                            {integration.connected ? 'Connected' : 'Not Connected'}
                          </Badge>
                        </div>
                        <p className="text-sm text-on-surface-variant mt-xs">{integration.desc}</p>
                      </CardHeader>
                      <CardContent className="!p-0 mt-lg">
                        <Button variant={integration.connected ? 'outline' : 'primary'} fullWidth size="sm">
                          {integration.connected ? 'Manage' : 'Connect'}
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
