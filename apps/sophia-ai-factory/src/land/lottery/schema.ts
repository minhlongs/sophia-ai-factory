/** @module lottery/schema */
export const PRIZE_COLUMNS = [
  'prize_1',
  'prize_2',
  'prize_3',
  'prize_4',
  'prize_5',
  'prize_6',
  'prize_7',
  'prize_8',
] as const

export type PrizeColumn = (typeof PRIZE_COLUMNS)[number]
