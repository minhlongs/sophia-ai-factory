const fs = require('fs');
const path = require('path');

const BASE_DIR = '/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory';
const SRC_DIR = path.join(BASE_DIR, 'src');

// Phân tích chi tiết từng broken import
const brokenData = {
  "src/app/actions/billing": {
    count: 5,
    files: [
      "src/app/[locale]/dashboard/billing/refund/page.tsx",
      "src/app/[locale]/dashboard/billing/refund/refund-form-client.tsx",
      "src/components/billing/TierConfirmationModal.tsx",
      "src/components/billing/cancel-subscription-modal.tsx",
      "src/components/billing/change-tier-client.tsx"
    ],
    status: "MISSING",
    note: "File app/actions/billing không tồn tại. Có thể đã di chuyển sang land/billing/ server actions"
  },
  "src/components/stitch": {
    count: 13,
    files: [
      "src/components/stitch/screens/admin/admin-panel-page.tsx",
      "src/components/stitch/screens/affiliate-portal/affiliate-portal-page.tsx",
      "src/components/stitch/screens/affiliates/affiliates-page.tsx",
      "src/components/stitch/screens/auth/login-page.tsx",
      "src/components/stitch/screens/auth/register-page.tsx",
      "src/components/stitch/screens/checkout/checkout-page.tsx",
      "src/components/stitch/screens/dashboard/dashboard-page.tsx",
      "src/components/stitch/screens/payments/payments-page.tsx",
      "src/components/stitch/screens/pricing/pricing-page.tsx",
      "src/components/stitch/screens/products/products-page.tsx",
      "src/components/stitch/screens/settings/settings-page.tsx",
      "src/components/stitch/screens/subscribers/subscribers-page.tsx",
      "src/components/stitch/screens/webhook/webhook-page.tsx"
    ],
    status: "DIRECTORY_EXISTS",
    note: "Thư mục tồn tại và có index.ts, import hợp lệ. False positive từ script do bug logic check index"
  },
  "src/components/experiment-variant": {
    count: 2,
    files: [
      "src/forest/telemetry/experiments-registry.ts",
      "src/tree/signals/experiments-registry.ts"
    ],
    status: "MISSING",
    note: "Component không tồn tại"
  },
  "app/api/sdk/typescript/sophia": {
    count: 1,
    files: ["src/app/api/sdk/typescript/route.ts"],
    status: "MISSING",
    note: "File sophia.d.ts hoặc sophia.ts không tồn tại trong thư mục typescript"
  },
  "src/land/alerts/quota": {
    count: 1,
    files: ["src/land/alerts/quota-alert-service.ts"],
    status: "MISSING",
    note: "File quota.ts không tồn tại trong land/alerts/"
  },
  "src/land/video/publishing/token-crypto": {
    count: 1,
    files: ["src/land/video/publishing/oauth-token-refresher.ts"],
    status: "MISSING",
    note: "File token-crypto.ts không tồn tại"
  },
  "src/land/video/publishing/publisher-interface": {
    count: 1,
    files: ["src/land/video/publishing/oauth-token-refresher.ts"],
    status: "MISSING",
    note: "File publisher-interface.ts không tồn tại"
  },
  "src/sdk": {
    count: 1,
    files: ["src/sdk/index.ts"],
    status: "DIRECTORY_EXISTS",
    note: "Thư mục tồn tại và có index.ts, import hợp lệ. False positive"
  }
};

// Kiểm tra existence thực tế
console.log('🔍 PHÂN TÍCH BROKEN IMPORTS - SOPHIA AI FACTORY\n');
console.log('='.repeat(80) + '\n');

let realBroken = 0;
let falsePositives = 0;

for (const [key, data] of Object.entries(brokenData)) {
  const displayPath = key.startsWith('src/') ? key : key;
  const fullPath = path.join(SRC_DIR, displayPath);
  
  // Kiểm tra thực tế
  let exists = false;
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    exists = true;
  } else if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    // Check barrel index
    const indexTs = path.join(fullPath, 'index.ts');
    const indexJs = path.join(fullPath, 'index.js');
    if (fs.existsSync(indexTs) || fs.existsSync(indexJs)) {
      exists = true;
    }
  }
  
  const statusEmoji = exists ? '⚠️  FALSE POSITIVE' : '❌';
  if (exists) falsePositives += data.count;
  else realBroken += data.count;
  
  console.log(`${statusEmoji} ${key} (${data.count} imports)`);
  console.log(`   Files affected:`);
  data.files.forEach(f => console.log(`     - ${f}`));
  console.log(`   Status: ${data.status}`);
  console.log(`   Note: ${data.note}\n`);
}

console.log('='.repeat(80));
console.log('📊 TỔNG KẾT:\n');
console.log(`   Tổng imports bị báo cáo: 25`);
console.log(`   Real broken imports: ${realBroken}`);
console.log(`   False positives: ${falsePositives}`);
console.log(`\n   Files cần sửa thực tế:`);

// List files that need fixing (excluding false positives)
const filesNeedingFix = new Set();
for (const [key, data] of Object.entries(brokenData)) {
  const fullPath = path.join(SRC_DIR, key);
  let exists = false;
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) exists = true;
  else if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    const indexTs = path.join(fullPath, 'index.ts');
    const indexJs = path.join(fullPath, 'index.js');
    if (fs.existsSync(indexTs) || fs.existsSync(indexJs)) exists = true;
  }
  
  if (!exists) {
    data.files.forEach(f => filesNeedingFix.add(f));
  }
}

console.log(`   - ${filesNeedingFix.size} files cần sửa import paths\n`);

console.log('📋 DANH SÁCH FILE CẦN SỬA:\n');
filesNeedingFix.forEach(f => console.log(`   ${f}`));

console.log('\n' + '='.repeat(80));
console.log('✅ PHÂN TÍCH HOÀN TẤT\n');
