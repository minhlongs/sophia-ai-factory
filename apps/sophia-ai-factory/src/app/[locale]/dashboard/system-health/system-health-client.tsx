'use client';

import React from 'react';
import { AgentHealthCard } from './components/agent-health-card';
import { HarnessHealthCard } from './components/harness-health-card';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle,
  AlertCircle,
  Database,
  Cloud,
  Mic,
  Video,
  Send,
  RefreshCw,
  Cpu
} from 'lucide-react';
import type { HealthResponse, ServiceHealth } from '@/seed/types/health';

const ServiceIcon = ({ name }: { name: string }) => {
  switch (name) {
    case 'supabase': return <Database className="w-6 h-6" aria-hidden="true" />;
    case 'inngest': return <Activity className="w-6 h-6" aria-hidden="true" />;
    case 'openrouter': return <Cpu className="w-6 h-6" aria-hidden="true" />;
    case 'elevenlabs': return <Mic className="w-6 h-6" aria-hidden="true" />;
    case 'heygen': return <Video className="w-6 h-6" aria-hidden="true" />;
    case 'telegram': return <Send className="w-6 h-6" aria-hidden="true" />;
    default: return <Cloud className="w-6 h-6" aria-hidden="true" />;
  }
};

const StatusBadge = ({ status }: { status: ServiceHealth['status'] }) => {
  switch (status) {
    case 'up':
    case 'configured':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
          <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
          Operational
        </span>
      );
    case 'down':
    case 'missing_config':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
          {status === 'missing_config' ? 'Missing Config' : 'Down'}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
          Unknown
        </span>
      );
  }
};

export default function SystemHealthClient() {
  const { data: health, isLoading, isError, refetch, isRefetching } = useQuery<HealthResponse>({
    queryKey: ['system-health-detail'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Failed to fetch health status');
      return res.json();
    },
    // Refetch every 30s
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-primary" role="status" aria-label="Loading system health">
          <span className="sr-only">Đang tải...</span>
        </div>
      </div>
    );
  }

  if (isError || !health) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
          <p>Không thể tải trạng thái hệ thống. API có thể đang gián đoạn.</p>
          <button
            onClick={() => refetch()}
            className="ml-auto px-4 py-2 bg-white border border-red-200 rounded text-sm hover:bg-red-50"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sức Khỏe Hệ Thống</h1>
          <p className="text-muted-foreground mt-1">Theo dõi trạng thái cơ sở hạ tầng và dịch vụ quan trọng</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'motion-safe:animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall Status Card */}
      <div className={`rounded-xl border p-6 ${
        health.status === 'healthy' ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
        health.status === 'degraded' ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800' :
        'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${
            health.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
            health.status === 'degraded' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
            'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
          }`}>
            <Activity className="w-8 h-8" aria-hidden="true" />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${
              health.status === 'healthy' ? 'text-green-900 dark:text-green-100' :
              health.status === 'degraded' ? 'text-yellow-900 dark:text-yellow-100' :
              'text-red-900 dark:text-red-100'
            }`}>
              {health.status === 'healthy' ? 'All Systems Operational' :
               health.status === 'degraded' ? 'System Degraded' :
               'System Critical'}
            </h2>
            <p className={`text-sm mt-1 ${
              health.status === 'healthy' ? 'text-green-700 dark:text-green-300' :
              health.status === 'degraded' ? 'text-yellow-700 dark:text-yellow-300' :
              'text-red-700 dark:text-red-300'
            }`}>
              Cập nhật lần cuối: {new Date(health.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(health.services ?? {}).map(([key, service]) => (
          <div key={key} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                  <ServiceIcon name={key} />
                </div>
                <StatusBadge status={service.status} />
              </div>

              <h3 className="font-semibold text-foreground capitalize mb-1">
                {key.replace(/_/g, ' ')}
              </h3>

              <div className="space-y-2 mt-4">
                {service.latency !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Độ Trễ</span>
                    <span className={`font-mono ${
                      service.latency < 200 ? 'text-green-600 dark:text-green-400' :
                      service.latency < 500 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {service.latency}ms
                    </span>
                  </div>
                )}

                {service.error && (
                  <div className="mt-2 p-2 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20 font-mono break-all">
                    {service.error}
                  </div>
                )}

                {service.status === 'missing_config' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Environment variable missing. Please check your configuration.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Agent Health */}
      <AgentHealthCard />

      {/* Harness Engineering Health */}
      <HarnessHealthCard />
    </div>
  );
}
