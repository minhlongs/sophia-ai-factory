#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */


/**
 * CLI Setup Script for Sophia AI Factory
 * Interactive wizard for headless/terminal setup.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');

// Colors for terminal
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

// --- Validation Functions (Re-implemented for Node.js CJS) ---

async function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function validateOpenRouter(key) {
  try {
    const res = await fetchJson('https://openrouter.ai/api/v1/auth/key', {
      'Authorization': `Bearer ${key}`
    });
    return res.status === 200;
  } catch (e) { return false; }
}

async function validateElevenLabs(key) {
  try {
    const res = await fetchJson('https://api.elevenlabs.io/v1/user/subscription', {
      'xi-api-key': key
    });
    return res.status === 200;
  } catch (e) { return false; }
}

async function validateDID(key) {
  try {
    const res = await fetchJson('https://api.d-id.com/credits', {
      'Authorization': `Basic ${key}`
    });
    if (res.status === 200) return true;
    // Try Bearer if Basic fails
    const res2 = await fetchJson('https://api.d-id.com/credits', {
        'Authorization': `Bearer ${key}`
    });
    return res2.status === 200;
  } catch (e) { return false; }
}

async function validateAirtable(key) {
  try {
    const res = await fetchJson('https://api.airtable.com/v0/meta/whoami', {
      'Authorization': `Bearer ${key}`
    });
    return res.status === 200;
  } catch (e) { return false; }
}

// --- Main Script ---

async function main() {
  console.log(cyan('\n🤖 Sophia AI Factory - CLI Setup Wizard'));
  console.log('========================================\n');

  const config = {};

  // 1. OpenRouter
  while (true) {
    const key = await ask(yellow('Enter OpenRouter API Key: '));
    process.stdout.write('Verifying... ');
    if (await validateOpenRouter(key)) {
      console.log(green('✔ Valid'));
      config.OPENROUTER_API_KEY = key;
      break;
    } else {
      console.log(red('✘ Invalid key, please try again.'));
    }
  }

  // 2. ElevenLabs
  while (true) {
    const key = await ask(yellow('Enter ElevenLabs API Key: '));
    process.stdout.write('Verifying... ');
    if (await validateElevenLabs(key)) {
      console.log(green('✔ Valid'));
      config.ELEVENLABS_API_KEY = key;
      break;
    } else {
      console.log(red('✘ Invalid key, please try again.'));
    }
  }

  // 3. D-ID
  while (true) {
    const key = await ask(yellow('Enter D-ID API Key: '));
    process.stdout.write('Verifying... ');
    if (await validateDID(key)) {
      console.log(green('✔ Valid'));
      config.DID_API_KEY = key;
      break;
    } else {
      console.log(red('✘ Invalid key, please try again.'));
    }
  }

  // 4. Airtable
  while (true) {
    const key = await ask(yellow('Enter Airtable PAT (Personal Access Token): '));
    process.stdout.write('Verifying... ');
    if (await validateAirtable(key)) {
      console.log(green('✔ Valid'));
      config.AIRTABLE_ACCESS_TOKEN = key;
      break;
    } else {
      console.log(red('✘ Invalid key, please try again.'));
    }
  }

  config.AIRTABLE_BASE_ID = await ask(yellow('Enter Airtable Base ID: '));
  config.NEXT_PUBLIC_IS_CONFIGURED = "true";

  // Write to .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';

  try {
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
  } catch(e) {}

  const lines = envContent.split('\n').filter(Boolean);
  const newKeys = Object.keys(config);

  // Remove existing keys from lines
  const finalLines = lines.filter(line => {
    const key = line.split('=')[0];
    return !newKeys.includes(key);
  });

  // Append new keys
  newKeys.forEach(key => {
    finalLines.push(`${key}="${config[key]}"`);
  });

  fs.writeFileSync(envPath, finalLines.join('\n') + '\n');

  console.log(green('\n✅ Configuration saved to .env.local'));
  console.log(cyan('Run `npm run dev` to start Sophia.\n'));

  rl.close();
}

main().catch(console.error);
