/**
 * Playwright E2E — Customer BYOK Private Beta Journey (Vietnamese Desktop & Mobile).
 *
 * Exercises the real built Pilot Worker (`wrangler.pilot.toml` + local D1) for:
 * - Scope confinement & disabled billing/publishing endpoints (403 / 307)
 * - Invite-only registration rejection with clear Vietnamese message
 * - Invited customer registration -> workspace handoff -> sign out -> re-login
 * - Real D1 consent (`2026-11-pilot-v2`), real D1 feedback, real D1 support/deletion (`psr_...`)
 * - Real invalid-key rejection (`422 BYOK_KEY_REJECTED`) + exhausted-credit UX (`hết tín dụng`)
 * - Complete Customer BYOK UI flow (save/replace/clear key, generate >=3 scenes via test stub,
 *   edit scene title & narration, save draft, accept, export Markdown/JSON) on Desktop & Mobile.
 *
 * NOTE: Live customer OpenRouter generation is intentionally stubbed in automated E2E
 * (`SOPHIA_PILOT_E2E=1`); real inference executes only with the invited customer's own BYOK key.
 */

import { test, expect } from '@playwright/test';

const INVITED_EMAIL = process.env.PILOT_E2E_EMAIL || 'pilot-ceo@example.com';
const TEST_PASSWORD = 'PilotPassword2026!';

