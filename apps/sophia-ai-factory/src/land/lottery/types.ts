/** @module lottery/types */

export interface LotteryRowRaw {
  id: number
  date: string
  prize_1: string
  prize_2: string
  prize_3: string
  prize_4: string
  prize_5: string
  prize_6: string
  prize_7: string
  prize_8: string
}

export interface LotteryRow {
  id: number
  date: string
  prize_1: string
  prize_2: string
  prize_3: string
  prize_4: string
  prize_5: string
  prize_6: string
  prize_7: string
  prize_8: string
}

export interface TwoDigitRow {
  date: string
  p1: number
  p2: number
  p3: number
  p4: number
  p5: number
  p6: number
  p7: number
  p8: number
}

export interface TwoDigitStats {
  value: number
  total: number
  lastSeen: string | null
}

export interface IngestResult {
  ok: true
  added: number
  skipped: number
  dateRange: { from: string; to: string } | null
}

export interface HealthResponse {
  ok: boolean
  dbReady: boolean
  rowCount: number | null
}

export interface StatsResponse {
  hot: TwoDigitStats[]
  cold: TwoDigitStats[]
}
