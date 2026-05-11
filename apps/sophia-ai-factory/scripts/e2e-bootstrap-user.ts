/**
 * One-shot bootstrap script for the E2E test user.
 *
 * Idempotent: if the user already exists, we just verify sign-in works.
 *
 * Usage:
 *   # Local dev (defaults)
 *   E2E_TEST_USER_PASSWORD='<strong-pw>' \
 *     npx tsx scripts/e2e-bootstrap-user.ts
 *
 *   # Remote (production / preview)
 *   PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network \
 *   E2E_TEST_USER_PASSWORD='<strong-pw>' \
 *     npx tsx scripts/e2e-bootstrap-user.ts
 *
 * Output: a single line `E2E_TEST_USER_EMAIL=...` ready to export to your
 * shell or paste into `.env.test`. Password stays in your shell history — do
 * NOT commit it.
 *
 * Failure modes:
 *   - HTTP 422 with "User already exists" → script verifies sign-in still
 *     works, exits 0. (Safe to re-run.)
 *   - HTTP 5xx → upstream Better Auth or D1 issue; script exits 1.
 */

const DEFAULT_EMAIL = 'e2e-master@sophia.test'
const DEFAULT_BASE = 'http://localhost:3000'

async function main(): Promise<void> {
  const email = process.env.E2E_TEST_USER_EMAIL ?? DEFAULT_EMAIL
  const password = process.env.E2E_TEST_USER_PASSWORD
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? DEFAULT_BASE

  if (!password) {
    console.error(
      'ERROR: E2E_TEST_USER_PASSWORD env var is required.\n' +
        '  Pick a strong password (12+ chars), export it, and re-run.',
    )
    process.exit(1)
  }

  console.log(`Bootstrapping E2E test user at ${baseURL}…`)
  console.log(`  email: ${email}`)

  const signupResp = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name: 'E2E Master User',
    }),
  })

  if (signupResp.ok) {
    console.log(`✅ User created.`)
  } else {
    const body = await signupResp.text().catch(() => '<no body>')
    const already = /already.*exists|in.use|duplicate/i.test(body)
    if (!already) {
      console.error(`❌ Signup failed: HTTP ${signupResp.status} — ${body.slice(0, 300)}`)
      process.exit(1)
    }
    console.log(`ℹ️  User already exists — verifying sign-in…`)
  }

  // Verify sign-in works
  const signinResp = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!signinResp.ok) {
    const body = await signinResp.text().catch(() => '<no body>')
    console.error(
      `❌ Sign-in verification failed: HTTP ${signinResp.status} — ${body.slice(0, 300)}\n` +
        '   Did you use the same password the user was created with?',
    )
    process.exit(1)
  }

  console.log(`✅ Sign-in verified.`)
  console.log()
  console.log('Add the following to .env.test (or export in your shell):')
  console.log(`  E2E_TEST_USER_EMAIL=${email}`)
  console.log(`  E2E_TEST_USER_PASSWORD=<the password you just provided>`)
}

main().catch((err) => {
  console.error('Unexpected failure:', err)
  process.exit(1)
})
