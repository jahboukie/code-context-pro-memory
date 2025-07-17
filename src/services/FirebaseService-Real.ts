/**
 * Firebase Service - Production license validation and analytics
 */

export interface License {
  id: string;
  email: string;
  tier: 'early_adopter' | 'standard' | 'team';
  price: number;
  createdAt: Date;
  expiresAt: Date;
  active: boolean;
  features: {
    persistentMemory: boolean;
    executionEngine: boolean;
    cloudSync: boolean;
    multiProject: boolean;
    prioritySupport: boolean;
  };
  maxProjects: number;
}

export interface EarlyAdopterStats {
  sold: number;
  remaining: number;
  limit: number;
  currentPrice: number;
  nextPrice: number;
}

class RealFirebaseService {
  private apiBase: string;

  constructor() {
    // Production Firebase Functions endpoint
    this.apiBase = process.env.CODECONTEXT_API_BASE || 'https://codecontext-memory-pro.web.app/api';
  }

  async authenticate(email: string, licenseKey: string): Promise<License> {
    try {
      const response = await this.fetchWithTimeout(`${this.apiBase}/validateLicense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, licenseKey }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' })) as any;
        throw new Error(error.error || `HTTP ${response.status}: License validation failed`);
      }

      const data = await response.json() as any;
      
      if (!data.valid) {
        throw new Error('Invalid license');
      }

      // Convert Firestore timestamps back to Date objects
      const license = data.license;
      return {
        ...license,
        createdAt: this.parseFirestoreDate(license.createdAt),
        expiresAt: license.expiresAt ? this.parseFirestoreDate(license.expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      };

    } catch (error) {
      // Fallback to mock for development/testing
      if (this.isDevelopment()) {
        console.warn('🔶 Using mock authentication (development mode)');
        return this.mockAuthenticate(email, licenseKey);
      }
      throw new Error(`License validation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async checkLicenseAvailability(): Promise<EarlyAdopterStats> {
    try {
      const response = await this.fetchWithTimeout(`${this.apiBase}/getPricing`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch pricing`);
      }

      const data = await response.json() as any;
      
      return {
        sold: data.earlyAdopter.sold || 0,
        remaining: data.earlyAdopter.remaining || 10000,
        limit: data.earlyAdopter.limit || 10000,
        currentPrice: data.earlyAdopter.price || 99,
        nextPrice: data.standard.price || 199
      };

    } catch (error) {
      // Fallback to mock for development/testing
      if (this.isDevelopment()) {
        console.warn('🔶 Using mock pricing (development mode)');
        return this.mockPricing();
      }
      throw new Error(`Failed to check pricing: ${error instanceof Error ? error.message : error}`);
    }
  }

  async reportUsage(action: string, metadata?: any): Promise<void> {
    try {
      // For usage reporting, we need the current license key
      const licenseKey = this.getCurrentLicenseKey();
      
      if (!licenseKey) {
        // Silently skip if no license key available
        return;
      }

      // Fire and forget - don't block on analytics
      this.fetchWithTimeout(`${this.apiBase}/reportUsage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          licenseKey,
          action, 
          metadata: metadata || {},
          timestamp: new Date().toISOString(),
          version: this.getCliVersion(),
          platform: process.platform
        }),
      }, 5000).catch(error => {
        // Don't log in production to avoid noise
        if (this.isDevelopment()) {
          console.warn('Analytics failed:', error);
        }
      });

    } catch (error) {
      // Silently fail - analytics should never break the main flow
    }
  }

  // Utility methods
  private async fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private parseFirestoreDate(timestamp: any): Date {
    if (timestamp && timestamp._seconds) {
      return new Date(timestamp._seconds * 1000);
    }
    if (timestamp && typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    return new Date();
  }

  private getCurrentLicenseKey(): string | null {
    // Try to get from environment or local storage
    return process.env.CODECONTEXT_LICENSE_KEY || null;
  }

  private getCliVersion(): string {
    try {
      const packageJson = require('../../package.json');
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' || 
           process.env.NODE_ENV === 'test' ||
           this.apiBase.includes('localhost');
  }

  // Development/testing fallbacks
  private async mockAuthenticate(email: string, licenseKey: string): Promise<License> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      id: licenseKey,
      email: email,
      tier: 'early_adopter',
      price: 99,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      active: true,
      features: {
        persistentMemory: true,
        executionEngine: false, // Phase 2 feature
        cloudSync: true,
        multiProject: true,
        prioritySupport: true
      },
      maxProjects: -1 // Unlimited
    };
  }

  private async mockPricing(): Promise<EarlyAdopterStats> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      sold: Math.floor(Math.random() * 2000), // Random for demo
      remaining: 8000 + Math.floor(Math.random() * 2000),
      limit: 10000,
      currentPrice: 99,
      nextPrice: 199
    };
  }
}

export const realFirebaseService = new RealFirebaseService();