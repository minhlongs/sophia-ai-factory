const { chromium } = require('playwright');

const routes = [
  { path: '/', expect: 200 },
  { path: '/login', expect: 200 },
  { path: '/pricing', expect: 200 },
  { path: '/blog', expect: 200 },
  { path: '/guide', expect: 200 },
  { path: '/signup', expect: 308 },
  { path: '/register', expect: 307 },
  { path: '/sign-up', expect: 307 },
  { path: '/signin', expect: 307 },
  { path: '/settings', expect: 308 },
  { path: '/settings/security', expect: 307 },
  { path: '/settings/security/mfa', expect: 200 },
  { path: '/chat', expect: 307 },
  { path: '/templates', expect: 307 },
  { path: '/debug', expect: 307 },
  { path: '/app', expect: 307 },
  { path: '/docs', expect: 307 },
  { path: '/support', expect: 307 },
  { path: '/faq', expect: 307 },
  { path: '/help', expect: 307 },
  { path: '/about', expect: 307 },
  { path: '/contact', expect: 307 },
  { path: '/terms', expect: 307 },
  { path: '/privacy', expect: 307 },
  { path: '/status', expect: 307 },
  { path: '/dashboard', expect: 307 },
  { path: '/setup-wizard', expect: 307 },
  { path: '/api/health', expect: 200 },
  { path: '/api/version', expect: 200 },
  { path: '/payment-success', expect: 200 },
  { path: '/affiliate-discovery', expect: 200 },
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  let passed = 0, failed = 0, notfound = 0;

  for (const { path, expect: expected } of routes) {
    const url = `https://sophia.agencyos.network${path}`;
    const res = await ctx.request.get(url, { maxRedirects: 0 });
    const status = res.status();
    const ok = status === expected;

    if (ok) passed++;
    else if (status === 404) { notfound++; failed++; }
    else failed++;

    const icon = ok ? '✅' : status === 404 ? '🔴' : '⚠️';
    console.log(`${icon} ${path} → ${status}${ok ? '' : ` (expected ${expected})`}`);
    await res.dispose();
  }

  await browser.close();

  console.log(`\n───\nPassed: ${passed}/${routes.length} | 404s: ${notfound} | Failed: ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
