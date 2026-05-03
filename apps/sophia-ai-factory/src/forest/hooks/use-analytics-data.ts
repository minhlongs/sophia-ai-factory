'use client'
/**
 * Analytics data hooks — merge Supabase + RaaS Gateway data
 * @module hooks/use-analytics-data
 */

import useSWR from 'swr'
import { useMemo } from 'react'
import type { UsageMetrics, RevenueMetrics, LicenseMetrics } from '@/lib/analytics/types'
import { useRaasAnalytics, useRaasBillingAnalytics, useRaasLicenseAnalytics } from './use-raas-analytics'

export { useRaasAnalytics, useRaasBillingAnalytics, useRaasLicenseAnalytics } from './use-raas-analytics'

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch' })) as Record<string, string>
    throw new Error(err.error || 'Failed to fetch analytics data')
  }
  return (await res.json()) as T
}

const swrConfig = { dedupingInterval: 60000, revalidateOnFocus: false, keepPreviousData: true } as const

export function useUsageAnalytics(options: { licenseNonce?: string | null; start?: number; end?: number; granularity?: 'hour' | 'day'; service?: string; isEnabled?: boolean } = {}) {
  const { licenseNonce, start, end, granularity = 'hour', service, isEnabled = true } = options
  const params = new URLSearchParams()
  if (licenseNonce) params.set('license_nonce', licenseNonce)
  if (start) params.set('start', start.toString())
  if (end) params.set('end', end.toString())
  if (granularity) params.set('granularity', granularity)
  if (service) params.set('service', service)

  const { data: supabaseData, error: supabaseError, isLoading: supabaseLoading, mutate: supabaseMutate } = useSWR<UsageMetrics>(
    isEnabled ? `/api/analytics/usage?${params.toString()}` : null,
    fetcher,
    swrConfig
  )
  const { data: raasData, error: raasError, loading: raasLoading, mutate: raasMutate } = useRaasAnalytics({ start, end, isEnabled })

  const mergedData = useMemo(() => {
    if (!supabaseData) return null
    if (!raasData) return supabaseData
    return {
      ...supabaseData,
      summary: { ...supabaseData.summary, activeLicenses: raasData.activeLicenses },
      timeSeries: supabaseData.timeSeries,
      serviceBreakdown: supabaseData.serviceBreakdown,
      quotaTrend: raasData.quotaConsumption,
    }
  }, [supabaseData, raasData])

  return { data: mergedData, loading: supabaseLoading || raasLoading, error: supabaseError || raasError, mutate: () => { supabaseMutate(); raasMutate() } }
}

export function useRevenueAnalytics(options: { period?: 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days'; tier?: string; isEnabled?: boolean } = {}) {
  const { period = 'current_month', tier, isEnabled = true } = options
  const params = new URLSearchParams()
  params.set('period', period)
  if (tier) params.set('tier', tier)

  const { data: supabaseData, error: supabaseError, isLoading: supabaseLoading, mutate: supabaseMutate } = useSWR<RevenueMetrics>(
    isEnabled ? `/api/analytics/revenue?${params.toString()}` : null,
    fetcher,
    swrConfig
  )
  const { data: raasData, error: raasError, loading: raasLoading, mutate: raasMutate } = useRaasBillingAnalytics({ period, isEnabled })

  const mergedData = useMemo(() => {
    if (!supabaseData) return null
    if (!raasData) return supabaseData
    return {
      ...supabaseData,
      totalRevenue: raasData.totalRevenue || supabaseData.totalRevenue,
      recurringRevenue: raasData.recurringRevenue || supabaseData.recurringRevenue,
      oneTimeRevenue: raasData.oneTimeRevenue || supabaseData.oneTimeRevenue,
      byTier: raasData.byTier.length > 0 ? raasData.byTier : supabaseData.byTier,
      trend: raasData.trend.length > 0 ? raasData.trend : supabaseData.trend,
    }
  }, [supabaseData, raasData])

  return { data: mergedData, loading: supabaseLoading || raasLoading, error: supabaseError || raasError, mutate: () => { supabaseMutate(); raasMutate() } }
}

export function useLicenseAnalytics(options: { status?: 'active' | 'expired' | 'revoked' | 'all'; tier?: string; isEnabled?: boolean } = {}) {
  const { status = 'active', tier, isEnabled = true } = options
  const params = new URLSearchParams()
  params.set('status', status)
  if (tier) params.set('tier', tier)

  const { data: supabaseData, error: supabaseError, isLoading: supabaseLoading, mutate: supabaseMutate } = useSWR<LicenseMetrics>(
    isEnabled ? `/api/analytics/licenses?${params.toString()}` : null,
    fetcher,
    swrConfig
  )
  const { data: raasData, error: raasError, loading: raasLoading, mutate: raasMutate } = useRaasLicenseAnalytics({ isEnabled })

  const mergedData = useMemo(() => {
    if (!supabaseData) return null
    if (!raasData) return supabaseData
    return { ...supabaseData, utilization: raasData.length > 0 ? raasData : supabaseData.utilization }
  }, [supabaseData, raasData])

  return { data: mergedData, loading: supabaseLoading || raasLoading, error: supabaseError || raasError, mutate: () => { supabaseMutate(); raasMutate() } }
}

export function useAllAnalytics(options: { licenseNonce?: string | null; period?: string; status?: string; isEnabled?: boolean } = {}) {
  const { licenseNonce, isEnabled = true } = options
  const usage = useUsageAnalytics({ licenseNonce, isEnabled })
  const revenue = useRevenueAnalytics({ isEnabled })
  const licenses = useLicenseAnalytics({ isEnabled })
  return { usage, revenue, licenses, loading: usage.loading || revenue.loading || licenses.loading, error: usage.error || revenue.error || licenses.error }
}
