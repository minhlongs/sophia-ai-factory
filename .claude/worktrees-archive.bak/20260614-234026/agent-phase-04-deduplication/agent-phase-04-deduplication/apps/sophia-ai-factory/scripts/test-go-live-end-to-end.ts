#!/usr/bin/env tsx

/**
 * End-to-End Go-Live Test Script
 * Tests: Telegram → Discovery → Script Generation
 */

async function testEndToEnd() {
  console.log('🧪 Starting End-to-End Go-Live Test\n')

  // Test 1: Telegram Webhook
  console.log('1️⃣ Testing Telegram Webhook...')
  try {
    const telegramResponse = await fetch('http://localhost:3000/api/webhooks/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': process.env.TELEGRAM_WEBHOOK_SECRET || 'test'
      },
      body: JSON.stringify({
        message: {
          chat: { id: 12345 },
          text: '/discover health-fitness'
        }
      })
    })
    console.log(`   Status: ${telegramResponse.status}`)
    const telegramResult = await telegramResponse.json()
    console.log('   Result:', JSON.stringify(telegramResult, null, 2))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('   ❌ Telegram webhook test failed (server might not be running):', err.message)
  }

  // Test 2: Discovery API
  console.log('\n2️⃣ Testing Discovery API...')
  try {
    const discoveryResponse = await fetch('http://localhost:3000/api/discovery/top-50?hiddenGemsOnly=true')
    if (discoveryResponse.ok) {
        const { products } = await discoveryResponse.json()
        console.log(`   Found ${products?.length || 0} products`)
    } else {
        console.log(`   Failed with status: ${discoveryResponse.status}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('   ❌ Discovery API test failed:', err.message)
  }

  // Test 3: Integration Storage
  console.log('\n3️⃣ Testing Integration API...')
  console.log('   (Requires authentication - skipping automated test)')
  // In a real E2E we would login first or use a test token.

  console.log('\n✅ End-to-End Test Complete!')
}

testEndToEnd().catch(console.error)
