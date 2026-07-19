/**
 * Credit Meter — reserve / commit / refund for agency video generation.
 *
 * Wraps agency-repo credit operations with job-first semantic tracking.
 * Uses the INSERT ON CONFLICT DO NOTHING atomic-lock pattern (proven in
 * billing/overage-billing-ops) for concurrency safety.
 *
 * Layer: forest (infrastructure orchestrator)
 * Dependencies: seed only (agency-repo, logger)
 */

import {
	getCreditBalance,
	reserveCredits as repoReserve,
	commitCredits as repoCommit,
	refundCredits as repoRefund,
} from '@/seed/db/repositories/agency-repo'
import { logger } from '@/seed/utils/logger-utility'
import { success, failure, type Result } from '@/seed/types/result'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreditMeterConfig {
	/** Credits consumed per video generation job (default 1) */
	creditsPerJob: number
	/** Retry count for transient DB failures */
	maxRetries: number
}

export const DEFAULT_CREDIT_METER_CONFIG: CreditMeterConfig = {
	creditsPerJob: 1,
	maxRetries: 2,
}

export interface ReservationReceipt {
	jobId: string
	agencyId: number
	amount: number
	balanceAfter: number
}

export interface ConsumedReceipt {
	jobId: string
	agencyId: number
	amount: number
}

// ── Credit Meter ──────────────────────────────────────────────────────────────

export class CreditMeter {
	constructor(private config: CreditMeterConfig = DEFAULT_CREDIT_METER_CONFIG) {}

	/**
	 * Reserve credits for a job start.
	 * Returns the new balance or error. Job must be committed or refunded.
	 */
	async reserve(
		agencyId: number,
		jobId: string,
	): Promise<Result<ReservationReceipt, { code: string; message: string }>> {
		const log = logger.child('credit-meter')
		const amount = this.config.creditsPerJob

		for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
			try {
				const result = await repoReserve(agencyId, amount, jobId)

				if (result.ok) {
					log.info('Credits reserved', { agencyId, jobId, amount, balanceAfter: result.value })
					return success({
						jobId,
						agencyId,
						amount,
						balanceAfter: result.value,
					})
				}

				// Non-retryable error
				if (
					(result.error as Error & { code?: string }).code === 'INSUFFICIENT_CREDITS'
				) {
					log.warn('Insufficient credits for reservation', { agencyId, jobId, amount })
					return failure({
						code: 'INSUFFICIENT_CREDITS',
						message: (result.error as Error & { message?: string }).message,
					})
				}

				// Transient — retry
				log.warn('Reserve attempt failed, retrying', {
					agencyId,
					jobId,
					attempt,
					code: (result.error as Error & { code?: string }).code,
				})
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				log.warn('Reserve threw, retrying', { agencyId, jobId, attempt, error: msg })
			}
		}

		log.error('Reserve exhausted retries', { agencyId, jobId })
		return failure({ code: 'CREDIT_RESERVE_ERROR', message: 'Failed to reserve credits after retries' })
	}

	/**
	 * Commit a reservation — finalize the credit deduction.
	 */
	async commit(
		agencyId: number,
		jobId: string,
	): Promise<Result<ConsumedReceipt, { code: string; message: string }>> {
		const log = logger.child('credit-meter')
		const amount = this.config.creditsPerJob

		try {
			const result = await repoCommit(agencyId, jobId)

			if (!result.ok) {
				log.error('Commit failed', {
					agencyId,
					jobId,
					code: (result.error as Error & { code?: string }).code,
				})
				return failure({
					code: 'CREDIT_COMMIT_ERROR',
					message: result.error.message,
				})
			}

			log.info('Credits committed', { agencyId, jobId, amount })
			return success({ jobId, agencyId, amount })
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			log.error('Commit threw', { agencyId, jobId, error: msg })
			return failure({ code: 'CREDIT_COMMIT_ERROR', message: msg })
		}
	}

	/**
	 * Refund credits for a failed job.
	 */
	async refund(
		agencyId: number,
		jobId: string,
	): Promise<Result<void, { code: string; message: string }>> {
		const log = logger.child('credit-meter')

		try {
			const result = await repoRefund(agencyId, jobId)

			if (!result.ok) {
				log.error('Refund failed', {
					agencyId,
					jobId,
					code: (result.error as Error & { code?: string }).code,
				})
				return failure({
					code: 'CREDIT_REFUND_ERROR',
					message: result.error.message,
				})
			}

			log.info('Credits refunded', { agencyId, jobId })
			return success(undefined)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			log.error('Refund threw', { agencyId, jobId, error: msg })
			return failure({ code: 'CREDIT_REFUND_ERROR', message: msg })
		}
	}

	/**
	 * Get current credit balance for an agency.
	 */
	async getBalance(agencyId: number): Promise<number> {
		try {
			return await getCreditBalance(agencyId)
		} catch {
			return 0
		}
	}
}
