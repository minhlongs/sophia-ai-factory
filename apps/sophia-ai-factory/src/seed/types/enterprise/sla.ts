export type EnterpriseSlaTier = '99.9%';

export const DEFAULT_SLA_UPTIME_PERCENT = 99.9;

export interface SlaRemedyTier {
  minAvailabilityPercent: number;
  maxAvailabilityPercent: number;
  creditPercent: number;
  descriptionVi: string;
  descriptionEn: string;
}

export const SLA_SERVICE_CREDIT_SCHEDULE: readonly SlaRemedyTier[] = [
  {
    minAvailabilityPercent: 99.9,
    maxAvailabilityPercent: 100.0,
    creditPercent: 0,
    descriptionVi: 'Đạt cam kết SLA (>= 99.9%) — Không áp dụng hoàn tiền',
    descriptionEn: 'SLA target met (>= 99.9%) — No service credit applicable',
  },
  {
    minAvailabilityPercent: 99.0,
    maxAvailabilityPercent: 99.89,
    creditPercent: 10,
    descriptionVi: 'Suy giảm nhẹ (99.0% – 99.89%) — Hoàn lại 10% phí chu kỳ',
    descriptionEn: 'Minor degradation (99.0% – 99.89%) — 10% cycle credit remedy',
  },
  {
    minAvailabilityPercent: 95.0,
    maxAvailabilityPercent: 98.99,
    creditPercent: 25,
    descriptionVi: 'Suy giảm trung bình (95.0% – 98.99%) — Hoàn lại 25% phí chu kỳ',
    descriptionEn: 'Moderate degradation (95.0% – 98.99%) — 25% cycle credit remedy',
  },
  {
    minAvailabilityPercent: 0.0,
    maxAvailabilityPercent: 94.99,
    creditPercent: 50,
    descriptionVi: 'Suy giảm nghiêm trọng (< 95.0%) — Hoàn lại 50% phí chu kỳ',
    descriptionEn: 'Critical degradation (< 95.0%) — 50% cycle credit remedy',
  },
] as const;
