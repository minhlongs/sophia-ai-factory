/**
 * Reservation Eligibility & Concurrency Check Helper for Dedicated GPU Lanes
 *
 * Layer: tree/gpu-mesh/allocator
 *
 * @module tree/gpu-mesh/allocator/allocation-validator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseGpuReservation,
  LaneAllocationResult,
} from '@/seed/types/gpu-mesh';
import { getReservationById } from './lane-scheduler';
import {
  validateReservationCapacity,
  getReservationActiveJobCount,
} from './capacity-checker';

export type ReservationEligibility =
  | {
      eligible: true;
      reservation: EnterpriseGpuReservation;
      activeCount: number;
    }
  | {
      eligible: false;
      failureResult: LaneAllocationResult;
    };

export async function verifyReservationEligibility(params: {
  db: D1Database;
  jobId: string;
  reservationId: string;
  requestedMcu: number;
  now: number;
}): Promise<ReservationEligibility> {
  const { db, jobId, reservationId, requestedMcu, now } = params;

  const reservation = await getReservationById(db, reservationId);
  if (!reservation) {
    return {
      eligible: false,
      failureResult: {
        success: false,
        jobId,
        reservationId,
        lane: 'priority',
        priorityScore: 10,
        reason: 'RESERVATION_NOT_FOUND',
      },
    };
  }

  const capacityCheck = validateReservationCapacity(reservation, requestedMcu, now);
  if (!capacityCheck.valid) {
    return {
      eligible: false,
      failureResult: {
        success: false,
        jobId,
        reservationId,
        lane: 'priority',
        priorityScore: reservation.priorityScore,
        reason: capacityCheck.reason,
      },
    };
  }

  const activeCount = await getReservationActiveJobCount(db, reservation.id, now);
  if (activeCount >= reservation.concurrencyLimit) {
    return {
      eligible: false,
      failureResult: {
        success: false,
        jobId,
        reservationId,
        lane: 'priority',
        priorityScore: reservation.priorityScore,
        activeJobs: activeCount,
        concurrencyLimit: reservation.concurrencyLimit,
        reason: 'CONCURRENCY_LIMIT_EXCEEDED',
      },
    };
  }

  return { eligible: true, reservation, activeCount };
}
