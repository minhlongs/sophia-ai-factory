import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { errorResponse, handleThrownError } from '@/seed/api';
import {
  scheduleCreateSchema,
  schedulePatchSchema,
  listSchedulesForUser,
  createScheduleForUser,
  updateScheduleForUser,
  deleteScheduleForUser,
} from './service';
import {
  mapScheduleErrorStatus,
  parseJsonBody,
  requireCsrfUser,
} from './route-helpers';

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
  const auth = await requireCsrfUser(req);
  if ('response' in auth) return auth.response;

  try {
    const json = await parseJsonBody(req);
    if (!json.ok) return json.response;

    const parsed = scheduleCreateSchema.safeParse(json.body);
    if (!parsed.success) {
      return errorResponse('Invalid schedule input', 'VALIDATION_ERROR', 400);
    }

    const result = await createScheduleForUser(auth.userId, parsed.data);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: mapScheduleErrorStatus(result.code) });
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
  const auth = await requireCsrfUser(req);
  if ('response' in auth) return auth.response;

  try {
    const json = await parseJsonBody(req);
    if (!json.ok) return json.response;

    const parsed = schedulePatchSchema.safeParse(json.body);
    if (!parsed.success) {
      return errorResponse('Invalid schedule input', 'VALIDATION_ERROR', 400);
    }

    const result = await updateScheduleForUser(auth.userId, parsed.data);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: mapScheduleErrorStatus(result.code) });
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
  const auth = await requireCsrfUser(req);
  if ('response' in auth) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing schedule id' }, { status: 400 });
    }

    const result = await deleteScheduleForUser(auth.userId, id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: mapScheduleErrorStatus(result.code) });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleThrownError(err, 'Failed to delete schedule', 'SCHEDULE_DELETE_FAILED');
  }
}
