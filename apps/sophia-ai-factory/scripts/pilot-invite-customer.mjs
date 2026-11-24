#!/usr/bin/env node
/**
 * Operator-only Single-Customer Invitation Provisioner (Section IX).
 *
 * Accepts ONE exact invited email, rejects wildcards / lists / Everyone / Bypass,
 * updates BOTH:
 *   1. Cloudflare Access App `11a89148-d86e-4d3e-a1d4-e12edbeb6f75`
 *      Policy `5ad49a50-b19a-4cc9-a43d-d2455e92fa42`
 *   2. Pilot Worker secret `PILOT_ALLOWED_EMAILS` (`wrangler.pilot.toml`)
 * and verifies both configurations by readback without sending any external message.
 *
 * Usage:
 *   node scripts/pilot-invite-customer.mjs <exact-email> [--dry-run]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PILOT_CF_ACCOUNT_ID = 'f691e83094f776311a1bfe3f8b126f1c';
export const PILOT_ACCESS_APP_ID = '11a89148-d86e-4d3e-a1d4-e12edbeb6f75';
export const PILOT_ACCESS_POLICY_ID = '5ad49a50-b19a-4cc9-a43d-d2455e92fa42';
export const PILOT_BASE_URL = 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev';
const STRICT_EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function validateSinglePilotEmail(raw) {
  const trimmed = String(raw ?? '').trim().toLowerCase();
  if (!trimmed) throw new Error('Invited customer email is required.');
  if (/[,\s;<>()]/.test(trimmed)) {
    throw new Error('Only a single exact email is allowed (lists and display names are forbidden).');
  }
  if (trimmed.includes('*') || trimmed.startsWith('@') || trimmed === 'everyone' || trimmed === 'bypass') {
    throw new Error('Wildcard domains, Everyone, and public Bypass are strictly forbidden.');
  }
  if (!STRICT_EMAIL_RE.test(trimmed)) {
    throw new Error(`Invalid email format: "${trimmed}".`);
  }
  return trimmed;
}

export function buildAccessSingleEmailPolicyPayload(email) {
  const validEmail = validateSinglePilotEmail(email);
  return {
    name: 'Sophia Pilot Single Customer Allowlist',
    decision: 'allow',
    include: [{ email: { email: validEmail } }],
    exclude: [],
    require: [],
    precedence: 1,
  };
}

export function assertAccessPoliciesSafeAndExact(policies, expectedEmail) {
  if (!Array.isArray(policies) || policies.length === 0) {
    throw new Error('Cloudflare Access readback returned zero policies.');
  }
  for (const pol of policies) {
    if (pol.decision === 'bypass' || pol.decision === 'non_identity') {
      throw new Error(`Forbidden Access decision "${pol.decision}" detected on policy ${pol.id}.`);
    }
    for (const rule of pol.include ?? []) {
      if ('everyone' in rule || 'email_domain' in rule || 'any_valid_service_token' in rule) {
        throw new Error(`Forbidden broad include rule detected on Access policy ${pol.id}.`);
      }
    }
  }
  const target = policies.find((p) => p.id === PILOT_ACCESS_POLICY_ID);
  if (!target) {
    throw new Error(`Target Access policy ${PILOT_ACCESS_POLICY_ID} missing in readback.`);
  }
  if (target.decision !== 'allow' || !Array.isArray(target.include) || target.include.length !== 1) {
    throw new Error('Target Access policy must be decision="allow" with exactly 1 include rule.');
  }
  const actualEmail = String(target.include[0]?.email?.email ?? '').toLowerCase();
  if (actualEmail !== expectedEmail) {
    throw new Error(`Access policy readback mismatch: expected "${expectedEmail}", got "${actualEmail}".`);
  }
}

export function buildCustomerUrlsAndVietnameseInvite(email) {
  const registerUrl = `${PILOT_BASE_URL}/vi/register?next=/vi/dashboard/first-value`;
  const loginUrl = `${PILOT_BASE_URL}/vi/login?next=/vi/dashboard/first-value`;
  const workspaceUrl = `${PILOT_BASE_URL}/vi/dashboard/first-value`;
  const inviteVi = [
    'Chào bạn,',
    '',
    `Mời bạn trải nghiệm riêng Sophia AI Factory (Private Beta 7 ngày — $0 phí nền tảng, tối đa 20 lượt tạo kịch bản AI thật) dành riêng cho email ${email}.`,
    '',
    `1. Mở liên kết đăng ký / bắt đầu: ${registerUrl}`,
    `   (Nếu đã tạo mật khẩu trước đó, đăng nhập tại: ${loginUrl})`,
    '2. Nhập mã xác thực OTP gửi tới email của bạn trên màn hình bảo mật Cloudflare Access.',
    '3. Tạo tài khoản Sophia bằng đúng email được mời, tick đồng ý điều khoản Private Beta.',
    '4. Tại mục số 1, dán khóa OpenRouter của bạn (sk-or-v1-...) và bấm "Xác thực & Lưu khóa" (khóa được mã hóa AES-256-GCM, bạn có thể xóa bất cứ lúc nào).',
    '5. Nhập chủ đề + đối tượng khách hàng -> bấm "Tạo kịch bản AI thật" -> chỉnh sửa phân cảnh, lưu nháp, xuất Markdown/JSON và gửi góp ý ngay trên trang.',
    '',
    'Cần hỗ trợ hoặc xóa toàn bộ dữ liệu thử nghiệm: gửi trực tiếp tại khung "Yêu cầu Hỗ trợ & Xóa dữ liệu" ở cuối trang làm việc để nhận mã biên nhận xử lý trong 72 giờ.',
  ].join('\n');
  return { registerUrl, loginUrl, workspaceUrl, inviteVi };
}

function resolveAccessToken() {
  if (process.env.CLOUDFLARE_ACCESS_TOKEN?.trim()) {
    return process.env.CLOUDFLARE_ACCESS_TOKEN.trim();
  }
  const tokenPath = join(homedir(), '.config', 'sophia-pilot-cf-token');
  if (existsSync(tokenPath)) {
    const val = readFileSync(tokenPath, 'utf8').trim();
    if (val) return val;
  }
  throw new Error('Missing Cloudflare Access token (set CLOUDFLARE_ACCESS_TOKEN or ~/.config/sophia-pilot-cf-token).');
}

async function cfAccessRequest(token, method, path, body) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${PILOT_CF_ACCOUNT_ID}/access/apps/${PILOT_ACCESS_APP_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(`Cloudflare Access ${method} ${path} failed (HTTP ${res.status}).`);
  }
  return json.result;
}

function updateAndVerifyWorkerAllowlistSecret(email) {
  const env = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_WORKER_API_TOKEN ?? '',
  };
  execFileSync('npx', ['wrangler', 'secret', 'put', 'PILOT_ALLOWED_EMAILS', '--config', 'wrangler.pilot.toml'], {
    input: `${email}\n`,
    encoding: 'utf8',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const listRaw = execFileSync(
    'npx',
    ['wrangler', 'secret', 'list', '--config', 'wrangler.pilot.toml', '--format', 'json'],
    { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const secrets = JSON.parse(listRaw);
  if (!Array.isArray(secrets) || !secrets.some((s) => s?.name === 'PILOT_ALLOWED_EMAILS')) {
    throw new Error('Worker secret readback failed: PILOT_ALLOWED_EMAILS not found on sophia-ai-factory-pilot.');
  }
}

async function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const emailArg = argv.find((a) => !a.startsWith('--'));
  const email = validateSinglePilotEmail(emailArg);
  const payload = buildAccessSingleEmailPolicyPayload(email);
  const bundle = buildCustomerUrlsAndVietnameseInvite(email);

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({ mode: 'dry-run', email, accessPolicyPayload: payload, ...bundle }, null, 2)}\n`);
    return;
  }

  const token = resolveAccessToken();
  await cfAccessRequest(token, 'PUT', `/policies/${PILOT_ACCESS_POLICY_ID}`, payload);
  const policiesAfter = await cfAccessRequest(token, 'GET', '/policies');
  assertAccessPoliciesSafeAndExact(policiesAfter, email);
  updateAndVerifyWorkerAllowlistSecret(email);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        email,
        accessVerified: true,
        workerSecretVerified: true,
        ...bundle,
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`[pilot-invite-customer] ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
