/**
 * License Management Service
 * Handles the $99/month early adopter licensing model
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { firebaseService, License, EarlyAdopterStats } from './FirebaseService';

export class LicenseService {
  private licensePath: string;

  constructor() {
    this.licensePath = path.join(os.homedir(), '.codecontext', 'license.secure');
  }

  async purchaseLicense(email: string, paymentMethod: 'stripe' | 'paypal' = 'stripe'): Promise<string> {
    // Check availability first
    const stats = await firebaseService.checkLicenseAvailability();
    
    if (stats.remaining <= 0) {
      throw new Error(`
🚨 Early Adopter Licenses SOLD OUT!

The first 10,000 licenses at $99/month have been sold.
New price: $${stats.nextPrice}/month

Join the waitlist at https://codecontextpro.com/waitlist
      `);
    }

    console.log(`
🔥 EARLY ADOPTER OPPORTUNITY

💰 Current Price: $${stats.currentPrice}/month
📈 After ${stats.remaining} more sales: $${stats.nextPrice}/month  
⏰ ${stats.remaining} licenses remaining

🧠 What you get:
✅ Persistent AI Memory (Revolutionary!)
✅ Cloud Sync Across Devices  
✅ Multi-Project Support
✅ VS Code Integration
✅ Priority Support
✅ Locked-in $99/month FOREVER

This memory revolution is worth 100x the price.
    `);

    // In a real implementation, this would integrate with Stripe/PayPal
    // For now, simulate the purchase flow
    const licenseKey = await this.simulatePurchase(email, stats.currentPrice);
    
    console.log(`
🎉 LICENSE PURCHASED!

License Key: ${licenseKey}
Email: ${email}
Price: $${stats.currentPrice}/month (locked forever)

Run: codecontext activate ${licenseKey}
    `);

    return licenseKey;
  }

  async activateLicense(email: string, licenseKey: string): Promise<void> {
    try {
      const license = await firebaseService.authenticate(email, licenseKey);
      
      // Store encrypted license locally
      await this.storeLicense(license);
      
      console.log(`
🚀 CODECONTEXT MEMORY PRO ACTIVATED!

Welcome to the AI memory revolution, ${email}!

Your AI assistant now has:
🧠 Persistent memory across ALL sessions
☁️ Cloud sync across all your devices  
📊 Advanced project analytics
🔧 VS Code integration
🎯 Priority support

Tier: ${license.tier.toUpperCase()}
Price: $${license.price}/month (locked forever)
Expires: ${license.expiresAt.toLocaleDateString()}

Start using: codecontext init
      `);

    } catch (error) {
      throw new Error(`License activation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async getCurrentLicense(): Promise<License | null> {
    try {
      if (!await fs.pathExists(this.licensePath)) {
        return null;
      }

      const encryptedLicense = await fs.readFile(this.licensePath, 'utf8');
      const license = this.decryptLicense(encryptedLicense);
      
      // Validate license is still active
      if (new Date() > new Date(license.expiresAt)) {
        await this.removeLicense();
        throw new Error('License expired. Please renew at https://codecontextpro.com');
      }

      return license;
    } catch (error) {
      return null;
    }
  }

  async validateFeatureAccess(feature: keyof License['features']): Promise<void> {
    const license = await this.getCurrentLicense();
    
    if (!license) {
      throw new Error(`
🔒 PREMIUM FEATURE REQUIRED

"${feature}" requires CodeContext Pro license.

🔥 Early Adopter Special: Only $99/month
📈 After 10,000 licenses sold: $199/month

This cognitive upgrade pays for itself in 1 day.
Purchase: https://codecontextpro.com/purchase

Compare:
❌ ChatGPT Pro: $20/month (no memory, no execution)  
❌ Claude Pro: $20/month (no memory, no execution)
❌ GitHub Copilot: $10/month (no memory, no execution)
✅ CodeContext Pro: $99/month (PERSISTENT MEMORY + EXECUTION!)

This is 10x more valuable than any other AI tool.
      `);
    }

    if (!license.features[feature]) {
      throw new Error(`
🔒 FEATURE NOT INCLUDED

"${feature}" is not included in your current plan.
Upgrade at https://codecontextpro.com/upgrade
      `);
    }
  }

  async showLicenseStatus(): Promise<void> {
    const license = await this.getCurrentLicense();
    
    if (!license) {
      const stats = await firebaseService.checkLicenseAvailability();
      
      console.log(`
🧠 CodeContext Pro - AI Memory Revolution

Status: UNLICENSED
Features Available: None

🔥 EARLY ADOPTER SPECIAL
💰 Price: $${stats.currentPrice}/month (${stats.remaining} left)
📈 Next Price: $${stats.nextPrice}/month  

What you're missing:
❌ Persistent AI memory across sessions
❌ Real-time code execution and verification
❌ Cloud sync across devices  
❌ Multi-project support
❌ Advanced analytics

This cognitive upgrade is worth $1000s/month in productivity.

Purchase: codecontext purchase your@email.com
      `);
      return;
    }

    console.log(`
🧠 CodeContext Pro - ACTIVATED

👤 User: ${license.email}
🎯 Tier: ${license.tier.toUpperCase()} 
💰 Price: $${license.price}/month (locked forever!)
📅 Expires: ${license.expiresAt.toLocaleDateString()}
📊 Projects: ${license.maxProjects === -1 ? 'Unlimited' : license.maxProjects}

✅ FEATURES UNLOCKED:
${license.features.persistentMemory ? '🧠' : '❌'} Persistent AI Memory
${license.features.executionEngine ? '⚡' : '❌'} Code Execution Engine  
${license.features.cloudSync ? '☁️' : '❌'} Cloud Sync
${license.features.multiProject ? '📁' : '❌'} Multi-Project Support
${license.features.prioritySupport ? '🎯' : '❌'} Priority Support

You're part of the AI cognitive revolution! 🚀
    `);
  }

  private async simulatePurchase(email: string, price: number): Promise<string> {
    // In production, this would integrate with Stripe
    // For now, generate a mock license key
    
    const timestamp = Date.now();
    const hash = require('crypto').createHash('sha256')
      .update(`${email}-${timestamp}-codecontext-pro`)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();
    
    return `CCP-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
  }

  private async storeLicense(license: License): Promise<void> {
    await fs.ensureDir(path.dirname(this.licensePath));
    const encrypted = this.encryptLicense(license);
    await fs.writeFile(this.licensePath, encrypted, { mode: 0o600 }); // Secure permissions
  }

  private async removeLicense(): Promise<void> {
    if (await fs.pathExists(this.licensePath)) {
      await fs.remove(this.licensePath);
    }
  }

  private encryptLicense(license: License): string {
    // Simple encryption for local storage
    const crypto = require('crypto');
    const key = crypto.scryptSync('codecontext-secret', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(license), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptLicense(encrypted: string): License {
    // Simple decryption for local storage
    const crypto = require('crypto');
    const key = crypto.scryptSync('codecontext-secret', 'salt', 32);
    const [ivHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }
}

export const licenseService = new LicenseService();