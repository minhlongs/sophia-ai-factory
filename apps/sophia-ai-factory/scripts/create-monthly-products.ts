#!/usr/bin/env npx tsx
/**
 * Create Monthly Maintenance Subscription Products on Polar
 * These are recurring products for ongoing service fees
 */

const ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN || 'polar_oat_Xu1CyntlLy9aDe7ymtGwSkmyKozlO1TRkd52F4evsY8';

interface PolarProduct {
  name: string;
  id: string;
  prices: Array<{ price_amount?: number; recurring_interval?: string }>;
}

async function main() {
  console.log('🚀 Creating Monthly Maintenance Products\n');

  // List existing products
  const response = await fetch('https://api.polar.sh/v1/products/?limit=20', {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  console.log('📦 Existing products:');
  data.items?.forEach((p: PolarProduct) => {
    const price = p.prices[0]?.price_amount ? p.prices[0].price_amount / 100 : 0;
    const interval = p.prices[0]?.recurring_interval || 'one-time';
    console.log(`  - ${p.name}: $${price} (${interval}) ID: ${p.id}`);
  });

  // Create monthly maintenance products
  const monthlyProducts = [
    { name: 'Starter Monthly', price: 9900, tier: 'basic' },     // $99/month
    { name: 'Growth Monthly', price: 19900, tier: 'pro' },       // $199/month
    { name: 'Premium Monthly', price: 49900, tier: 'enterprise' } // $499/month
  ];

  console.log('\n✨ Creating monthly subscription products...\n');

  for (const product of monthlyProducts) {
    // Check if already exists
    const exists = data.items?.some((p: PolarProduct) => p.name === product.name);
    if (exists) {
      console.log(`⏭️  ${product.name} already exists, skipping`);
      continue;
    }

    const createResponse = await fetch('https://api.polar.sh/v1/products/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: product.name,
        description: `Monthly maintenance plan - ${product.tier} tier`,
        recurring_interval: 'month',
        prices: [{
          amount_type: 'fixed',
          price_amount: product.price,
          price_currency: 'usd',
          recurring_interval: 'month',
        }],
      }),
    });

    const result = await createResponse.json();
    
    if (createResponse.status === 201) {
      console.log(`✅ ${product.name}: $${product.price / 100}/month`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Add to .env: NEXT_PUBLIC_POLAR_${product.tier.toUpperCase()}_MONTHLY=${result.id}\n`);
    } else {
      console.log(`❌ Failed to create ${product.name}:`, result);
    }
  }

  console.log('\n🎉 Done! Don\'t forget to:');
  console.log('1. Add the monthly product IDs to .env.local');
  console.log('2. Run: supabase db push (to apply migration)');
  console.log('3. Update webhook endpoint in Polar dashboard');
}

main().catch(console.error);
