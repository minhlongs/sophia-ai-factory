'use server';

import { getD1, createServerClient } from '@/seed/db/client';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { toError } from '@/seed/utils/to-error';
import type { Schedule } from '@/components/schedule/use-schedule-form';

export interface CreateScheduleInput {
  topic: string;
  interval_days: number;
  next_run_date: string;
}

export async function createScheduleAction(input: CreateScheduleInput) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Vui lòng đăng nhập để tạo lịch trình.' };
    }

    const db = createServerClient();
    const d1db = await getD1();
    if (!d1db) throw new Error('D1 database binding not available');

    const scheduleId = crypto.randomUUID();

    const { error } = await db
      .from('schedules')
      .insert({
        id: scheduleId,
        user_id: user.id,
        topic: input.topic.trim(),
        interval_days: input.interval_days,
        next_run_date: input.next_run_date,
        is_active: 1,
      });

    if (error) {
      return { success: false, message: `Failed to create schedule: ${error.message}` };
    }

    revalidatePath('/dashboard/schedule');
    return { success: true, message: 'Schedule created successfully', scheduleId };
  } catch (e) {
    return { success: false, message: `Error: ${toError(e).message}` };
  }
}

export async function toggleScheduleAction(id: string, currentActive: number) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Vui lòng đăng nhập.' };
    }

    const db = createServerClient();
    const d1db = await getD1();
    if (!d1db) throw new Error('D1 database binding not available');

    const newActive = currentActive === 1 ? 0 : 1;

    const { error } = await db
      .from('schedules')
      .update({ is_active: newActive })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Failed to toggle schedule: ${error.message}` };
    }

    revalidatePath('/dashboard/schedule');
    return { success: true, message: 'Schedule updated', is_active: newActive };
  } catch (e) {
    return { success: false, message: `Error: ${toError(e).message}` };
  }
}

export async function deleteScheduleAction(id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Vui lòng đăng nhập.' };
    }

    const db = createServerClient();
    const d1db = await getD1();
    if (!d1db) throw new Error('D1 database binding not available');

    const { error } = await db
      .from('schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Failed to delete schedule: ${error.message}` };
    }

    revalidatePath('/dashboard/schedule');
    return { success: true, message: 'Schedule deleted' };
  } catch (e) {
    return { success: false, message: `Error: ${toError(e).message}` };
  }
}

export async function getSchedulesAction() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, schedules: [], message: 'Not authenticated' };
    }

    const db = createServerClient();
    const d1db = await getD1();
    if (!d1db) throw new Error('D1 database binding not available');

    const { data, error } = await db
      .from('schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, schedules: [], message: `Failed to load schedules: ${error.message}` };
    }

    const schedules = (data as unknown) as Schedule[];
    return { success: true, schedules: schedules ?? [] };
  } catch (e) {
    return { success: false, schedules: [], message: `Error: ${toError(e).message}` };
  }
}
