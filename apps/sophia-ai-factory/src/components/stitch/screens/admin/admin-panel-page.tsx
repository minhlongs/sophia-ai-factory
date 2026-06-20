'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3, Users, DollarSign, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardHeader, CardContent, Badge, Button } from '@/components/stitch';

const platformStats = [
  { key: 'revenue', value: '$1.2M', change: '+15%', trend: 'up' },
  { key: 'users', value: '12,450', change: '+8%', trend: 'up' },
  { key: 'apiCalls', value: '2.1M', change: '+22%', trend: 'up' },
  { key: 'responseTime', value: '45ms', change: '-12%', trend: 'down' },
];

const systemHealth = [
  { key: 'database', status: 'healthy', latency: '12ms' },
  { key: 'workers', status: 'healthy', latency: '45ms' },
  { key: 'storage', status: 'healthy', latency: '23ms' },
  { key: 'nowPayments', status: 'degraded', latency: '180ms' },
];

const quickActionItems = [
  { key: 'viewLogs', icon: Activity },
  { key: 'runAnalytics', icon: TrendingUp },
  { key: 'manageUsers', icon: Users },
  { key: 'viewAlerts', icon: AlertTriangle },
];

const recentActivity = [
  { eventKey: 'newUserRegistration', time: '2 min ago', details: 'john@acme.com signed up' },
  { eventKey: 'paymentReceived', time: '5 min ago', details: '$99.00 from maria@tech.io' },
  { eventKey: 'webhookDelivered', time: '12 min ago', details: 'payment.succeeded to 3 endpoints' },
  { eventKey: 'systemAlert', time: '18 min ago', details: 'High CPU usage on worker-04 resolved' },
  { eventKey: 'backupCompleted', time: '25 min ago', details: 'D1 database backup uploaded to R2' },
];

export default function AdminPanelPage() {
  const t = useTranslations('stitch.admin');
  return (
    <div className="min-h-screen bg-background p-lg">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-xl">
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-sm">
            {t('title')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t('subtitle')}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md mb-xl">
          {platformStats.map((stat, idx) => (
            <Card key={idx} padding="md">
              <div className="flex items-start justify-between">
                <div className="p-sm bg-secondary-container rounded-xl text-secondary">
                  {idx === 0 && <DollarSign className="w-5 h-5" />}
                  {idx === 1 && <Users className="w-5 h-5" />}
                  {idx === 2 && <BarChart3 className="w-5 h-5" />}
                  {idx === 3 && <Activity className="w-5 h-5" />}
                </div>
                <Badge variant="soft" color={stat.trend === 'up' ? 'success' : 'error'}>
                  {stat.change}
                </Badge>
              </div>
              <p className="font-label-md text-label-md text-on-surface-variant mt-md mb-xs">
                {t(`stats.${stat.key}`)}
              </p>
              <h3 className="font-headline-md text-headline-md text-on-surface">{stat.value}</h3>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl mb-xl">
          {/* System Health */}
          <Card padding="lg">
            <CardHeader>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('systemHealth.title')}</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-md">
                {systemHealth.map((sys) => (
                  <div key={sys.key} className="flex items-center justify-between">
                    <div>
                      <p className="font-label-md text-on-surface">{t(`systemHealth.${sys.key}`)}</p>
                      <p className="text-sm text-on-surface-variant">{t('latency', { latency: sys.latency })}</p>
                    </div>
                    <Badge variant="soft" color={sys.status === 'healthy' ? 'success' : 'warning'}>
                      {t(`status.${sys.status}`)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card padding="lg">
            <CardHeader>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('quickActions.title')}</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-sm">
                {quickActionItems.map((action) => (
                  <Button key={action.key} variant="outline" className="h-20 flex-col">
                    <action.icon className="w-6 h-6 mb-sm" />
                    {t(`quickActions.${action.key}`)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{t('recentActivity.title')}</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-md">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-md pb-md border-b border-outline-variant last:border-0 last:pb-0">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-label-md text-on-surface">{t(`recentActivity.events.${activity.eventKey}`)}</p>
                      <span className="text-xs text-on-surface-variant">{activity.time}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-xs">{activity.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
