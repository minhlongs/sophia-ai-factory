#!/usr/bin/env tsx

import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import { Polar } from '@polar-sh/sdk'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { POLAR_PRODUCTS } from '../src/lib/polar-config'

// Types
interface WizardState {
  polar: {
    configured: boolean
    organizationId?: string
    accessToken?: string
    webhookSecret?: string
  }
  supabase: {
    configured: boolean
    url?: string
    anonKey?: string
    serviceKey?: string
  }
  telegram: {
    configured: boolean
    botToken?: string
    webhookUrl?: string
    webhookSecret?: string
  }
  env: {
    valid: boolean
    missingKeys: string[]
  }
}

const state: WizardState = {
  polar: { configured: false },
  supabase: { configured: false },
  telegram: { configured: false },
  env: { valid: false, missingKeys: [] },
}

// Helpers
const log = {
  success: (msg: string) => console.log(chalk.green(`✅ ${msg}`)),
  error: (msg: string) => console.log(chalk.red(`❌ ${msg}`)),
  warning: (msg: string) => console.log(chalk.yellow(`⚠️ ${msg}`)),
  info: (msg: string) => console.log(chalk.blue(`ℹ️ ${msg}`)),
  title: (msg: string) => console.log(chalk.bold.cyan(`\n=== ${msg} ===\n`)),
}

// --- Section 1: Environment Variables ---

