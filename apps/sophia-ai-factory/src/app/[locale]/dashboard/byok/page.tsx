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
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store'
import { ByokKeyForm, type UserSettableProvider } from '@/forest/components/byok/byok-key-form'

export const dynamic = 'force-dynamic'

/** Providers user can manage in the admin UI (heygen is server-only). */
const USER_SETTABLE: UserSettableProvider[] = ['openrouter', 'anthropic', 'elevenlabs', 'd-id', 'muapi']

export default async function ByokPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const allConfigured = await listUserApiKeyProviders(user.id)
  // Filter to only user-settable providers (exclude server-managed ones like heygen)
  const configured = allConfigured.filter((p): p is UserSettableProvider =>
    USER_SETTABLE.includes(p as UserSettableProvider),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Provider API Keys / Khóa API Nhà Cung Cấp</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Store your own provider keys. Keys are encrypted at rest and never shown again after save.
          <br />
          Lưu khóa API riêng của bạn. Khóa được mã hóa và không hiển thị lại sau khi lưu.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          <li><span className="font-medium text-foreground">OpenRouter</span> — LLM models / Mô hình LLM <span className="text-orange-500">(required for workflows / bắt buộc cho workflows)</span></li>
          <li><span className="font-medium text-foreground">Anthropic</span> — Claude models <span className="text-muted-foreground">(optional fallback / dự phòng tùy chọn)</span></li>
          <li><span className="font-medium text-foreground">ElevenLabs</span> — Text-to-speech / Chuyển văn bản thành giọng nói <span className="text-orange-500">(required for audio)</span></li>
          <li><span className="font-medium text-foreground">D-ID</span> — Avatar video / Video avatar <span className="text-orange-500">(required for video)</span></li>
          <li><span className="font-medium text-foreground">MuAPI</span> — Background music / Nhạc nền <span className="text-muted-foreground">(optional / tùy chọn)</span></li>
        </ul>
      </div>

      <ByokKeyForm configured={configured} />
    </div>
  )
}
