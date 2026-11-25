/**
 * Pure policy builders, CLI arg validators, email validators, and Zero Trust
 * readback assertions for the Private Beta invitation provisioner.
 *
 * Enforces exact email format, preserves operator emails alongside the invited
 * customer email, and blocks wildcards, Everyone, Bypass, extra policies, and
 * non-email selectors on Cloudflare Access App `11a89148-d86e-4d3e-a1d4-e12edbeb6f75`.
 */

export const PILOT_CF_ACCOUNT_ID = 'f691e83094f776311a1bfe3f8b126f1c';
export const PILOT_ACCESS_APP_ID = '11a89148-d86e-4d3e-a1d4-e12edbeb6f75';
export const PILOT_ACCESS_POLICY_ID = '5ad49a50-b19a-4cc9-a43d-d2455e92fa42';
export const PILOT_BASE_URL = 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev';
export const DEFAULT_PILOT_OPERATOR_EMAILS = Object.freeze([
  'billwill.mentor@gmail.com',
  'minhlong.rice@gmail.com',
]);

const STRICT_EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

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

export function parseInviteCliArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const unknownFlags = args.filter((a) => String(a).startsWith('-') && a !== '--dry-run');
  if (unknownFlags.length > 0) {
    throw new Error(`Unknown CLI flag(s): ${unknownFlags.join(', ')}`);
  }
  const positional = args.filter((a) => !String(a).startsWith('-'));
  if (positional.length !== 1) {
    throw new Error('Expected exactly 1 invited customer email argument.');
  }
  return {
    dryRun: args.includes('--dry-run'),
    email: validateSinglePilotEmail(positional[0]),
  };
}

export function resolveAuthorizedPilotEmails(customerEmail, operatorEmailsOverride) {
  const validCustomer = validateSinglePilotEmail(customerEmail);
  const envOperators = process.env.PILOT_OPERATOR_EMAILS?.trim();
  const rawOperators =
    operatorEmailsOverride !== undefined
      ? operatorEmailsOverride
      : envOperators
        ? envOperators
        : DEFAULT_PILOT_OPERATOR_EMAILS;

  const operatorEntries = Array.isArray(rawOperators)
    ? rawOperators
    : String(rawOperators)
        .split(/[,\n;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);

  const deduped = [];
  const seen = new Set();
  for (const entry of [...operatorEntries, validCustomer]) {
    const validated = validateSinglePilotEmail(entry);
    if (!seen.has(validated)) {
      seen.add(validated);
      deduped.push(validated);
    }
  }
  return deduped;
}

export function buildAccessSingleEmailPolicyPayload(email, options = {}) {
  const authorizedEmails = resolveAuthorizedPilotEmails(email, options.operatorEmails);
  return {
    name: 'Sophia Pilot Authorized Emails',
    decision: 'allow',
    include: authorizedEmails.map((item) => ({ email: { email: item } })),
    exclude: [],
    require: [],
    precedence: 1,
  };
}

export function assertAccessPoliciesSafeAndExact(policies, expectedEmailsOrCustomer) {
  if (!Array.isArray(policies) || policies.length === 0) {
    throw new Error('Cloudflare Access readback returned zero policies.');
  }
  for (const pol of policies) {
    if (!pol || typeof pol !== 'object') {
      throw new Error('Malformed Access policy object in readback.');
    }
    if (pol.decision === 'bypass' || pol.decision === 'non_identity') {
      throw new Error(`Forbidden Access decision "${pol.decision}" detected on policy ${pol.id}.`);
    }
    for (const rule of pol.include ?? []) {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        throw new Error(`Malformed include rule detected on Access policy ${pol.id}.`);
      }
      if ('everyone' in rule || 'email_domain' in rule || 'any_valid_service_token' in rule) {
        throw new Error(`Forbidden broad include rule detected on Access policy ${pol.id}.`);
      }
      if (
        Object.keys(rule).length !== 1 ||
        !rule.email ||
        typeof rule.email !== 'object' ||
        Object.keys(rule.email).length !== 1
      ) {
        throw new Error(`Forbidden non-email include selector detected on Access policy ${pol.id}.`);
      }
    }
  }
  if (policies.length !== 1 || policies[0]?.id !== PILOT_ACCESS_POLICY_ID) {
    throw new Error(
      `Expected exclusively target Access policy ${PILOT_ACCESS_POLICY_ID}, found ${policies.length} policy(ies).`,
    );
  }
  const target = policies[0];
  if ((target.require ?? []).length > 0 || (target.exclude ?? []).length > 0) {
    throw new Error('Target Access policy must not carry unexpected require/exclude rules.');
  }
  const expectedEmails = Array.isArray(expectedEmailsOrCustomer)
    ? Array.from(new Set(expectedEmailsOrCustomer.map((item) => validateSinglePilotEmail(item))))
    : resolveAuthorizedPilotEmails(expectedEmailsOrCustomer);

  if (
    target.decision !== 'allow' ||
    !Array.isArray(target.include) ||
    target.include.length !== expectedEmails.length
  ) {
    throw new Error(
      `Target Access policy must be decision="allow" with exactly ${expectedEmails.length} exact email rule(s).`,
    );
  }
  const actualEmails = target.include.map((rule) =>
    validateSinglePilotEmail(rule.email.email),
  );
  const expectedSorted = [...expectedEmails].sort().join(',');
  const actualSorted = [...actualEmails].sort().join(',');
  if (actualSorted !== expectedSorted) {
    throw new Error(
      `Access policy readback mismatch: expected "${expectedSorted}", got "${actualSorted}".`,
    );
  }
}

