import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { createServerClient } from '@/seed/db/client'
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper'
import { z } from 'zod'

const emptyBodySchema = z.object({})

export async function POST(request: NextRequest) {
	try {
		const user = await getCurrentUser()
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await request.json().catch(() => null)
		if (body === null) {
			return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
		}

		const validation = emptyBodySchema.safeParse(body)
		if (!validation.success) {
			return NextResponse.json(
				{ error: 'Invalid request body' },
				{ status: 400 },
			)
		}

		const db = createServerClient()

		const { data, error } = await db
			.from('publishing_channels')
			.delete()
			.eq('user_id', user.id)
			.eq('provider', 'youtube')
			.limit(1)

		if (error) {
			return NextResponse.json({ error: 'Server error' }, { status: 503 })
		}

		const rows = Array.isArray(data) ? data : []
		return NextResponse.json({ success: true, deleted: rows.length })
	} catch {
		return NextResponse.json({ error: 'Server error' }, { status: 500 })
	}
}

export const GET = withRateLimit(
	async () => NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }),
	{ config: { intervalMs: 60000, maxRequests: 10 } },
)
