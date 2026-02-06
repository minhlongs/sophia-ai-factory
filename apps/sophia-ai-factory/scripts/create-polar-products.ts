#!/usr/bin/env npx tsx
/**
 * Polar Product Creation Script - Fixed Version
 */

const ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN || 'polar_oat_Xu1CyntlLy9aDe7ymtGwSkmyKozlO1TRkd52F4evsY8';

console.log('Token:', ACCESS_TOKEN.substring(0, 20) + '...');

async function main() {
  // Use fetch directly for debugging
  const response = await fetch('https://api.polar.sh/v1/products/?limit=10', {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (data.items && data.items.length > 0) {
    console.log('\n📦 Existing products:');
    data.items.forEach((p: { name: string; id: string; prices: Array<{ price_amount?: number }> }) => {
      const price = p.prices[0]?.price_amount ? p.prices[0].price_amount / 100 : 0;
      console.log(`  - ${p.name}: $${price} (ID: ${p.id})`);
    });
  }

  // Create Premium if it doesn't exist
  const hasPremium = data.items?.some((p: { name: string }) => p.name === 'Premium');
  if (!hasPremium) {
    console.log('\n✨ Creating Premium product...');
    const createResponse = await fetch('https://api.polar.sh/v1/products/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Premium',
        description: 'Maximum power and support for enterprise needs.',
        prices: [{
          amount_type: 'fixed',
          price_amount: 300000,
          price_currency: 'usd',
        }],
      }),
    });
    console.log('Create status:', createResponse.status);
    const createData = await createResponse.json();
    console.log('Created:', JSON.stringify(createData, null, 2));
  }
}

main().catch(console.error);
