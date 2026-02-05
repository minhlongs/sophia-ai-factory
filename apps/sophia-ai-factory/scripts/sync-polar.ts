import { Polar } from '@polar-sh/sdk'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN
const POLAR_ORGANIZATION_ID = process.env.POLAR_ORGANIZATION_ID

if (!POLAR_ACCESS_TOKEN) {
  console.error('Error: POLAR_ACCESS_TOKEN is missing in .env.local')
  process.exit(1)
}

if (!POLAR_ORGANIZATION_ID) {
  console.error('Error: POLAR_ORGANIZATION_ID is missing in .env.local')
  process.exit(1)
}

const polar = new Polar({
  accessToken: POLAR_ACCESS_TOKEN,
  server: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
})

const PRODUCTS = [
  {
    name: 'Sophia AI Factory - Starter',
    description: 'Perfect for getting started with AI video automation.',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 120000, // $1,200.00
        priceCurrency: 'usd',
      },
    ],
  },
  {
    name: 'Sophia AI Factory - Growth',
    description: 'Scale your content production with advanced features.',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 200000, // $2,000.00
        priceCurrency: 'usd',
      },
    ],
  },
  {
    name: 'Sophia AI Factory - Premium',
    description: 'Maximum power and support for enterprise needs.',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 300000, // $3,000.00
        priceCurrency: 'usd',
      },
    ],
  },
] as const

async function main() {
  console.log(`🔌 Connecting to Polar (${process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'})...`)
  console.log(`🏢 Organization ID: ${POLAR_ORGANIZATION_ID}`)

  try {
    // 1. Fetch existing products to avoid duplicates
    console.log('🔍 Checking existing products...')
    const existingProducts = await polar.products.list({
      organizationId: POLAR_ORGANIZATION_ID!,
      limit: 100,
    })

    const existingNames = new Set(existingProducts.result.items.map((p) => p.name))

    // 2. Create missing products
    for (const productDef of PRODUCTS) {
      if (existingNames.has(productDef.name)) {
        console.log(`✅ Product already exists: "${productDef.name}"`)
        const product = existingProducts.result.items.find(p => p.name === productDef.name)
        if (product) {
            console.log(`   ID: ${product.id}`)
        }
        continue
      }

      console.log(`✨ Creating product: "${productDef.name}"...`)

      try {
        const product = await polar.products.create({
          organizationId: POLAR_ORGANIZATION_ID!,
          name: productDef.name,
          description: productDef.description,
          prices: productDef.prices.map(p => ({
            amountType: 'fixed',
            priceAmount: p.priceAmount,
            priceCurrency: p.priceCurrency,
          }))
        })
        console.log(`   ✅ Created! ID: ${product.id}`)
      } catch (createError: unknown) {
        const errorMessage = createError instanceof Error ? createError.message : String(createError)
        console.error(`   ❌ Failed to create "${productDef.name}":`, errorMessage)
      }
    }

    console.log('\n🎉 Product provisioning complete!')

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ Script failed:', errorMessage)
    process.exit(1)
  }
}

main()
