'use client';

import React from 'react';
import { BarChart3, Users, DollarSign, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardHeader, CardContent, Badge, Button } from '@/components/stitch';

const platformStats = [
  { label: 'Total Revenue', value: '$1.2M', change: '+15%', trend: 'up' },
  { label: 'Active Users', value: '12,450', change: '+8%', trend: 'up' },
  { label: 'API Calls/day', value: '2.1M', change: '+22%', trend: 'up' },
  { label: 'Avg Response Time', value: '45ms', change: '-12%', trend: 'down' },
];

const recentActivity = [
  { time: '2 min ago', event: 'New user registration', details: 'john@acme.com signed up' },
  { time: '5 min ago', event: 'Payment received', details: '$99.00 from maria@tech.io' },
  { time: '12 min ago', event: 'Webhook delivered', details: 'payment.succeeded to 3 endpoints' },
  { time: '18 min ago', event: 'System alert', details: 'High CPU usage on worker-04 resolved' },
  { time: '25 min ago', event: 'Backup completed', details: 'D1 database backup uploaded to R2' },
];

const systemHealth = [
  { name: 'Database (D1)', status: 'healthy', latency: '12ms' },
  { name: 'Workers (CF)', status: 'healthy', latency: '45ms' },
  { name: 'R2 Storage', status: 'healthy', latency: '23ms' },
  { name: 'NOWPayments API', status: 'degraded', latency: '180ms' },
];

export default function AdminPanelPage() {
  return (
    <div className="min-h-screen bg-background p-lg">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-xl">
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-sm">
            Platform Administration
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            System overview and platform management
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
                {stat.label}
              </p>
              <h3 className="font-headline-md text-headline-md text-on-surface">{stat.value}</h3>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl mb-xl">
          {/* System Health */}
          <Card padding="lg">
            <CardHeader>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">System Health</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-md">
                {systemHealth.map((sys) => (
                  <div key={sys.name} className="flex items-center justify-between">
                    <div>
                      <p className="font-label-md text-on-surface">{sys.name}</p>
                      <p className="text-sm text-on-surface-variant">{sys.latency}</p>
                    </div>
                    <Badge variant="soft" color={sys.status === 'healthy' ? 'success' : 'warning'}>
                      {sys.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card padding="lg">
            <CardHeader>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Quick Actions</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-sm">
                <Button variant="outline" className="h-20 flex-col">
                  <Activity className="w-6 h-6 mb-sm" />
                  View Logs
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <TrendingUp className="w-6 h-6 mb-sm" />
                  Run Analytics
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Users className="w-6 h-6 mb-sm" />
                  Manage Users
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <AlertTriangle className="w-6 h-6 mb-sm" />
                  View Alerts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Recent Activity</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-md">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-md pb-md border-b border-outline-variant last:border-0 last:pb-0">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-label-md text-on-surface">{activity.event}</p>
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