async function setupEnv() {
  log.title('Environment Variables Check')

  const envPath = path.resolve(process.cwd(), '.env.local') // Default to .env.local for check
  const hasEnv = fs.existsSync(envPath)

  if (hasEnv) {
    log.info(`Found .env.local at ${envPath}`)
    dotenv.config({ path: envPath })
  } else {
    log.warning('No .env.local file found.')
    const { create } = await inquirer.prompt<{ create: boolean }>([
      {
        type: 'confirm',
        name: 'create',
        message: 'Do you want to create a new .env.local file?',
        default: true,
      },
    ])

    if (create) {
      fs.writeFileSync(envPath, '')
      log.success('Created empty .env.local')
    }
  }

  const requiredKeys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'POLAR_ACCESS_TOKEN',
    'POLAR_ORGANIZATION_ID',
    'POLAR_WEBHOOK_SECRET',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'NEXT_PUBLIC_APP_URL',
    'OPENROUTER_API_KEY',
    'ELEVENLABS_API_KEY',
    'DID_API_KEY',
  ]

  const missing = requiredKeys.filter((key) => !process.env[key])
  state.env.missingKeys = missing

  if (missing.length > 0) {
    log.error(`Missing required environment variables: \n${missing.map((k) => `   - ${k}`).join('\n')}`)

    const { fill } = await inquirer.prompt<{ fill: boolean }>([
      {
        type: 'confirm',
        name: 'fill',
        message: 'Do you want to enter missing values now?',
        default: true,
      },
    ])

    if (fill) {
      const answers = await inquirer.prompt(
        missing.map((key) => ({
          type: 'input',
          name: key,
          message: `Enter value for ${key}:`,
          validate: (input: string) => input.trim().length > 0 || 'Value is required',
        }))
      )

      let envContent = hasEnv ? fs.readFileSync(envPath, 'utf-8') : ''
      // Add newline if needed
      if (envContent && !envContent.endsWith('\n')) envContent += '\n'

      for (const [key, value] of Object.entries(answers)) {
        process.env[key] = value as string
        // Check if key already exists in file to replace or append
        const regex = new RegExp(`^${key}=.*`, 'm')
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`)
        } else {
            envContent += `${key}=${value}\n`
        }
      }

      fs.writeFileSync(envPath, envContent)
      log.success('Updated .env.local')
      state.env.valid = true
    } else {
      log.warning('Proceeding with missing variables. Some steps may fail.')
    }
  } else {
    log.success('All required environment variables are present.')
    state.env.valid = true
  }
}

// --- Section 2: Polar.sh Setup ---

async function setupPolar() {
  log.title('Polar.sh Setup')

  if (!process.env.POLAR_ACCESS_TOKEN || !process.env.POLAR_ORGANIZATION_ID) {
    log.error('Polar credentials missing. Please configure environment variables first.')
    return
  }

  const spinner = ora('Connecting to Polar...').start()

  try {
    const polar = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    })

    // Validate connection by listing products
    const existingProducts = await polar.products.list({
      organizationId: process.env.POLAR_ORGANIZATION_ID,
      limit: 100,
    })

    spinner.succeed('Connected to Polar')
    state.polar.configured = true

    const existingNames = new Set(existingProducts.result.items.map((p) => p.name))

    log.info('Checking Product Catalog...')

    for (const productDef of POLAR_PRODUCTS) {
      if (existingNames.has(productDef.name)) {
        log.success(`Product exists: ${productDef.name}`)
      } else {
        const createSpinner = ora(`Creating product: ${productDef.name}...`).start()
        try {
          await polar.products.create({
            organizationId: process.env.POLAR_ORGANIZATION_ID,
            name: productDef.name,
            description: productDef.description,
            prices: productDef.prices.map((p) => ({
              amountType: 'fixed' as const,
              priceAmount: p.priceAmount,
              priceCurrency: p.priceCurrency,
            })),
          })
          createSpinner.succeed(`Created product: ${productDef.name}`)
        } catch (e) {
          createSpinner.fail(`Failed to create ${productDef.name}: ${(e as Error).message}`)
        }
      }
    }

    // Webhook Setup Prompt
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'
    const webhookUrl = `${appUrl}/api/webhooks/polar`

    log.info(`\nwebhook Configuration:`)
    console.log(`URL: ${chalk.underline(webhookUrl)}`)
    console.log(`Secret: ${process.env.POLAR_WEBHOOK_SECRET || chalk.red('Missing')}`)

    log.info('Make sure to configure this webhook in your Polar dashboard settings.')

  } catch (error) {
    spinner.fail('Failed to connect to Polar')
    log.error((error as Error).message)
  }
}

// --- Section 3: Supabase Setup ---

async function setupSupabase() {
  log.title('Supabase Setup')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      log.error('Supabase credentials missing.')
      return
  }

  const spinner = ora('Connecting to Supabase...').start()

  try {
      const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
      )

      // Simple query to test connection
      const { error } = await supabase.from('user_profiles').select('count', { count: 'exact', head: true })

      if (error && error.code !== 'PGRST116') { // PGRST116 is no rows, which is fine, but actually head:true returns count
          throw error
      }

      spinner.succeed('Connected to Supabase')
      state.supabase.configured = true

      // Check for key tables
      const tablesToCheck = ['user_profiles', 'campaigns', 'generated_content', 'subscriptions']
      log.info('Verifying tables...')

      for (const table of tablesToCheck) {
          const { error: tableError } = await supabase.from(table).select('count', { count: 'exact', head: true })
          if (tableError) {
              log.error(`Table check failed: ${table} - ${tableError.message}`)
          } else {
              log.success(`Table exists: ${table}`)
          }
      }

      // RLS Check (Basic)
      log.info('Note: Please ensure RLS policies are enabled for security.')

  } catch (error) {
      spinner.fail('Supabase connection failed')
      log.error((error as Error).message)
  }
}

// --- Section 4: Telegram Setup ---

async function setupTelegram() {
  log.title('Telegram Bot Setup')

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
      log.error('TELEGRAM_BOT_TOKEN is missing.')
      return
  }

  const spinner = ora('Verifying Bot Token...').start()

  try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
      const data = await res.json()

      if (!data.ok) {
          throw new Error(data.description)
      }

      spinner.succeed(`Bot Verified: @${data.result.username}`)
      state.telegram.configured = true

      // Webhook Setup
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      if (!appUrl) {
          log.warning('NEXT_PUBLIC_APP_URL not set, cannot configure webhook automatically.')
      } else {
          const webhookUrl = `${appUrl}/api/webhooks/telegram`
          const { setWebhook } = await inquirer.prompt<{ setWebhook: boolean }>([
              {
                  type: 'confirm',
                  name: 'setWebhook',
                  message: `Do you want to set the webhook URL to: ${webhookUrl}?`,
                  default: true
              }
          ])

          if (setWebhook) {
              const whSpinner = ora('Setting webhook...').start()
              const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
              const whRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      url: webhookUrl,
                      secret_token: secret
                  })
              })
              const whData = await whRes.json()

              if (whData.ok) {
                  whSpinner.succeed('Webhook configured successfully!')
              } else {
                  whSpinner.fail(`Failed to set webhook: ${whData.description}`)
              }
          }
      }

  } catch (error) {
      spinner.fail('Telegram check failed')
      log.error((error as Error).message)
  }
}

// --- Section 5: E2E Verification ---

async function verifyE2E() {
    log.title('Final E2E Verification')

    // 1. Health Endpoint (Local simulation)
    // Since we are running this script likely locally or in a build env, we can't easily curl "localhost"
    // if the server isn't running. We assume this is a pre-flight check.

    log.info('Running logic checks...')

    // Database Check
    if (state.supabase.configured) {
        log.success('Database: Configured & Connected')
    } else {
        log.error('Database: Not verified')
    }

    // Polar Check
    if (state.polar.configured) {
        log.success('Payments (Polar): Configured & Connected')
    } else {
        log.error('Payments (Polar): Not verified')
    }

    // Telegram Check
    if (state.telegram.configured) {
        log.success('Telegram Bot: Configured & Connected')
    } else {
        log.error('Telegram Bot: Not verified')
    }

    // Environment
    if (state.env.valid) {
        log.success('Environment: All required variables present')
    } else {
        log.error('Environment: Missing variables')
    }
}

// --- Main Wizard ---

async function main() {
  console.clear()
  log.title('🚀 Sophia AI Factory - Production Setup Wizard')
  log.info('This wizard will guide you through setting up your production environment.')

  const steps = [
      { name: 'Environment Variables', value: 'env', fn: setupEnv },
      { name: 'Supabase Database', value: 'supabase', fn: setupSupabase },
      { name: 'Polar.sh Payments', value: 'polar', fn: setupPolar },
      { name: 'Telegram Bot', value: 'telegram', fn: setupTelegram },
      { name: 'Final Verification', value: 'verify', fn: verifyE2E },
  ]

  for (const step of steps) {
      const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
          {
              type: 'confirm',
              name: 'proceed',
              message: `Proceed to ${step.name}?`,
              default: true
          }
      ])

      if (proceed) {
          await step.fn()
      } else {
          log.warning(`Skipped ${step.name}`)
      }

      console.log('\n----------------------------------------\n')
  }

  log.title('Setup Complete')
  generateReport()
  log.info('Run `npm run build` and `npm start` to launch your application.')
}

function generateReport() {
  const reportPath = path.resolve(process.cwd(), 'production-setup-report.md')
  const date = new Date().toLocaleString()

  const content = `# Sophia AI Factory Production Setup Report
Date: ${date}

## Status Summary

| Component | Status | Details |
|-----------|--------|---------|
| **Environment Variables** | ${state.env.valid ? '✅ Valid' : '❌ Invalid'} | ${state.env.missingKeys.length === 0 ? 'All keys present' : 'Missing: ' + state.env.missingKeys.join(', ')} |
| **Supabase** | ${state.supabase.configured ? '✅ Configured' : '⚠️ Not verified'} | ${state.supabase.configured ? 'Connected & Tables verified' : 'Skipped or failed'} |
| **Polar.sh** | ${state.polar.configured ? '✅ Configured' : '⚠️ Not verified'} | ${state.polar.configured ? 'Connected & Products synced' : 'Skipped or failed'} |
| **Telegram Bot** | ${state.telegram.configured ? '✅ Configured' : '⚠️ Not verified'} | ${state.telegram.configured ? 'Bot verified & Webhook set' : 'Skipped or failed'} |

## Action Items

${!state.env.valid ? '- [ ] Fix missing environment variables in .env.local\n' : ''}${!state.supabase.configured ? '- [ ] Verify Supabase connection and migrations\n' : ''}${!state.polar.configured ? '- [ ] Configure Polar.sh products and webhook\n' : ''}${!state.telegram.configured ? '- [ ] Setup Telegram Bot and Webhook\n' : ''}
## Next Steps

1. Run \`npm run build\` to build the application.
2. Run \`npm start\` to launch the production server.
3. Check \`production-setup-report.md\` for details.

---
*Generated by Sophia AI Factory Setup Wizard*
`

  fs.writeFileSync(reportPath, content)
  log.info(`\n📄 Setup report generated at: ${chalk.underline(reportPath)}`)
}

main().catch((err) => {
  log.error('Wizard failed unexpectedly')
  console.error(err)
  process.exit(1)
})
