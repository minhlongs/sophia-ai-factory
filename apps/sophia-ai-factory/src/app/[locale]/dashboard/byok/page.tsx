/**
 * BYOK (Bring Your Own Key) Dashboard Page — Phase 8C.
 *
 * Lets solo founders store their own OpenRouter / Anthropic / ElevenLabs / D-ID keys
 * instead of relying on the platform's fallback keys. Stored encrypted-at-rest via
 * 4G-BYOK crypto; resolver short-circuits automatically when BYOK_ENABLED=1 and a
 * row exists for this user.
 *
 * Server Component: fetches current provider list server-side then hands to the
 * client form. Plaintext keys never cross this boundary.
 */

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/better-auth-session'
import { listUserApiKeyProviders } from '@/lib/byok/user-api-key-store'
import { ByokKeyForm } from '@/components/byok/byok-key-form'

export const dynamic = 'force-dynamic'

export default async function ByokPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const configured = await listUserApiKeyProviders(user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Provider API Keys / Khóa API Nhà Cung Cấp</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Store your own provider keys (OpenRouter, Anthropic, ElevenLabs, D-ID).
          Keys are encrypted at rest and never shown again after save.
          <br />
          Lưu khóa API riêng của bạn. Khóa được mã hóa và không hiển thị lại sau khi lưu.
        </p>
      </div>

      <ByokKeyForm configured={configured} />
    </div>
  )
}
