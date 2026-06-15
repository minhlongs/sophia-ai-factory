/**
 * Types for Cron Report Runner
 * @module audit/cron-report-runner-types
 */

export interface RunResult {
  executed: number
  errors: number
  details: ExecutionDetail[]
}

export interface ExecutionDetail {
  reportId: string
  type: string
  format: string
  success: boolean
  error?: string
  recipients?: string[]
  storageUrl?: string
}
