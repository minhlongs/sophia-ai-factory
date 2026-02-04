#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */


/**
 * Health Check Script
 * Verifies the current configuration in .env.local
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Colors
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;

// Helper: Parse .env file manually (simple parser)
function parseEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const config = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      config[match[1].trim()] = value;
    }
  });
  return config;
}

async function fetchJson(url, headers = {}) {
  return new Promise((resolve) => {
    const req = https.request(url, { headers, method: 'GET' }, (res) => {
      resolve({ status: res.statusCode });
    });
    req.on('error', () => resolve({ status: 0 }));
    req.end();
  });
}

async function check() {
  console.log(cyan('\n🏥 Sophia AI Factory - Health Check'));
  console.log('===================================\n');

  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log(red('✘ .env.local not found. Run `npm run setup` first.'));
    process.exit(1);
  }

  const config = parseEnv(envPath);
  let allGood = true;

  const checks = [
    {
      name: 'OpenRouter',
      key: 'OPENROUTER_API_KEY',
      url: 'https://openrouter.ai/api/v1/auth/key',
      headers: (k) => ({ 'Authorization': `Bearer ${k}` })
    },
    {
      name: 'ElevenLabs',
      key: 'ELEVENLABS_API_KEY',
      url: 'https://api.elevenlabs.io/v1/user/subscription',
      headers: (k) => ({ 'xi-api-key': k })
    },
    {
      name: 'D-ID',
      key: 'DID_API_KEY',
      url: 'https://api.d-id.com/credits',
      headers: (k) => ({ 'Authorization': `Basic ${k}` }) // Basic Auth check
    },
    {
      name: 'Airtable',
      key: 'AIRTABLE_ACCESS_TOKEN',
      url: 'https://api.airtable.com/v0/meta/whoami',
      headers: (k) => ({ 'Authorization': `Bearer ${k}` })
    }
  ];

  for (const check of checks) {
    process.stdout.write(`Checking ${check.name}... `);
    const key = config[check.key];
    if (!key) {
      console.log(red('Missing Key'));
      allGood = false;
      continue;
    }

    const res = await fetchJson(check.url, check.headers(key));
    if (res.status === 200) {
      console.log(green('✔ OK'));
    } else {
      // Retry D-ID with Bearer if Basic failed
      if (check.name === 'D-ID' && res.status !== 200) {
          const res2 = await fetchJson(check.url, { 'Authorization': `Bearer ${key}` });
          if (res2.status === 200) {
              console.log(green('✔ OK'));
              continue;
          }
      }
      console.log(red(`✘ Failed (Status: ${res.status})`));
      allGood = false;
    }
  }

  console.log('\n');
  if (allGood) {
    console.log(green('✅ System Healthy. Ready to generate content.'));
    process.exit(0);
  } else {
    console.log(red('❌ Issues detected. Run `npm run setup` to reconfigure.'));
    process.exit(1);
  }
}

check();
