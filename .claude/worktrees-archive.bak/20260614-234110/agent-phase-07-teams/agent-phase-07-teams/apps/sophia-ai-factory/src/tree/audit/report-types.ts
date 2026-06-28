/** License data for compliance reports */
export interface LicenseReportData {
  nonce: string
  tier: string
  validationCount: number
  usageCredits: number
  createdAt: string
  lastUsedAt?: string
}

/** Model usage breakdown */
export interface ModelUsageData {
  modelName: string
  invocations: number
  tokensProcessed: number
  tokensInput: number
  tokensOutput: number
}

/** Hash chain verification status */
export interface HashChainVerification {
  firstHash: string
  lastHash: string
  totalLogs: number
  verified: boolean
  invalidIndex?: number
}

/** Compliance report summary */
export interface ComplianceReportSummary {
  totalLogs: number
  hashChainValid: boolean
  totalLicenses: number
  totalUsage: number
  periodStart: Date
  periodEnd: Date
}

/** Complete compliance report data structure */
export interface ComplianceReportData {
  reportId: string
  generatedAt: string
  generatedBy: string
  period: { start: Date; end: Date }
  summary: ComplianceReportSummary
  licenses: LicenseReportData[]
  modelBreakdown: ModelUsageData[]
  hashChainVerification: HashChainVerification
  auditTrailUrl?: string
}
