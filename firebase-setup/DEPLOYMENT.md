# 🔥 CodeContext Memory Pro - Firebase + Stripe Setup

## Prerequisites

1. **Firebase Project**
   ```bash
   # Install Firebase CLI
   npm install -g firebase-tools
   
   # Login to Firebase
   firebase login
   
   # Create new project or use existing
   firebase projects:create codecontext-memory-pro
   ```

2. **Stripe Account**
   - Create account at https://dashboard.stripe.com
   - Get API keys (test and live)
   - Set up webhook endpoint

## Deployment Steps

### 1. Firebase Configuration

```bash
# Navigate to firebase-setup directory
cd firebase-setup

# Initialize Firebase (if not already done)
firebase init

# Select:
# - Firestore
# - Functions  
# - Hosting

# Set project
firebase use codecontext-memory-pro
```

### 2. Environment Variables

```bash
# Set Stripe keys for Firebase Functions
firebase functions:config:set stripe.secret_key="sk_test_..."
firebase functions:config:set stripe.webhook_secret="whsec_..."

# For production, use live keys:
# firebase functions:config:set stripe.secret_key="sk_live_..."
```

### 3. Deploy Functions

```bash
cd functions
npm install
cd ..

# Deploy functions
firebase deploy --only functions
```

### 4. Deploy Hosting

```bash
# Update public/index.html with your Stripe publishable key
# Replace: pk_test_YOUR_PUBLISHABLE_KEY

firebase deploy --only hosting
```

### 5. Stripe Webhook Setup

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://YOUR-PROJECT.web.app/api/stripeWebhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

### 6. Initialize Database

```bash
# Create initial stats document
firebase firestore:write public/stats '{
  "earlyAdoptersSold": 0,
  "earlyAdopterLimit": 10000
}'
```

## API Endpoints

Once deployed, your API will be available at:

- `https://YOUR-PROJECT.web.app/api/getPricing` - Get current pricing
- `https://YOUR-PROJECT.web.app/api/createCheckout` - Create Stripe session  
- `https://YOUR-PROJECT.web.app/api/validateLicense` - Validate license
- `https://YOUR-PROJECT.web.app/api/reportUsage` - Report usage analytics
- `https://YOUR-PROJECT.web.app/api/stripeWebhook` - Stripe webhooks

## Testing

### Test Payment Flow

1. Visit your hosted site
2. Click "Get Early Adopter License"
3. Use Stripe test card: `4242 4242 4242 4242`
4. Complete checkout
5. Verify license created in Firestore

### Test CLI Integration

Update your CLI's FirebaseService to point to production endpoints:

```typescript
const API_BASE = 'https://codecontext-memory-pro.web.app/api';
```

## Production Checklist

- [ ] Switch to Stripe live keys
- [ ] Update webhook endpoint to production URL
- [ ] Set up custom domain (optional)
- [ ] Configure email service for license delivery
- [ ] Set up monitoring and alerts
- [ ] Add analytics tracking
- [ ] Test full purchase → activation flow

## Security Notes

- All sensitive Stripe operations happen server-side
- License validation requires both email + license key
- Usage analytics are license-gated
- Firestore rules prevent unauthorized access

## Cost Estimation

**Firebase (Spark Plan - Free)**
- Functions: 2M invocations/month
- Firestore: 50K reads, 20K writes/day
- Hosting: 10GB storage, 1GB transfer/day

**Stripe Fees**
- 2.9% + 30¢ per transaction
- Early adopter: $99 × 2.9% + $0.30 = $3.17 per sale
- Standard: $199 × 2.9% + $0.30 = $6.07 per sale

## Revenue Projections

**Early Adopter Phase (10,000 licenses)**
- Gross: $99 × 10,000 = $990,000
- Stripe fees: $31,700
- Net: $958,300

**Standard Phase (Monthly)**
- Per 1,000 subscribers: $199,000 gross
- Stripe fees: $6,070
- Net: $192,930

The memory revolution is ready to monetize! 🚀