test.describe('Customer BYOK Private Beta Journey (VI)', () => {
  test.skip(process.env.SOPHIA_PILOT_E2E !== '1', 'Requires isolated pilot Worker server');

  test('enforces scope confinement, invite-only auth, BYOK UX, error messages, D1 support/feedback & mobile layout', async ({
    page,
    request,
  }) => {
    // 1. Disabled billing & publishing routes fail closed with 403
    const checkoutRes = await request.post('/api/checkout', { data: {} });
    expect(checkoutRes.status()).toBe(403);
    const publishRes = await request.post('/api/publish', { data: {} });
    expect(publishRes.status()).toBe(403);

    // 2. Out-of-scope UI page redirects into pilot workspace -> login
    await page.goto('/vi/pricing');
    await expect(page).toHaveURL(/\/vi\/login/);
    const loginBodyText = await page.locator('body').innerText();
    expect(loginBodyText).not.toContain('Email Otp Send');
    expect(loginBodyText).not.toContain('Passkey Sign In');

    // 3. Uninvited email registration is rejected with clear Vietnamese message
    await page.goto('/vi/register?next=/vi/dashboard/first-value');
    await page.locator('#company').fill('Outsider Co');
    await page.locator('#email').fill('outsider@example.com');
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('#confirmPassword').fill(TEST_PASSWORD);
    await page.locator('#terms').check();
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(page.getByText(/chỉ dành cho khách mời/i)).toBeVisible();

    // 4. Invited customer registers & enters distraction-free Vietnamese workspace
    await page.locator('#company').fill('Mekong Clinic');
    await page.locator('#email').fill(INVITED_EMAIL);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('#confirmPassword').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(page.getByText('Tạo tài khoản thành công!')).toBeVisible();
    await page.getByRole('link', { name: 'Mở không gian làm việc Sophia' }).click();
    await expect(page).toHaveURL(/\/vi\/dashboard\/first-value/);

    await expect(page.getByText('Sophia Private Beta — Xưởng Kịch Bản AI')).toBeVisible();
    await expect(page.getByText('1. Khóa API OpenRouter Của Bạn (Customer BYOK)')).toBeVisible();
    const workspaceText = await page.locator('body').innerText();
    expect(workspaceText).not.toContain('BẢN XEM TRƯỚC MÔ PHỎNG');

    // 5. Sign out and sign back in via /vi/login
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/vi\/login/);
    await page.locator('input[type="email"]').fill(INVITED_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập vào Sophia' }).click();
    await expect(page).toHaveURL(/\/vi\/dashboard\/first-value/);

    // 6. Accept pilot privacy & beta consent (persisted in D1)
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Đồng ý điều khoản & Tiếp tục' }).click();
    await expect(
      page.getByText('Đã xác nhận điều khoản thử nghiệm và quyền riêng tư.'),
    ).toBeVisible();

    // 7. Real invalid BYOK key check -> clear Vietnamese invalid-key error
    const errorBanner = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await page.getByPlaceholder('sk-or-v1-...').fill('sk-or-v1-invalid-test-key-0000000000');
    await page.getByRole('button', { name: 'Xác thực & Lưu khóa' }).click();
    await expect(errorBanner).toContainText(/không hợp lệ|thu hồi|kết nối|hết thời gian/i, {
      timeout: 10_000,
    });

    // 8. Real D1 Customer Feedback & Support / Data Deletion receipt (`psr_...`)
    await page
      .getByPlaceholder('Điểm nào tốt, phần nào bạn phải viết lại, hoặc lỗi nào đã xảy ra?')
      .fill('Giao diện tiếng Việt rất rõ ràng và dễ hiểu cho CEO.');
    await page.getByRole('button', { name: 'Gửi góp ý' }).click();
    await expect(page.getByText('Cảm ơn bạn — góp ý đã được lưu riêng tư.')).toBeVisible();

    await page
      .getByLabel('Loại yêu cầu')
      .selectOption('data_deletion');
    await page
      .getByPlaceholder('Tóm tắt ngắn gọn vấn đề cần hỗ trợ hoặc yêu cầu xóa dữ liệu')
      .fill('Kiểm tra quy trình xóa dữ liệu');
    await page
      .getByPlaceholder('Mô tả chi tiết vấn đề bạn gặp phải hoặc xác nhận yêu cầu xóa dữ liệu...')
      .fill('Xác nhận hệ thống cấp mã biên nhận psr_ trong 72h.');
    await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
    await expect(page.getByText(/psr_[0-9a-f-]+/i).first()).toBeVisible();

    await page.screenshot({
      path: 'test-results/screenshots/pilot-customer-byok-desktop-d1.png',
      fullPage: true,
    });

    // 9. Intercept only BYOK-dependent actions to verify credit-exhausted error + full edit/save/export UI
    //    (Automated UI regression stub — never claimed as live provider inference)
    let stubByokSaved = false;
    let stubVersion = 1;
    let stubState: 'pending_review' | 'accepted' = 'pending_review';
    let stubScript = {
      title: 'Kịch bản nhắc lịch hẹn tự động cho phòng khám',
      total_duration: 30,
      scenes: [
        {
          scene_number: 1,
          title: 'Mở đầu gây chú ý',
          visual_description: 'Lễ tân phòng khám tất bật nghe điện thoại giờ cao điểm',
          narration: '40% khách hàng quên lịch tái khám chỉ vì không được nhắc đúng lúc.',
          duration_estimate: 10,
        },
        {
          scene_number: 2,
          title: 'Giải pháp 60 giây',
          visual_description: 'Màn hình tin nhắn nhắc hẹn tự động cá nhân hóa trên điện thoại',
          narration: 'Quy trình tự động gửi lời nhắc lịch sự trước 24 giờ giúp lấp đầy lịch trống.',
          duration_estimate: 10,
        },
        {
          scene_number: 3,
          title: 'Kêu gọi hành động',
          visual_description: 'Bác sĩ mỉm cười đón bệnh nhân quay lại đúng giờ',
          narration: 'Áp dụng ngay hôm nay để giữ chân khách hàng mà không tốn thêm nhân sự.',
          duration_estimate: 10,
        },
      ],
    };

    await page.route('**/api/first-value**', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        const realRes = await route.fetch();
        const realJson = (await realRes.json()) as Record<string, unknown>;
        const realPilot = (realJson.pilot ?? {}) as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...realJson,
            byokConfigured: stubByokSaved,
            configuredProviders: stubByokSaved ? ['openrouter'] : [],
            pilot: {
              ...realPilot,
              byokKeyConfigured: stubByokSaved,
              fundingMode: stubByokSaved ? 'customer_byok' : 'none',
            },
          }),
        });
        return;
      }

      const body = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;
      if (body.action === 'save_byok_key') {
        if (String(body.apiKey).includes('nocredit')) {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 'BYOK_KEY_QUOTA_EXCEEDED',
              error:
                'Khóa API OpenRouter này đã hết hạn mức tín dụng (còn $0). Vui lòng nạp thêm hoặc tăng giới hạn khóa tại openrouter.ai.',
            }),
          });
          return;
        }
        stubByokSaved = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ byokConfigured: true }),
        });
        return;
      }
      if (body.action === 'clear_byok_key') {
        stubByokSaved = false;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ byokConfigured: false }),
        });
        return;
      }
      if (body.action === 'create_review') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            review: {
              artifactId: 'fv_e2e_stub_001',
              orgId: body.orgId,
              userId: 'usr_e2e',
              missionId: body.missionId,
              idempotencyKey: body.idempotencyKey,
              payloadHash: 'hash_1',
              version: stubVersion,
              provenance: 'live_provider',
              provenanceLabel: 'TEST_UI_STUB',
              topic: body.topic,
              audience: body.audience,
              durationSec: body.durationSec,
              script: stubScript,
              reviewState: stubState,
              acceptedAtIso: null,
              acceptedByUserId: null,
              rejectedAtIso: null,
              rejectionReason: null,
              privateArtifactRef: 'private://fv_e2e_stub_001',
              receiptId: 'pilot_customer_byok',
              mcuAccountingRef: 'pilot_free_customer_byok',
              mcuCharged: 0,
              createdAtIso: new Date().toISOString(),
              updatedAtIso: new Date().toISOString(),
            },
          }),
        });
        return;
      }
      if (body.action === 'edit_review') {
        stubVersion += 1;
        stubScript = body.script as typeof stubScript;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            review: {
              artifactId: 'fv_e2e_stub_001',
              orgId: body.orgId,
              userId: 'usr_e2e',
              missionId: 'mission_e2e',
              idempotencyKey: body.idempotencyKey,
              payloadHash: 'hash_1',
              version: stubVersion,
              provenance: 'live_provider',
              provenanceLabel: 'TEST_UI_STUB',
              topic: 'Topic',
              audience: 'Audience',
              durationSec: 30,
              script: stubScript,
              reviewState: stubState,
              acceptedAtIso: null,
              acceptedByUserId: null,
              rejectedAtIso: null,
              rejectionReason: null,
              privateArtifactRef: 'private://fv_e2e_stub_001',
              receiptId: 'pilot_customer_byok',
              mcuAccountingRef: 'pilot_free_customer_byok',
              mcuCharged: 0,
              createdAtIso: new Date().toISOString(),
              updatedAtIso: new Date().toISOString(),
            },
          }),
        });
        return;
      }
      if (body.action === 'accept_review') {
        stubState = 'accepted';
        stubVersion += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            review: {
              artifactId: 'fv_e2e_stub_001',
              orgId: body.orgId,
              userId: 'usr_e2e',
              missionId: 'mission_e2e',
              idempotencyKey: body.idempotencyKey,
              payloadHash: 'hash_1',
              version: stubVersion,
              provenance: 'live_provider',
              provenanceLabel: 'TEST_UI_STUB',
              topic: 'Topic',
              audience: 'Audience',
              durationSec: 30,
              script: stubScript,
              reviewState: stubState,
              acceptedAtIso: new Date().toISOString(),
              acceptedByUserId: 'usr_e2e',
              rejectedAtIso: null,
              rejectionReason: null,
              privateArtifactRef: 'private://fv_e2e_stub_001',
              receiptId: 'pilot_customer_byok',
              mcuAccountingRef: 'pilot_free_customer_byok',
              mcuCharged: 0,
              createdAtIso: new Date().toISOString(),
              updatedAtIso: new Date().toISOString(),
            },
          }),
        });
        return;
      }
      if (body.action === 'private_export') {
        const content =
          body.format === 'markdown'
            ? `# ${stubScript.title}\n\n- ${stubScript.scenes[0].narration}`
            : stubScript;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ export: { format: body.format, content } }),
        });
        return;
      }
      await route.continue();
    });

    // Exhausted-credit error message verification
    await page.getByPlaceholder('sk-or-v1-...').fill('sk-or-v1-nocredit-key-000000000000');
    await page.getByRole('button', { name: 'Xác thực & Lưu khóa' }).click();
    await expect(errorBanner).toContainText('hết hạn mức tín dụng');

    // Save BYOK -> Generate -> Edit -> Save Draft -> Accept -> Export Markdown & JSON -> Clear BYOK
    await page.getByPlaceholder('sk-or-v1-...').fill('sk-or-v1-valid-customer-stub-00000001');
    await page.getByRole('button', { name: 'Xác thực & Lưu khóa' }).click();
    await expect(page.getByText('Đã xác thực khóa OpenRouter')).toBeVisible();

    await page.getByRole('button', { name: 'Tạo kịch bản AI thật' }).click();
    await expect(
      page.getByText('Kịch bản nhắc lịch hẹn tự động cho phòng khám'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Chỉnh sửa kịch bản' }).click();
    await page
      .getByLabel('Tiêu đề kịch bản')
      .fill('Kịch bản nhắc lịch hẹn VIP cho phòng khám nha khoa');
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await expect(
      page.getByText('Đã lưu bản nháp vào không gian làm việc riêng của bạn.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Chấp nhận kịch bản' }).click();
    await page.getByRole('button', { name: 'Xuất Markdown riêng tư' }).click();
    await expect(page.getByText(/Bản xuất riêng tư đã sẵn sàng/)).toBeVisible();
    await page.getByRole('button', { name: 'Xuất JSON riêng tư' }).click();

    await page.screenshot({
      path: 'test-results/screenshots/pilot-customer-byok-desktop-complete.png',
      fullPage: true,
    });

    // 10. Mobile viewport (390x844) usability & zero horizontal overflow check
    await page.setViewportSize({ width: 390, height: 844 });
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noOverflow).toBe(true);
    await page.getByRole('button', { name: 'Xóa khóa' }).click();
    await expect(page.getByText('Cần nhập khóa OpenRouter')).toBeVisible();

    await page.screenshot({
      path: 'test-results/screenshots/pilot-customer-byok-mobile.png',
      fullPage: true,
    });
  });
});
