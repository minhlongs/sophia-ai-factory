'use client';

import React from 'react';
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
import type { HealthResponse, ServiceHealth } from '@/types/health';

const ServiceIcon = ({ name }: { name: string }) => {
  switch (name) {
    case 'supabase': return <Database className="w-6 h-6" />;
    case 'inngest': return <Activity className="w-6 h-6" />;
    case 'openrouter': return <Cpu className="w-6 h-6" />; // AI
    case 'elevenlabs': return <Mic className="w-6 h-6" />;
    case 'heygen': return <Video className="w-6 h-6" />;
    case 'telegram': return <Send className="w-6 h-6" />;
    default: return <Cloud className="w-6 h-6" />;
  }
};

const StatusBadge = ({ status }: { status: ServiceHealth['status'] }) => {
  switch (status) {
    case 'up':
    case 'configured':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3.5 h-3.5" />
          Operational
        </span>
      );
    case 'down':
    case 'missing_config':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3.5 h-3.5" />
          {status === 'missing_config' ? 'Missing Config' : 'Down'}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="w-3.5 h-3.5" />
          Unknown
        </span>
      );
  }
};

export default function SystemHealthPage() {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isError || !health) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>Failed to load system health status. The API might be down.</p>
          <button
            onClick={() => refetch()}
            className="ml-auto px-4 py-2 bg-white border border-red-200 rounded text-sm hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 mt-1">Monitor the status of critical infrastructure and services</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall Status Card */}
      <div className={`rounded-xl border p-6 ${
        health.status === 'healthy' ? 'bg-green-50 border-green-200' :
        health.status === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
        'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${
            health.status === 'healthy' ? 'bg-green-100 text-green-600' :
            health.status === 'degraded' ? 'bg-yellow-100 text-yellow-600' :
            'bg-red-100 text-red-600'
          }`}>
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${
              health.status === 'healthy' ? 'text-green-900' :
              health.status === 'degraded' ? 'text-yellow-900' :
              'text-red-900'
            }`}>
              {health.status === 'healthy' ? 'All Systems Operational' :
               health.status === 'degraded' ? 'System Degraded' :
               'System Critical'}
            </h2>
            <p className={`text-sm mt-1 ${
              health.status === 'healthy' ? 'text-green-700' :
              health.status === 'degraded' ? 'text-yellow-700' :
              'text-red-700'
            }`}>
              Last updated: {new Date(health.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(health.services).map(([key, service]) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
                  <ServiceIcon name={key} />
                </div>
                <StatusBadge status={service.status} />
              </div>

              <h3 className="font-semibold text-gray-900 capitalize mb-1">
                {key.replace(/_/g, ' ')}
              </h3>

              <div className="space-y-2 mt-4">
                {service.latency !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Latency</span>
                    <span className={`font-mono ${
                      service.latency < 200 ? 'text-green-600' :
                      service.latency < 500 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {service.latency}ms
                    </span>
                  </div>
                )}

                {service.error && (
                  <div className="mt-2 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-100 font-mono break-all">
                    {service.error}
                  </div>
                )}

                {service.status === 'missing_config' && (
                  <p className="text-xs text-gray-500 mt-2">
                    Environment variable missing. Please check your configuration.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
