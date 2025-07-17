/**
 * Firebase Backend Service
 * Handles authentication, licensing, and cloud memory sync
 */

import * as crypto from 'crypto';

export interface License {
  id: string;
  userId: string;
  email: string;
  tier: 'early_adopter' | 'standard';
  price: number; // $99 or $199
  activatedAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'suspended';
  maxProjects: number;
  features: {
    persistentMemory: boolean;
    executionEngine: boolean;
    cloudSync: boolean;
    multiProject: boolean;
    prioritySupport: boolean;
  };
}

export interface EarlyAdopterStats {
  totalSold: number;
  remaining: number;
  currentPrice: number;
  nextPrice: number;
}

export class FirebaseService {
  private baseUrl: string;
  private apiKey?: string;

  constructor() {
    this.baseUrl = process.env.CODECONTEXT_API_URL || 'https://us-central1-codecontext-memory-pro.cloudfunctions.net';
  }

  async authenticate(email: string, licenseKey: string): Promise<License> {
    const response = await this.makeRequest('/validateLicense', {
      method: 'POST',
      body: {
        email,
        licenseKey,
        version: this.getCliVersion(),
        platform: process.platform
      }
    });

    if (!response.valid) {
      throw new Error(response.error || 'Invalid license key');
    }

    this.apiKey = response.license.apiKey;
    return response.license;
  }

  async checkLicenseAvailability(): Promise<EarlyAdopterStats> {
    const response = await this.makeRequest('/licenses/availability', {
      method: 'GET'
    });

    return response.stats;
  }

  async purchaseLicense(email: string, paymentToken: string): Promise<{ licenseKey: string; license: License }> {
    const response = await this.makeRequest('/licenses/purchase', {
      method: 'POST',
      body: {
        email,
        paymentToken,
        tier: 'early_adopter' // Will auto-upgrade to standard after 10k
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Purchase failed');
    }

    return {
      licenseKey: response.licenseKey,
      license: response.license
    };
  }

  async syncMemoryToCloud(projectId: string, memoryData: any): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Authentication required for cloud sync');
    }

    await this.makeRequest('/memory/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: {
        projectId,
        memoryData: this.encryptMemoryData(memoryData),
        timestamp: new Date().toISOString()
      }
    });
  }

  async getCloudMemory(projectId: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Authentication required for cloud sync');
    }

    const response = await this.makeRequest(`/memory/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    return this.decryptMemoryData(response.memoryData);
  }

  async validateExecution(code: string, language: string, projectContext: any): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Authentication required for execution engine');
    }

    const response = await this.makeRequest('/execution/validate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: {
        code: this.encryptCode(code),
        language,
        projectContext: this.encryptMemoryData(projectContext),
        requestId: crypto.randomUUID()
      }
    });

    return {
      success: response.success,
      output: response.output,
      error: response.error,
      executionTime: response.executionTime,
      memoryUsed: response.memoryUsed,
      securityScore: response.securityScore
    };
  }

  async validateUsage(operation: string, email: string, licenseKey: string): Promise<{success: boolean, remaining: number, limit: number, tier: string}> {
    const response = await this.makeRequest('/validateUsage', {
      method: 'POST',
      body: {
        licenseKey,
        operation,
        email
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Usage validation failed');
    }

    return {
      success: response.success,
      remaining: response.remaining,
      limit: response.limit,
      tier: response.tier
    };
  }

  async reportUsage(action: string, metadata?: any): Promise<void> {
    if (!this.apiKey) return; // Silent fail for usage tracking

    try {
      await this.makeRequest('/usage/track', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: {
          action,
          metadata,
          timestamp: new Date().toISOString(),
          version: this.getCliVersion()
        }
      });
    } catch (error) {
      // Silent fail - don't break CLI for usage tracking
    }
  }

  private async makeRequest(endpoint: string, options: {
    method: string;
    headers?: Record<string, string>;
    body?: any;
  }): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': `CodeContext-CLI/${this.getCliVersion()}`,
      ...options.headers
    };

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private encryptMemoryData(data: any): string {
    // Encrypt sensitive memory data before sending to cloud
    const key = this.apiKey || 'default-key';
    const keyBuffer = crypto.createHash('sha256').update(key).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptMemoryData(encryptedData: string): any {
    // Decrypt memory data from cloud
    const key = this.apiKey || 'default-key';
    const keyBuffer = crypto.createHash('sha256').update(key).digest();
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  private encryptCode(code: string): string {
    // Encrypt code before sending for execution
    const key = this.apiKey || 'default-key';
    const keyBuffer = crypto.createHash('sha256').update(key).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(code, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private getCliVersion(): string {
    try {
      const packageJson = require('../../package.json');
      return packageJson.version;
    } catch {
      return '1.0.0';
    }
  }
}

export const firebaseService = new FirebaseService();