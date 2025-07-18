/**
 * Fallback Payment System - Add this to your landing page
 * Detects when Stripe checkout fails and shows payment links instead
 */

// Add this to your existing landing page JavaScript
function initFallbackSystem() {
  let checkoutAttempts = 0;
  
  // Enhanced purchaseLicense function with fallback
  window.purchaseLicenseWithFallback = async function(tier) {
    checkoutAttempts++;
    
    const email = prompt('Enter your email address:');
    if (!email) return;
    
    if (!email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      document.getElementById('loading').style.display = 'block';
      
      // Try the normal Stripe checkout first
      const response = await fetch('https://us-central1-codecontext-memory-pro.cloudfunctions.net/createCheckout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, tier: tier })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create checkout session');
      }

      // Normal checkout success
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error('No checkout URL returned');
      }
      
    } catch (error) {
      console.error('Stripe checkout failed:', error);
      document.getElementById('loading').style.display = 'none';
      
      // After 2 failed attempts or specific errors, show fallback
      if (checkoutAttempts >= 2 || isHighTrafficError(error)) {
        showFallbackPayment(tier, email);
      } else {
        showError(error.message || 'Failed to create checkout session. Please try again.');
      }
    }
  };
  
  function isHighTrafficError(error) {
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('timeout') || 
           errorMessage.includes('rate limit') || 
           errorMessage.includes('overload') ||
           errorMessage.includes('503') ||
           errorMessage.includes('502');
  }
  
  function showFallbackPayment(tier, email) {
    const fallbackModal = `
      <div id="fallback-modal" style="
        position: fixed; 
        top: 0; left: 0; right: 0; bottom: 0; 
        background: rgba(0,0,0,0.9); 
        z-index: 9999; 
        display: flex; 
        align-items: center; 
        justify-content: center;
      ">
        <div style="
          background: #1a1a2e; 
          border: 2px solid #00f5ff; 
          border-radius: 16px; 
          padding: 2rem; 
          max-width: 500px; 
          text-align: center;
        ">
          <h2 style="color: #ff0080; margin-bottom: 1rem;">🔥 High Traffic Detected!</h2>
          <p style="color: #ccc; margin-bottom: 2rem;">
            Due to overwhelming demand, we're using our backup payment system. 
            Your purchase will be processed manually within 1 hour.
          </p>
          
          <div style="margin-bottom: 2rem;">
            <strong style="color: #00f5ff;">Your Details:</strong><br>
            Email: ${email}<br>
            Tier: ${tier.replace('_', ' ').toUpperCase()}
          </div>
          
          <button onclick="proceedWithPaymentLink('${tier}')" style="
            background: linear-gradient(135deg, #00f5ff, #ff0080);
            border: none;
            padding: 1rem 2rem;
            border-radius: 8px;
            color: #fff;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            margin-right: 1rem;
          ">
            🚀 Proceed with Backup Payment
          </button>
          
          <button onclick="closeFallbackModal()" style="
            background: #333;
            border: 1px solid #555;
            padding: 1rem 2rem;
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
          ">
            Cancel
          </button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', fallbackModal);
  }
  
  // Payment link URLs
  const paymentLinks = {
    test: 'https://buy.stripe.com/5kQ5kD9UQ5Du8xo4P34Ja07',  // $7.99/month Test
    early_adopter: 'https://buy.stripe.com/bJe14naYU1ne00S95j4Ja06',  // $99/month Early Adopter
    standard: 'https://buy.stripe.com/3cI28rc2Yc1S14W5T74Ja08'  // $199/month Standard
  };
  
  window.proceedWithPaymentLink = function(tier) {
    // Store user info for the success page
    localStorage.setItem('fallbackPurchase', JSON.stringify({
      tier: tier,
      timestamp: Date.now()
    }));
    
    // Open payment link
    window.location.href = paymentLinks[tier] || paymentLinks.early_adopter;
  };
  
  window.closeFallbackModal = function() {
    const modal = document.getElementById('fallback-modal');
    if (modal) modal.remove();
  };
  
  // Email capture fallback (if Stripe is completely down)
  window.showEmailCapture = function(tier) {
    const emailForm = `
      <div id="email-capture" style="
        background: rgba(255, 0, 128, 0.1);
        border: 2px solid rgba(255, 0, 128, 0.5);
        border-radius: 12px;
        padding: 2rem;
        margin: 2rem 0;
        text-align: center;
      ">
        <h3 style="color: #ff0080; margin-bottom: 1rem;">⚡ Payment System Temporarily Overloaded</h3>
        <p style="color: #ccc; margin-bottom: 1rem;">
          Enter your email below and we'll send you a direct payment link within 15 minutes.
        </p>
        
        <form id="emergency-capture">
          <input type="email" placeholder="your@email.com" required style="
            padding: 1rem;
            margin-right: 1rem;
            border: 1px solid #333;
            border-radius: 6px;
            background: #1a1a2e;
            color: #fff;
            width: 250px;
          ">
          <button type="submit" style="
            background: linear-gradient(135deg, #00f5ff, #ff0080);
            border: none;
            padding: 1rem 2rem;
            border-radius: 6px;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
          ">
            Get Priority Access
          </button>
        </form>
      </div>
    `;
    
    const pricing = document.querySelector('.pricing-section');
    pricing.insertAdjacentHTML('beforeend', emailForm);
  };
}

// Initialize the fallback system
document.addEventListener('DOMContentLoaded', initFallbackSystem);