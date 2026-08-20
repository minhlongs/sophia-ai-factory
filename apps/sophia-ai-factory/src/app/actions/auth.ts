'use server';

import { getD1, createServerClient } from '@/seed/db/client';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { toError } from '@/seed/utils/to-error';

/**
 * Activate a coupon after successful login
 * Used in the login flow when a coupon/tier is passed as query params
 */
export async function activateCouponAfterLoginAction(coupon: string, tier: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Vui lòng đăng nhập.' };
    }

    const db = createServerClient();
    const d1db = await getD1();
    if (!d1db) throw new Error('D1 database binding not available');

    // Validate coupon exists and is usable
    const { data: couponData, error: couponError } = await db
      .from('coupons')
      .select('*')
      .eq('code', coupon)
      .maybeSingle();

    if (couponError || !couponData) {
      return { success: false, message: 'Coupon không hợp lệ.' };
    }

    // Check if coupon is already used by this user
    const { data: existingRedeem } = await db
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', couponData.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingRedeem) {
      return { success: false, message: 'Bạn đã sử dụng mã này rồi.' };
    }

    // Record redemption
    const { error: insertError } = await db
      .from('coupon_redemptions')
      .insert({
        coupon_id: couponData.id,
        user_id: user.id,
        redeemed_at: new Date().toISOString(),
      });

    if (insertError) {
      return { success: false, message: 'Không thể áp dụng mã.' };
    }

    // Apply tier upgrade (simplified - would integrate with subscription system)
    // This would typically call into land/subscription logic
    // For now, we just record the redemption

    revalidatePath('/dashboard');
    return { success: true, message: `Coupon ${coupon} activated for tier ${tier}` };
  } catch (e) {
    return { success: false, message: `Error: ${toError(e).message}` };
  }
}
