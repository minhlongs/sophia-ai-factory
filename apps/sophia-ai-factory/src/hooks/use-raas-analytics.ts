'use client'
/**
 * RaaS Gateway analytics hooks
 * @module hooks/use-raas-analytics
 */

import useSWR from 'swr'
import { RaasGatewayClient, type RaasUsageMetrics, type BillingMetrics, type LicenseUtilization } from '@/lib/raas-gateway-client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'

const raasClient = new RaasGatewayClient({
  baseURL: process.env.NEXT_PUBLIC_RAAS_GATEWAY_URL || 'https://raas.agencyos.network',
  apiKey: process.env.NEXT_PUBLIC_RAAS_API_KEY || '',
  timeout: 10000,
})

const raasFetcher = {
  usage: async (start: number, end: number) => {
    try { return await raasClient.getUsageMetrics(start, end) } catch (error) { logger.error('[RaaS] Failed to fetch usage metrics', toError(error)); return null }
  },
  billing: async (period: string) => {
    try { return await raasClient.getBillingMetrics(period) } catch (error) { logger.error('[RaaS] Failed to fetch billing metrics', toError(error)); return null }
  },
  licenses: async () => {
    try { return await raasClient.getLicenseUtilization() } catch (error) { logger.error('[RaaS] Failed to fetch license utilization', toError(error)); return null }
  },
}

export function useRaasAnalytics(options: { start?: number; end?: number; autoRefresh?: boolean; isEnabled?: boolean } = {}) {
  const { start, end, autoRefresh = false, isEnabled = true } = options
  const { data, error, isLoading, mutate } = useSWR<RaasUsageMetrics | null>(
    isEnabled ? `raas-metrics-${start}-${end}` : null,
    async () => raasFetcher.usage(start!, end!),
    { dedupingInterval: 30000, revalidateOnFocus: autoRefresh, keepPreviousData: true }
  )
  return { data, loading: isLoading, error, mutate }
}

export function useRaasBillingAnalytics(options: { period?: string; isEnabled?: boolean } = {}) {
  const { period = 'last_30_days', isEnabled = true } = options
  const { data, error, isLoading, mutate } = useSWR<BillingMetrics | null>(
    isEnabled ? `raas-billing-${period}` : null,
    async () => raasFetcher.billing(period),
    { dedupingInterval: 300000, revalidateOnFocus: false, keepPreviousData: true }
  )
  return { data, loading: isLoading, error, mutate }
}

export function useRaasLicenseAnalytics(options: { isEnabled?: boolean } = {}) {
  const { isEnabled = true } = options
  const { data, error, isLoading, mutate } = useSWR<LicenseUtilization[] | null>(
    isEnabled ? 'raas-licenses' : null,
    async () => raasFetcher.licenses(),
    { dedupingInterval: 300000, revalidateOnFocus: false, keepPreviousData: true }
  )
  return { data, loading: isLoading, error, mutate }
}
