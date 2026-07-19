import { scoreAllProducts } from '../src/lib/intelligence/runner'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  console.log('🚀 Starting Manual Scoring...')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  try {
    const result = await scoreAllProducts()
    console.log('✅ Scoring Complete!')
    console.log(`Processed: ${result.total} products`)
  } catch (error) {
    console.error('❌ Scoring Failed:', error)
    process.exit(1)
  }
}

main()
