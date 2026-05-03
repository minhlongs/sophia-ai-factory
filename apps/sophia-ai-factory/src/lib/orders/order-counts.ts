/**
 * Order count helpers for dashboard history link visibility.
 * @module orders/order-counts
 */

import { createServerClient } from '@/seed/db/client'

/**
 * Count completed orders for a user.
 * Used to conditionally show "View past orders" link.
 */
export async function countCompletedOrders(userId: string): Promise<number> {
  const db = createServerClient()
  const { data } = await db
    .from('pending_orders')
    .select('order_id')
    .eq('user_id', userId)
    .eq('status', 'completed')
  return Array.isArray(data) ? data.length : 0
}
