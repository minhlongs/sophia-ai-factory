/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const fs = require('fs');
const path = require('path');

const requiredEnvVars = [
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID',
];

const optionalEnvVars = [
  'N8N_WEBHOOK_GENERATE_SCRIPT',
  'N8N_WEBHOOK_PUBLISH_VIDEO',
  'NEXT_PUBLIC_FEATURE_AFFILIATE_ENGINE',
  'NEXT_PUBLIC_FEATURE_ADMIN_DASHBOARD'
];

function verifyEnv() {
  console.log('🔍 Verifying environment configuration...');

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    console.warn('⚠️  Warning: The following required environment variables are missing:');
    missingVars.forEach(v => console.warn(`   - ${v}`));
    console.warn('   The application may not function correctly without these.');
    console.warn('   Copy .env.local.example to .env.local and fill in the values.');
  } else {
    console.log('✅ Required environment variables present.');
  }

  // Check optional vars
  const missingOptional = optionalEnvVars.filter(envVar => !process.env[envVar]);
  if (missingOptional.length > 0) {
    console.log('ℹ️  Optional environment variables missing (using defaults):');
    missingOptional.forEach(v => console.log(`   - ${v}`));
  }
}

// Run verification if executed directly
if (require.main === module) {
  // Load .env.local if present
  try {
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const dotenv = require('dotenv');
      dotenv.config({ path: envLocalPath });
    }
  } catch (e) {
    // dotenv might not be installed in production, rely on system env
  }
  verifyEnv();
}

module.exports = verifyEnv;
