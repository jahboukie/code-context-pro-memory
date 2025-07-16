/**
 * Licensing and Subscription Management
 * (For future cloud features)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export interface Subscription {
  tier: 'free' | 'pro' | 'enterprise';
  apiKey?: string;
  expiresAt?: Date;
  features: {
    localMemory: boolean;
    cloudSync: boolean;
    teamSharing: boolean;
    executionEngine: boolean;
    advancedAnalytics: boolean;
    apiAccess: boolean;
  };
}

export class LicenseManager {
  private configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.codecontext', 'license.json');
  }

  async getCurrentSubscription(): Promise<Subscription> {
    // Always return free tier for now (until cloud features are added)
    const defaultSubscription: Subscription = {
      tier: 'free',
      features: {
        localMemory: true,      // Always free
        cloudSync: false,       // Pro feature (coming soon)
        teamSharing: false,     // Enterprise feature
        executionEngine: false, // Pro feature (Phase 2)
        advancedAnalytics: false, // Pro feature
        apiAccess: false        // Enterprise feature
      }
    };

    try {
      if (await fs.pathExists(this.configPath)) {
        const saved = await fs.readJson(this.configPath);
        return { ...defaultSubscription, ...saved };
      }
    } catch (error) {
      // If config is corrupted, fall back to free tier
    }

    return defaultSubscription;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    // TODO: Implement server-side validation when cloud features are ready
    // For now, always return false (no paid features yet)
    
    try {
      // Future implementation:
      // const response = await fetch('https://api.codecontextpro.com/validate', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ apiKey })
      // });
      // return response.ok;
      
      return false; // No cloud features yet
    } catch (error) {
      return false;
    }
  }

  async upgradeToCloud(apiKey: string): Promise<boolean> {
    const isValid = await this.validateApiKey(apiKey);
    
    if (!isValid) {
      throw new Error('Invalid API key. Visit https://codecontextpro.com to get your key.');
    }

    // Save the validated subscription
    const subscription: Subscription = {
      tier: 'pro',
      apiKey,
      features: {
        localMemory: true,
        cloudSync: true,
        teamSharing: false,
        executionEngine: true,
        advancedAnalytics: true,
        apiAccess: false
      }
    };

    await fs.ensureDir(path.dirname(this.configPath));
    await fs.writeJson(this.configPath, subscription, { spaces: 2 });

    return true;
  }

  async requireFeature(feature: keyof Subscription['features']): Promise<void> {
    const subscription = await this.getCurrentSubscription();
    
    if (!subscription.features[feature]) {
      const upgradeMessage = this.getUpgradeMessage(feature);
      throw new Error(upgradeMessage);
    }
  }

  private getUpgradeMessage(feature: keyof Subscription['features']): string {
    const messages: Record<string, string> = {
      cloudSync: 'Cloud sync requires CodeContext Pro. Visit https://codecontextpro.com to upgrade.',
      teamSharing: 'Team sharing requires CodeContext Enterprise. Contact sales@codecontextpro.com',
      executionEngine: 'Code execution requires CodeContext Pro. Visit https://codecontextpro.com to upgrade.',
      advancedAnalytics: 'Advanced analytics requires CodeContext Pro. Visit https://codecontextpro.com to upgrade.',
      apiAccess: 'API access requires CodeContext Enterprise. Contact sales@codecontextpro.com'
    };

    return messages[feature] || 'This feature requires a paid subscription.';
  }

  async showUpgradeInfo(): Promise<void> {
    const subscription = await this.getCurrentSubscription();
    
    console.log(`
🧠 CodeContext Pro Subscription

Current Tier: ${subscription.tier.toUpperCase()}

Features Available:
${subscription.features.localMemory ? '✅' : '❌'} Local Memory
${subscription.features.cloudSync ? '✅' : '❌'} Cloud Sync
${subscription.features.teamSharing ? '✅' : '❌'} Team Sharing  
${subscription.features.executionEngine ? '✅' : '❌'} Code Execution Engine
${subscription.features.advancedAnalytics ? '✅' : '❌'} Advanced Analytics
${subscription.features.apiAccess ? '✅' : '❌'} API Access

${subscription.tier === 'free' ? `
💡 Upgrade to Pro for cloud sync and execution engine:
   Visit https://codecontextpro.com

💼 Need enterprise features?
   Contact sales@codecontextpro.com
` : '✨ All features unlocked!'}
    `);
  }
}

export const licenseManager = new LicenseManager();