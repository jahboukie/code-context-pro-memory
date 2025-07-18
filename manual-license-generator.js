/**
 * Manual License Key Generator for CodeContext Memory Pro
 * Use this when Stripe automation fails during high traffic
 */

const crypto = require('crypto');

// License key generation (matches your existing system)
function generateLicenseKey(email, tier = 'early_adopter') {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const emailHash = crypto.createHash('sha256').update(email).digest('hex').substring(0, 8);
  
  // Format: CC-TIER-EMAIL-TIME-RANDOM
  const tierCode = {
    'test': 'TEST',
    'early_adopter': 'EARLY',
    'standard': 'STD'
  }[tier] || 'EARLY';
  
  const key = `CC-${tierCode}-${emailHash.toUpperCase()}-${timestamp.toString(36).toUpperCase()}-${random.toUpperCase()}`;
  
  return key;
}

// Generate license for manual processing
function generateManualLicense(email, tier, transactionId = null) {
  const licenseKey = generateLicenseKey(email, tier);
  const created = new Date().toISOString();
  
  const licenseData = {
    email,
    tier,
    licenseKey,
    transactionId,
    created,
    method: 'manual',
    status: 'active'
  };
  
  console.log('\n🔑 MANUAL LICENSE GENERATED:');
  console.log('================================');
  console.log(`Email: ${email}`);
  console.log(`Tier: ${tier}`);
  console.log(`License Key: ${licenseKey}`);
  console.log(`Transaction ID: ${transactionId || 'Manual'}`);
  console.log(`Created: ${created}`);
  console.log('================================\n');
  
  console.log('📧 EMAIL TEMPLATE:');
  console.log('===================');
  console.log(`Subject: Your CodeContext Memory Pro License Key`);
  console.log(`
Hi there!

Thanks for purchasing CodeContext Memory Pro! 🧠

Your license details:
• Tier: ${tier.replace('_', ' ').toUpperCase()}
• License Key: ${licenseKey}
• Transaction ID: ${transactionId || 'Manual Processing'}

To activate:
1. Install: npm install -g codecontext-memory
2. Activate: codecontext activate ${email} ${licenseKey}
3. Initialize: codecontext init

Welcome to the AI Memory Revolution!

Best,
CodeContext Pro Team
  `);
  
  return licenseData;
}

// Bulk generator for multiple licenses
function generateBulkLicenses(licensesToGenerate) {
  console.log(`\n🚀 GENERATING ${licensesToGenerate.length} LICENSES...\n`);
  
  const generated = licensesToGenerate.map(({ email, tier, transactionId }) => {
    return generateManualLicense(email, tier, transactionId);
  });
  
  console.log(`\n✅ Generated ${generated.length} licenses successfully!`);
  return generated;
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
🔑 CodeContext Pro - Manual License Generator

Usage:
  node manual-license-generator.js <email> <tier> [transaction-id]

Examples:
  node manual-license-generator.js user@example.com early_adopter pi_1234567890
  node manual-license-generator.js test@test.com test
  node manual-license-generator.js premium@user.com standard ch_abcdef123456

Tiers: test, early_adopter, standard
    `);
    process.exit(1);
  }
  
  const [email, tier, transactionId] = args;
  generateManualLicense(email, tier, transactionId);
}

module.exports = {
  generateLicenseKey,
  generateManualLicense,
  generateBulkLicenses
};