export function buildCustomerUrlsAndVietnameseInvite(email) {
  const validEmail = validateSinglePilotEmail(email);
  const registerUrl = `${PILOT_BASE_URL}/vi/register?next=/vi/dashboard/first-value`;
  const loginUrl = `${PILOT_BASE_URL}/vi/login?next=/vi/dashboard/first-value`;
  const workspaceUrl = `${PILOT_BASE_URL}/vi/dashboard/first-value`;
  const inviteVi = [
    'Chào bạn,',
    '',
    `Mời bạn trải nghiệm riêng Sophia AI Factory (Private Beta 7 ngày — $0 phí nền tảng, tối đa 20 lượt tạo kịch bản AI thật) dành riêng cho email ${validEmail}.`,
    '',
    `1. Mở liên kết đăng ký / bắt đầu: ${registerUrl}`,
    `   (Nếu đã tạo mật khẩu trước đó, đăng nhập tại: ${loginUrl})`,
    `2. Trên màn hình bảo mật Cloudflare Access, bấm nút "GitHub" để vào thẳng 1 chạm (nếu tài khoản GitHub của bạn dùng đúng email ${validEmail}), hoặc nhập ${validEmail} vào ô bên dưới để nhận mã PIN 6 số.`,
    '3. Tạo tài khoản Sophia bằng đúng email được mời, tick đồng ý điều khoản Private Beta.',
    '4. Tại mục số 1, dán khóa OpenRouter của bạn (sk-or-v1-...) và bấm "Xác thực & Lưu khóa" (khóa được mã hóa AES-256-GCM, bạn có thể xóa bất cứ lúc nào).',
    '5. Nhập chủ đề + đối tượng khách hàng -> bấm "Tạo kịch bản AI thật" -> chỉnh sửa phân cảnh, lưu nháp, xuất Markdown/JSON và gửi góp ý ngay trên trang.',
    '',
    'Cần hỗ trợ hoặc xóa toàn bộ dữ liệu thử nghiệm: gửi trực tiếp tại khung "Yêu cầu Hỗ trợ & Xóa dữ liệu" ở cuối trang làm việc để nhận mã biên nhận xử lý trong 72 giờ.',
  ].join('\n');
  return { registerUrl, loginUrl, workspaceUrl, inviteVi };
}
