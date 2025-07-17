#!/usr/bin/env node

/**
 * Post-install script for CodeContext Pro
 * Shows licensing information and purchase instructions
 */

import chalk from 'chalk';

console.log(chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                    🧠 CodeContext Pro                        ║
║              AI Memory Revolution Installed                  ║
╚══════════════════════════════════════════════════════════════╝
`));

console.log(chalk.yellow(`
🔥 EARLY ADOPTER SPECIAL: $99/month
📈 After 10,000 licenses sold: $199/month

🧠 What you get:
✅ Persistent AI Memory (Revolutionary!)
✅ Real-time Code Execution & Verification
✅ Cloud Sync Across All Devices  
✅ Advanced Project Analytics
✅ Priority Support
✅ Price locked at $99/month FOREVER
`));

console.log(chalk.white(`
🚀 Get Started:

1. Purchase your license:
   ${chalk.cyan('codecontext purchase your@email.com')}

2. Activate your license:
   ${chalk.cyan('codecontext activate your@email.com YOUR-LICENSE-KEY')}

3. Initialize your project:
   ${chalk.cyan('codecontext init')}
   ${chalk.cyan('codecontext scan --deep')}

4. Experience the cognitive revolution!
`));

console.log(chalk.gray(`
💡 Why CodeContext Pro?

❌ ChatGPT Pro: $20/month (no memory, no execution)
❌ Claude Pro: $20/month (no memory, no execution)  
❌ GitHub Copilot: $10/month (no memory, no execution)
✅ CodeContext Pro: $99/month (INFINITE MEMORY + EXECUTION!)

This cognitive upgrade pays for itself in 1 day.
`));

console.log(chalk.blue(`
📚 Learn More:
   Website: https://codecontextpro.com
   Docs: https://docs.codecontextpro.com
   Support: support@codecontextpro.com

🎯 Check license status: codecontext license
`));

console.log(chalk.bold.yellow(`
⚠️  This tool requires a valid license to function.
    All features are locked until activated.
    
🔥 Only X early adopter licenses remaining!
`));

// Check if they already have a license
import { licenseService } from './services/LicenseService';

licenseService.getCurrentLicense().then(license => {
  if (license) {
    console.log(chalk.green(`
✅ LICENSE ACTIVE
   Email: ${license.email}
   Tier: ${license.tier.toUpperCase()}
   
🚀 You're ready to go! Run: codecontext init
    `));
  } else {
    console.log(chalk.red(`
🔒 NO ACTIVE LICENSE
   
🔥 Purchase now: codecontext purchase your@email.com
📈 Early adopter pricing won't last forever!
    `));
  }
}).catch(() => {
  // Silent fail for post-install
});