/**
 * /dashboard/orders — Customer order status page.
 * Server component: initial fetch, then SWR polling via OrderCard for in-flight rows.
 * Auth required — redirects to login if not authenticated.
 *
 * @module app/[locale]/dashboard/orders/page
 */

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/better-auth-session'
import { getUserOrders } from '@/lib/orders/order-query'
import { OrderCard } from './order-card'
import { ShoppingBag } from 'lucide-react'

interface OrdersPageProps {
  params: Promise<{ locale: string }>
}

export const metadata = {
  title: 'Orders | Sophia AI',
  description: 'Track the status of your one-time bundle purchases',
}

export default async function OrdersPage({ params }: OrdersPageProps) {
  const { locale } = await params
  const isVi = locale.startsWith('vi')

  const user = await getCurrentUser()
  if (!user) {
    redirect(`/${locale}/login`)
  }

  const orders = await getUserOrders(user.id)

  const title = isVi ? 'Đơn Hàng Của Tôi' : 'My Orders'
  const subtitle = isVi
    ? 'Theo dõi trạng thái video từ gói một lần của bạn'
    : 'Track your one-time bundle video render status'
  const emptyText = isVi
    ? 'Bạn chưa có đơn hàng nào. Hãy mua gói để bắt đầu!'
    : 'No orders yet. Purchase a bundle to get started!'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{title}</h1>
        <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingBag className="w-12 h-12 text-zinc-600 mb-4" />
          <p className="text-zinc-500">{emptyText}</p>
          <a
            href="/pricing"
            className="mt-4 inline-block px-5 py-2 bg-violet-700 hover:bg-violet-600 text-white rounded-lg text-sm transition-colors"
          >
            {isVi ? 'Xem gói giá' : 'View pricing'}
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {orders.map((order) => (
            <OrderCard
              key={order.purchaseId}
              purchaseId={order.purchaseId}
              initialOrder={order}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  )
}
