/** @module lottery/lottery-db */
import { getD1 } from '@/seed/db/client'
import { LotteryRowRaw, LotteryRow, TwoDigitRow, IngestResult } from './types'

function toTwo(row: LotteryRowRaw): TwoDigitRow {
	const p = (s: string) => {
		const n = parseInt(s.padStart(2, '0').slice(-2), 10)
		return Number.isNaN(n) ? 0 : n
	}
	return {
		date: row.date,
		p1: p(row.prize_1),
		p2: p(row.prize_2),
		p3: p(row.prize_3),
		p4: p(row.prize_4),
		p5: p(row.prize_5),
		p6: p(row.prize_6),
		p7: p(row.prize_7),
		p8: p(row.prize_8),
	}
}

export function extractTwoDigits(row: LotteryRow): TwoDigitRow {
	return toTwo(row as LotteryRowRaw)
}

export function extractAllTwoDigits(rows: LotteryRow[]): TwoDigitRow[] {
	return rows.map(toTwo)
}

function rowFromStmt(r: Record<string, unknown>): LotteryRow {
	return {
		id: r.id as number,
		date: r.date as string,
		prize_1: r.prize_1 as string,
		prize_2: r.prize_2 as string,
		prize_3: r.prize_3 as string,
		prize_4: r.prize_4 as string,
		prize_5: r.prize_5 as string,
		prize_6: r.prize_6 as string,
		prize_7: r.prize_7 as string,
		prize_8: r.prize_8 as string,
	}
}

export function createLotteryRow(
	date: string,
	prizes: Record<string, string>,
): LotteryRowRaw {
	return {
		id: 0,
		date,
		prize_1: prizes.prize_1,
		prize_2: prizes.prize_2,
		prize_3: prizes.prize_3,
		prize_4: prizes.prize_4,
		prize_5: prizes.prize_5,
		prize_6: prizes.prize_6,
		prize_7: prizes.prize_7,
		prize_8: prizes.prize_8,
	}
}

export async function upsertLotteryRows(
	date: string,
	prizes: Record<string, string>,
): Promise<
	{ ok: true; data: IngestResult } | { ok: false; error: { code: string; message: string } }
> {
	const db = getD1()
	if (!db) {
		return { ok: false, error: { code: 'DB_UNAVAILABLE', message: 'D1 database not available' } }
	}
	try {
		const exists = await db.prepare('SELECT id FROM lottery_results WHERE date = ?1').bind(date).first()
		if (exists) {
			return {
				ok: false,
				error: { code: 'DUPLICATE_DATE', message: `Date ${date} already exists` },
			}
		}

		const result = await db
			.prepare(
				`INSERT INTO lottery_results (date, prize_1, prize_2, prize_3, prize_4, prize_5, prize_6, prize_7, prize_8)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
			)
			.bind(
				date,
				prizes.prize_1,
				prizes.prize_2,
				prizes.prize_3,
				prizes.prize_4,
				prizes.prize_5,
				prizes.prize_6,
				prizes.prize_7,
				prizes.prize_8,
			)
			.run()

		if (!result || !result.meta || result.meta.changes !== 1) {
			return {
				ok: false,
				error: { code: 'INSERT_FAILED', message: 'Failed to insert lottery result' },
			}
		}

		const range = await db
			.prepare('SELECT MIN(date) as from, MAX(date) as to FROM lottery_results')
			.first<{ from: string; to: string }>()

		return {
			ok: true,
			data: {
				ok: true,
				added: 1,
				skipped: 0,
				dateRange: range
					? { from: range.from, to: range.to }
					: { from: date, to: date },
			},
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Database error'
		if (msg.includes('UNIQUE constraint')) {
			return {
				ok: false,
				error: { code: 'DUPLICATE_DATE', message: `Date ${date} already exists` },
			}
		}
		return { ok: false, error: { code: 'DB_ERROR', message: msg } }
	}
}

export async function getLatestLottery(): Promise<
	{ ok: true; data: LotteryRow | null } | { ok: false; error: string }
> {
	const db = getD1()
	if (!db) return { ok: true, data: null }
	try {
		const row = await db
			.prepare(
				'SELECT id, date, prize_1, prize_2, prize_3, prize_4, prize_5, prize_6, prize_7, prize_8 FROM lottery_results ORDER BY date DESC LIMIT 1',
			)
			.first<Record<string, unknown>>()
		if (!row) return { ok: true, data: null }
		return { ok: true, data: rowFromStmt(row) }
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : 'Query failed' }
	}
}

export async function getLotteryHistory(
	offset: number,
	limit: number,
): Promise<
	{ ok: true; data: { rows: LotteryRow[]; total: number } } | { ok: false; error: string }
> {
	const db = getD1()
	if (!db) {
		return { ok: false, error: 'D1 database not available' }
	}
	try {
		const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM lottery_results').first<{ cnt: number }>()
		const total = countRow?.cnt ?? 0

		const result = await db
			.prepare(
				'SELECT id, date, prize_1, prize_2, prize_3, prize_4, prize_5, prize_6, prize_7, prize_8 FROM lottery_results ORDER BY date DESC LIMIT ?1 OFFSET ?2',
			)
			.bind(limit, offset)
			.all<Record<string, unknown>>()

		const rows = (result.results ?? []).map(rowFromStmt)

		return {
			ok: true,
			data: { rows, total },
		}
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : 'Query failed' }
	}
}

export async function getRowCount(): Promise<number | null> {
	const db = getD1()
	if (!db) return null
	try {
		const row = await db.prepare('SELECT COUNT(*) as cnt FROM lottery_results').first<{ cnt: number }>()
		return row?.cnt ?? null
	} catch {
		return null
	}
}
