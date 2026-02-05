/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const fs = require('fs');
const path = require('path');

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const optionalEnvVars = [
  'OPENROUTER_API_KEY',
  'ELEVENLABS_API_KEY',
  'HEYGEN_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'NEXT_PUBLIC_APP_URL'
];

function verifyEnv() {
  console.log('🔍 Verifying environment configuration...');

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    console.warn('⚠️  Warning: The following required environment variables are missing:');
    missingVars.forEach(v => console.warn(`   - ${v}`));
    console.warn('   The application may not function correctly without these.');
    console.warn('   Copy .env.example to .env.local and fill in the values.');
  } else {
    console.log('✅ Required environment variables present.');
  }

  // Check optional vars
  const missingOptional = optionalEnvVars.filter(envVar => !process.env[envVar]);
  if (missingOptional.length > 0) {
    console.log('ℹ️  Optional environment variables missing (using mocks/defaults):');
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
