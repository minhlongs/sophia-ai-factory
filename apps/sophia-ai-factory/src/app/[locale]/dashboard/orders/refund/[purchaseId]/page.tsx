/**
 * /dashboard/orders/refund/[purchaseId] — Customer refund request form.
 * Auth required. Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/orders/refund/[purchaseId]/page
 */

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { RefundRequestForm } from './refund-request-form'

interface Props {
  params: Promise<{ locale: string; purchaseId: string }>
}

export const metadata = {
  title: 'Request Refund | Sophia AI',
}

export default async function RefundRequestPage({ params }: Props) {
  const { locale, purchaseId } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)

  const isVi = locale.startsWith('vi')

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Yêu Cầu Hoàn Tiền' : 'Request a Refund'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Điền thông tin bên dưới. Đội ngũ sẽ xem xét trong vòng 24 giờ làm việc.'
            : 'Fill in the form below. Our team will review within 24 business hours.'}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-xs text-zinc-500 mb-4 font-mono">
          {isVi ? 'Đơn hàng' : 'Order'}: <span className="text-zinc-300">{purchaseId}</span>
        </p>
        <RefundRequestForm purchaseId={purchaseId} locale={locale} />
      </div>

      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
        <p className="text-xs text-amber-400">
          {isVi
            ? '⚠️ Lưu ý: Chúng tôi dùng USDT (TRC20) để hoàn tiền. Vui lòng cung cấp địa chỉ ví TRC20 chính xác. Hoàn tiền crypto là không thể đảo ngược.'
            : '⚠️ Note: Refunds are processed in USDT (TRC20). Please provide your TRC20 wallet address carefully. Crypto transfers are irreversible.'}
        </p>
      </div>
    </div>
  )
}
