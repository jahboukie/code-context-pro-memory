# Stripe Payment Links - Fallback System

## Create Payment Links in Stripe Dashboard:

### Early Adopter - $99/month
1. Go to Stripe Dashboard > Payment Links
2. Create new link:
   - Product: "CodeContext Memory Pro - Early Adopter"
   - Price: $99/month recurring
   - Success URL: https://codecontext-memory-pro.web.app/manual-success
   - Cancel URL: https://codecontext-memory-pro.web.app/cancel

### Test - $7.99/month  
1. Create another link:
   - Product: "CodeContext Memory Pro - Test"
   - Price: $7.99/month recurring
   - Success URL: https://codecontext-memory-pro.web.app/manual-success
   - Cancel URL: https://codecontext-memory-pro.web.app/cancel

### Standard - $199/month
1. Create another link:
   - Product: "CodeContext Memory Pro - Standard"  
   - Price: $199/month recurring
   - Success URL: https://codecontext-memory-pro.web.app/manual-success
   - Cancel URL: https://codecontext-memory-pro.web.app/cancel

## Manual Process:
1. User clicks payment link
2. Completes payment in Stripe
3. Gets redirected to manual-success page with email capture
4. You receive email with transaction details
5. You generate license key manually
6. Send license key via email

## Backup Email Capture:
If Stripe completely fails, use simple email capture with instructions to email you directly.