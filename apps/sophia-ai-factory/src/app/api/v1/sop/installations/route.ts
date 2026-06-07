/**
 * GET /api/v1/sop/installations — list SOP installations for current user
 *
 * Auth: session cookie required (401 if not authenticated)
 * Query: ?limit=N (default 20, max 100)
 * Returns: { items: SopInstallationSummary[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface SopInstallationSummary {
	id: string;
	sop_id: string;
	installed_at: number;
	version: number;
	status: string;
	sop_name: string;
}

const QuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const parsed = QuerySchema.safeParse({
			limit: searchParams.get('limit') ?? undefined,
		});
		if (!parsed.success) {
			return NextResponse.json(
				{ error: 'Invalid query', details: parsed.error.flatten().fieldErrors },
				{ status: 400 },
			);
		}

		const db = createServerClient();
		try {
			const { data, error } = await db
				.from('user_sop_installations')
				.select('id, sop_id, installed_at, version, status, sop_name')
				.eq('user_id', user.id)
				.order('installed_at', { ascending: false })
				.limit(parsed.data.limit);

			if (error) {
				logger.warn('[GET /api/v1/sop/installations] DB error', {
					code: error.code,
					message: error.message,
				});
				return NextResponse.json(
					{ error: 'Failed to fetch installations' },
					{ status: 503 },
				);
			}

			const items = (data as SopInstallationSummary[] | null) ?? [];
			return NextResponse.json({ items }, { status: 200 });
		} catch (dbErr) {
			logger.warn('[GET /api/v1/sop/installations] Query failed', {
				error: dbErr instanceof Error ? dbErr.message : String(dbErr),
			});
			return NextResponse.json(
				{ error: 'Failed to fetch installations' },
				{ status: 503 },
			);
		}
	} catch (err) {
		logger.error(
			'[GET /api/v1/sop/installations]',
			err instanceof Error ? err : new Error(String(err)),
		);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
