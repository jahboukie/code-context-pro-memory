// Test Stripe checkout creation in sandbox
const Stripe = require('stripe');

async function testStripeCheckout() {
  try {
    console.log('🧪 Testing Stripe checkout creation...');
    
    // Use actual Stripe test key from Firebase config
    const stripe = new Stripe('sk_test_51RYpXRELGHd3NbdJqB8gCHVpOWAYfH0hP9xbGhf3QA4jRpzV6Xh2vF3Yn9LDKM5X0qN2B8cP7YlQ9WtE6RmK3dUJ001VkT2APn', {
      apiVersion: '2022-08-01',
    });
    
    console.log('✅ Stripe initialized');
    
    // Test listing prices first
    const prices = await stripe.prices.list({ limit: 5 });
    console.log('📋 Available test prices:');
    prices.data.forEach(price => {
      console.log(`  - ${price.id}: $${price.unit_amount / 100} (${price.currency})`);
    });
    
    // Test creating a checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: 'test@example.com',
      payment_method_types: ['card'],
      line_items: [{
        price: 'price_1RleRhELGHd3NbdJarsIxKID', // $1.00 Hacker News Test
        quantity: 1,
      }],
      mode: 'payment', // One-time payment for testing
      success_url: 'https://codecontextpro.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://codecontextpro.com/cancel',
      metadata: {
        email: 'test@example.com',
        tier: 'hacker_news',
      },
    });
    
    console.log('\n✅ Checkout session created successfully!');
    console.log('Session ID:', session.id);
    console.log('Payment URL:', session.url);
    console.log('Customer Email:', session.customer_email);
    console.log('Mode:', session.mode);
    console.log('Metadata:', session.metadata);
    
    // Test retrieving the session
    const retrieved = await stripe.checkout.sessions.retrieve(session.id);
    console.log('\n🔍 Retrieved session verification:');
    console.log('Email match:', retrieved.customer_email === 'test@example.com');
    console.log('Tier match:', retrieved.metadata?.tier === 'hacker_news');
    console.log('Success URL correct:', retrieved.success_url.includes('codecontextpro.com'));
    
    console.log('\n🎯 Sandbox test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) console.error('Error code:', error.code);
  }
}

testStripeCheckout();