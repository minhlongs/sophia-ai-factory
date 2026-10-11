import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyCsrfToken } from '@/seed/security/csrf';
import { errorResponse, handleThrownError } from '@/seed/api';
import {
  scheduleCreateSchema,
  schedulePatchSchema,
  listSchedulesForUser,
  createScheduleForUser,
  updateScheduleForUser,
  deleteScheduleForUser,
} from './service';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await listSchedulesForUser(user.id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ schedules: result.data ?? [] });
  } catch (err) {
    return handleThrownError(err, 'Failed to fetch schedules', 'SCHEDULE_LIST_FAILED');
  }
}

export async function POST(req: NextRequest) {
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: 'CSRF token missing or invalid' }, { status: 403 });
  }
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = scheduleCreateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid schedule input', 'VALIDATION_ERROR', 400);
    }

    const result = await createScheduleForUser(user.id, parsed.data);
    if (result.error) {
      const status = result.code === 'TABLE_NOT_FOUND' ? 503 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      schedule: result.data,
    });
  } catch (err) {
    return handleThrownError(err, 'Failed to create schedule', 'SCHEDULE_CREATE_FAILED');
  }
}

export async function PATCH(req: NextRequest) {
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: 'CSRF token missing or invalid' }, { status: 403 });
  }
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = schedulePatchSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid schedule input', 'VALIDATION_ERROR', 400);
    }

    const result = await updateScheduleForUser(user.id, parsed.data);
    if (result.error) {
      const status =
        result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'TABLE_NOT_FOUND'
            ? 503
            : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      schedule: result.data,
    });
  } catch (err) {
    return handleThrownError(err, 'Failed to update schedule', 'SCHEDULE_UPDATE_FAILED');
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: 'CSRF token missing or invalid' }, { status: 403 });
  }
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing schedule id' }, { status: 400 });
    }

    const result = await deleteScheduleForUser(user.id, id);
    if (result.error) {
      const status =
        result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'TABLE_NOT_FOUND'
            ? 503
            : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleThrownError(err, 'Failed to delete schedule', 'SCHEDULE_DELETE_FAILED');
  }
}
