import { runIngestion } from '../src/lib/ingestion/runner'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function main() {
  console.log('🚀 Starting Manual Ingestion...')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const networks = process.argv.slice(2)
  const targetNetworks = networks.length > 0 ? networks : ['clickbank', 'shareasale']

  console.log(`Target networks: ${targetNetworks.join(', ')}`)

  try {
    const results = await runIngestion(targetNetworks)
    console.log('✅ Ingestion Complete!')
    console.log(JSON.stringify(results, null, 2))
  } catch (error) {
    console.error('❌ Ingestion Failed:', error)
    process.exit(1)
  }
}

main()
