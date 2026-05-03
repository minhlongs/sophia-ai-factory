/**
 * /dashboard/orders — Customer order status page.
 * Server component: initial fetch, then SWR polling via OrderCard for in-flight rows.
 * Auth required — redirects to login if not authenticated.
 *
 * @module app/[locale]/dashboard/orders/page
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getUserOrders } from '@/land/orders/order-query'
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

  const [t, user] = await Promise.all([
    getTranslations('dashboard.orders_empty'),
    getCurrentUser(),
  ])
  if (!user) redirect(`/${locale}/login`)

  const isVi = locale.startsWith('vi')
  const orders = await getUserOrders(user.id)

  const title = isVi ? 'Đơn Hàng Của Tôi' : 'My Orders'
  const subtitle = isVi
    ? 'Theo dõi trạng thái video từ gói một lần của bạn'
    : 'Track your one-time bundle video render status'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg rounded-xl p-10 flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <ShoppingBag className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('title')}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t('desc')}</p>
          </div>
          <Link
            href="/pricing"
            className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors duration-150"
          >
            {t('cta')}
          </Link>
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
