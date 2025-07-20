/**
 * CodeContext Memory Pro - Firebase Functions
 * Handles payments, licensing, and user management
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import cors from "cors";
import {createHash} from "crypto";

// Keep using 1st Gen functions for now

admin.initializeApp();
const db = admin.firestore();

// Initialize Stripe - mix of secrets and config for compatibility
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key || "",
  {
    apiVersion: "2023-10-16",
  }
);

// Debug logging
console.log("Stripe key available:", !!(process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key));

// SECURITY: Restrict CORS to specific allowed domains
const allowedOrigins = [
  'https://codecontext-memory-pro.web.app',
  'https://codecontext-memory-pro.firebaseapp.com',
  'https://codecontextpro.com',
  'http://localhost:3000', // Development
  'http://localhost:8080', // Development
];

const corsHandler = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature']
});

// SECURITY: Add security headers to all responses
function addSecurityHeaders(res: any): void {
  // Prevent clickjacking attacks
  res.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.set('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.set('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.gstatic.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.stripe.com; " +
    "frame-src https://js.stripe.com; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  );
  
  // Prevent referrer leakage
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Strict Transport Security (HSTS)
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Permissions Policy (formerly Feature Policy)
  res.set('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );
}

// SECURITY: Email validation function
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// SECURITY: Generic error handler to prevent information disclosure
function handleError(error: any, context: string): {error: string} {
  // Log detailed error for debugging (server-side only)
  console.error(`Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    context
  });
  
  // Return generic error to client
  return {error: "An error occurred processing your request"};
}

// SECURITY: Rate limiting implementation
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }
  
  if (entry.count >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  entry.count++;
  return true;
}

function getRateLimitKey(req: any, endpoint: string): string {
  // Use IP address + endpoint for rate limiting
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return `${ip}:${endpoint}`;
}

// SECURITY: JWT token verification for enhanced authentication
async function verifyAuthToken(authHeader: string): Promise<{uid: string, email: string} | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || ''
    };
  } catch (error) {
    console.log('Token verification failed:', error.message);
    return null;
  }
}

/**
 * Get current pricing and availability
 */
export const getPricingHttp = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // SECURITY: Add security headers
    addSecurityHeaders(res);
    try {
      const statsDoc = await db.collection("public").doc("stats").get();
      const stats = statsDoc.data() || {
        earlyAdoptersSold: 0,
        earlyAdopterLimit: 10000,
      };

      const remaining = Math.max(0, stats.earlyAdopterLimit - stats.earlyAdoptersSold);
      const isEarlyAdopterAvailable = remaining > 0;

      res.json({
        test: {
          available: true,
          price: 1,
        },
        earlyAdopter: {
          available: isEarlyAdopterAvailable,
          price: 99,
          remaining: remaining,
          sold: stats.earlyAdoptersSold,
          limit: stats.earlyAdopterLimit,
        },
        standard: {
          price: 199,
          available: true,
        },
      });
    } catch (error) {
      res.status(500).json(handleError(error, "getPricing"));
    }
  });
});

/**
 * Create Stripe checkout session
 */
export const createCheckout = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // SECURITY: Add security headers
    addSecurityHeaders(res);
    
    console.log("createCheckout function started with:", req.body);
    
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    // SECURITY: Rate limiting - 5 requests per 15 minutes per IP
    const rateLimitKey = getRateLimitKey(req, 'createCheckout');
    if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
      res.status(429).json({error: "Too many requests. Please try again later."});
      return;
    }

    try {
      const {email, tier} = req.body;
      console.log("Processing checkout for:", email, tier);

      if (!email || !tier) {
        res.status(400).json({error: "Email and tier required"});
        return;
      }

      // SECURITY: Validate email format
      if (!validateEmail(email)) {
        res.status(400).json({error: "Invalid email format"});
        return;
      }

      // Get current pricing
      const statsDoc = await db.collection("public").doc("stats").get();
      const stats = statsDoc.data() || {earlyAdoptersSold: 0, earlyAdopterLimit: 10000};
      
      let priceData;
      if (tier === "test") {
        priceData = {
          price: process.env.STRIPE_PRICE_TEST || functions.config().stripe?.price_test || "price_1Rm1UmELGHd3NbdJ6rwCIMx3",
        };
      } else if (tier === "early_adopter") {
        const remaining = Math.max(0, stats.earlyAdopterLimit - stats.earlyAdoptersSold);
        if (remaining <= 0) {
          res.status(400).json({error: "Early adopter licenses sold out"});
          return;
        }
        priceData = {
          price: process.env.STRIPE_PRICE_EARLY_ADOPTER || functions.config().stripe?.price_early_adopter || "price_1Rlu15ELGHd3NbdJ2oxuZF26",
        };
      } else {
        priceData = {
          price: process.env.STRIPE_PRICE_STANDARD || functions.config().stripe?.price_standard || "price_1RluloELGHd3NbdJdakkqP7J",
        };
      }

      console.log("About to create Stripe session with price:", priceData.price);
      
      const session = await stripe.checkout.sessions.create({
        customer_email: email,
        payment_method_types: ["card"],
        line_items: [{
          price: priceData.price,
          quantity: 1,
        }],
        mode: "subscription",
        success_url: `https://codecontext-memory-pro.web.app/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://codecontext-memory-pro.web.app/cancel`,
        metadata: {
          email: email,
          tier: tier,
        },
      });
      
      console.log("Stripe session created successfully:", session.id);

      res.json({sessionId: session.id, url: session.url});
    } catch (error: any) {
      res.status(500).json(handleError(error, "createCheckout"));
    }
  });
});

/**
 * Handle Stripe webhook events
 */
export const stripeWebhook = functions.runWith({
  memory: "256MB"
}).https.onRequest(async (req, res) => {
  // SECURITY: Add security headers  
  addSecurityHeaders(res);
  
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || functions.config().stripe?.webhook_secret;
  
  console.log("Webhook received, signature:", sig ? "present" : "missing");
  console.log("Webhook secret configured:", webhookSecret ? "yes" : "no");
  
  let event: Stripe.Event;

  try {
    // Ensure we have the raw body for signature verification
    const body = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      webhookSecret || ""
    );
    console.log("Webhook signature verified successfully for event:", event.type);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleSuccessfulPayment(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({received: true});
  } catch (error) {
    res.status(500).json(handleError(error, "stripeWebhook"));
  }
});

/**
 * Handle successful payment
 */
async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  const email = session.metadata?.email;
  const tier = session.metadata?.tier;

  if (!email || !tier) {
    throw new Error("Missing email or tier in session metadata");
  }

  // Create Firebase Auth user if they don't exist
  let firebaseUser;
  try {
    firebaseUser = await admin.auth().getUserByEmail(email);
  } catch (error) {
    // User doesn't exist, create them
    firebaseUser = await admin.auth().createUser({
      email: email,
      emailVerified: true,
      displayName: email.split('@')[0],
    });
    console.log(`Created Firebase Auth user: ${firebaseUser.uid}`);
  }

  // Generate unique license key using Firestore's auto-generated document ID
  const newLicenseDocRef = db.collection("licenses").doc(); // Firestore generates unique ID
  const licenseKey = newLicenseDocRef.id;

  // Create license document with Firestore-generated unique ID
  const licenseData = {
    key: licenseKey, // Store the key within the document
    id: licenseKey, // Keep for backward compatibility
    email: email,
    firebaseUid: firebaseUser.uid, // Add Firebase UID
    tier: tier,
    price: tier === "test" ? 7.99 : tier === "early_adopter" ? 99 : 199,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: null, // Subscription-based, no expiry
    active: true,
    features: {
      persistentMemory: true,
      cloudSync: tier !== "test", // Test tier gets local only
      multiProject: tier !== "test", // Test tier gets single project
      prioritySupport: tier === "early_adopter",
      executionEngine: false, // Phase 2 feature
    },
    maxProjects: tier === "test" ? 1 : -1, // Test: 1 project, others: unlimited
    // Usage tracking
    usage: {
      currentMonth: new Date().toISOString().substring(0, 7), // YYYY-MM
      operations: 0,
      lastReset: admin.firestore.FieldValue.serverTimestamp(),
      limits: {
        monthly: tier === "test" ? 10 : tier === "early_adopter" ? 1000 : 500,
        remember: tier === "test" ? 10 : tier === "early_adopter" ? 1000 : 500,
        recall: tier === "test" ? 20 : tier === "early_adopter" ? 2000 : 1000,
        scan: tier === "test" ? 5 : tier === "early_adopter" ? 100 : 50,
        export: tier === "test" ? 2 : tier === "early_adopter" ? 50 : 20,
      }
    }
  };

  await newLicenseDocRef.set(licenseData);

  // Update stats if early adopter
  if (tier === "early_adopter") {
    await db.collection("public").doc("stats").update({
      earlyAdoptersSold: admin.firestore.FieldValue.increment(1),
    });
  }

  // TODO: Send welcome email with license key via SendGrid
  // await sendLicenseEmail(email, licenseKey);
  console.log(`License created for ${email}: ${licenseKey}`);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  // Find license by subscription ID and deactivate
  const licensesQuery = await db.collection("licenses")
    .where("stripeSubscriptionId", "==", subscription.id)
    .get();

  if (!licensesQuery.empty) {
    const licenseDoc = licensesQuery.docs[0];
    await licenseDoc.ref.update({
      active: false,
      canceledAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Handle payment failure
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Mark license as payment failed (but keep active for grace period)
  const subscription = invoice.subscription as string;
  const licensesQuery = await db.collection("licenses")
    .where("stripeSubscriptionId", "==", subscription)
    .get();

  if (!licensesQuery.empty) {
    const licenseDoc = licensesQuery.docs[0];
    await licenseDoc.ref.update({
      paymentStatus: "failed",
      lastPaymentFailed: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Validate license
 */
export const validateLicense = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // SECURITY: Add security headers
    addSecurityHeaders(res);
    
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    // SECURITY: Rate limiting - 20 requests per 5 minutes per IP
    const rateLimitKey = getRateLimitKey(req, 'validateLicense');
    if (!checkRateLimit(rateLimitKey, 20, 5 * 60 * 1000)) {
      res.status(429).json({error: "Too many requests. Please try again later."});
      return;
    }

    try {
      const {email, licenseKey} = req.body;

      if (!email || !licenseKey) {
        res.status(400).json({error: "Email and license key required"});
        return;
      }

      // SECURITY: Validate email format  
      if (!validateEmail(email)) {
        res.status(400).json({error: "Invalid email format"});
        return;
      }

      const licenseDoc = await db.collection("licenses").doc(licenseKey).get();

      if (!licenseDoc.exists) {
        res.status(404).json({error: "License not found"});
        return;
      }

      const license = licenseDoc.data();

      if (license?.email !== email) {
        res.status(403).json({error: "License email mismatch"});
        return;
      }

      if (!license?.active) {
        res.status(403).json({error: "License inactive"});
        return;
      }

      // SECURITY: Generate unique encryption key for this user
      if (!process.env.ENCRYPTION_MASTER_KEY) {
        console.error('SECURITY ERROR: ENCRYPTION_MASTER_KEY environment variable not set');
        res.status(500).json({error: 'Server configuration error'});
        return;
      }
      
      const userEncryptionKey = createHash('sha256')
        .update(license.id + license.email + process.env.ENCRYPTION_MASTER_KEY)
        .digest('hex');

      // Return license data with secure encryption key
      res.json({
        valid: true,
        license: {
          id: license.id,
          email: license.email,
          tier: license.tier,
          price: license.price,
          features: license.features,
          maxProjects: license.maxProjects,
          createdAt: license.createdAt,
          apiKey: userEncryptionKey, // Unique encryption key per user
        },
      });
    } catch (error) {
      res.status(500).json(handleError(error, "validateLicense"));
    }
  });
});

/**
 * Report usage analytics
 */
export const reportUsage = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // SECURITY: Add security headers
    addSecurityHeaders(res);
    
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    try {
      const {licenseKey, action, metadata} = req.body;

      if (!licenseKey || !action) {
        res.status(400).json({error: "License key and action required"});
        return;
      }

      // Verify license exists
      const licenseDoc = await db.collection("licenses").doc(licenseKey).get();
      if (!licenseDoc.exists) {
        res.status(404).json({error: "License not found"});
        return;
      }

      // Store usage event
      await db.collection("usage").add({
        licenseKey: licenseKey,
        action: action,
        metadata: metadata || {},
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({success: true});
    } catch (error) {
      res.status(500).json(handleError(error, "reportUsage"));
    }
  });
});

/**
 * SECURITY: initializeDatabase function REMOVED
 * 
 * This function was publicly accessible and could reset sales counters.
 * Database initialization should be done manually via Firebase CLI:
 * 
 * firebase firestore:delete --all-collections
 * firebase functions:shell
 * > initializeStatsManually()
 * 
 * Or use Firebase Console to manually create:
 * Collection: public
 * Document: stats
 * Fields: { earlyAdoptersSold: 0, earlyAdopterLimit: 10000 }
 */

/**
 * SECURE CODE EXECUTION ENDPOINT - DISABLED FOR SECURITY
 * 
 * This endpoint has been disabled due to incomplete security implementation.
 * To re-enable, implement proper Docker-based sandboxing with:
 * - Container isolation with resource limits
 * - Network namespace isolation  
 * - Filesystem isolation (read-only, minimal)
 * - User namespace isolation (non-root)
 * - Seccomp profiles to block system calls
 * - AppArmor/SELinux policies
 * - Time limits with SIGKILL enforcement
 */
export const validateExecution = functions.runWith({
  timeoutSeconds: 5,
  memory: '128MB'
}).https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // SECURITY: Add security headers
    addSecurityHeaders(res);
    
    // SECURITY: Endpoint disabled until proper sandboxing is implemented
    res.status(503).json({
      error: 'Code execution service temporarily unavailable',
      message: 'This feature is being enhanced with additional security measures',
      documentation: 'Contact support for alternative code validation options'
    });
  });
});

/**
 * SECURE EXECUTION FUNCTION REMOVED
 * 
 * The simulateSecureExecution function has been removed as the validateExecution 
 * endpoint is now disabled for security reasons. When re-implementing this feature,
 * use proper Docker-based sandboxing with complete isolation.
 */

/**
 * Get license key from Stripe session ID
 */
export const getLicenseKey = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // SECURITY: Add security headers
    addSecurityHeaders(res);
    
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    try {
      const {sessionId} = req.body;

      if (!sessionId) {
        res.status(400).json({error: "Session ID required"});
        return;
      }

      // Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (!session) {
        res.status(404).json({error: "Session not found"});
        return;
      }

      const email = session.metadata?.email;
      if (!email) {
        res.status(400).json({error: "Email not found in session metadata"});
        return;
      }

      // Find the license by email (since we create it in the webhook)
      const licensesQuery = await db.collection("licenses")
        .where("email", "==", email)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (licensesQuery.empty) {
        res.status(404).json({error: "License not found"});
        return;
      }

      const licenseDoc = licensesQuery.docs[0];
      const licenseData = licenseDoc.data();

      res.json({
        licenseKey: licenseData.key || licenseData.id,
        email: licenseData.email,
        tier: licenseData.tier
      });

    } catch (error) {
      res.status(500).json(handleError(error, "getLicenseKey"));
    }
  });
});

/**
 * Validate usage and increment counter (SECURITY CRITICAL)
 * This prevents gaming the system - all operations must be server-validated
 */
export const validateUsage = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // SECURITY: Add security headers
    addSecurityHeaders(res);
    
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    // SECURITY: Rate limiting - 100 requests per 5 minutes per IP (for active usage)
    const rateLimitKey = getRateLimitKey(req, 'validateUsage');
    if (!checkRateLimit(rateLimitKey, 100, 5 * 60 * 1000)) {
      res.status(429).json({error: "Too many requests. Please try again later."});
      return;
    }

    try {
      const {licenseKey, operation, email} = req.body;

      if (!licenseKey || !operation || !email) {
        res.status(400).json({error: "License key, operation, and email required"});
        return;
      }

      // SECURITY: Validate email format
      if (!validateEmail(email)) {
        res.status(400).json({error: "Invalid email format"});
        return;
      }

      // SECURITY: Enhanced authentication with JWT token verification
      const authHeader = req.headers.authorization;
      const authResult = await verifyAuthToken(authHeader || '');
      if (!authResult) {
        res.status(401).json({error: "Valid authentication token required"});
        return;
      }

      // Verify the authenticated user matches the request email
      if (authResult.email !== email) {
        res.status(403).json({error: "Authentication mismatch"});
        return;
      }

      // Get license document
      const licenseDoc = await db.collection("licenses").doc(licenseKey).get();

      if (!licenseDoc.exists) {
        res.status(404).json({error: "License not found"});
        return;
      }

      const license = licenseDoc.data();

      // Verify email matches
      if (license?.email !== email) {
        res.status(403).json({error: "License email mismatch"});
        return;
      }

      // Check if license is active
      if (!license?.active) {
        res.status(403).json({error: "License inactive"});
        return;
      }

      // Check if usage needs monthly reset
      const currentMonth = new Date().toISOString().substring(0, 7);
      const licenseUsage = license.usage || {};
      
      if (licenseUsage.currentMonth !== currentMonth) {
        // Reset usage for new month
        await licenseDoc.ref.update({
          "usage.currentMonth": currentMonth,
          "usage.operations": 0,
          "usage.lastReset": admin.firestore.FieldValue.serverTimestamp(),
        });
        licenseUsage.operations = 0;
      }

      // Check operation-specific limits
      const limits = licenseUsage.limits || {};
      const operationLimit = limits[operation] || limits.monthly || 100;
      const currentOperations = licenseUsage.operations || 0;

      if (currentOperations >= operationLimit) {
        res.status(429).json({
          error: `Usage limit exceeded for ${operation}`,
          limit: operationLimit,
          used: currentOperations,
          resetDate: `${currentMonth}-01`,
          tier: license.tier,
          upgradeUrl: "https://codecontextpro.com"
        });
        return;
      }

      // Increment usage BEFORE allowing operation (critical for security)
      await licenseDoc.ref.update({
        "usage.operations": admin.firestore.FieldValue.increment(1),
        "usage.lastUsed": admin.firestore.FieldValue.serverTimestamp(),
      });

      // Success response
      res.json({
        success: true,
        operation: operation,
        remaining: operationLimit - currentOperations - 1,
        limit: operationLimit,
        tier: license.tier,
        resetDate: `${currentMonth}-01`
      });

    } catch (error) {
      res.status(500).json(handleError(error, "validateUsage"));
    }
  });
});

/**
 * Generate custom token for user authentication after successful payment
 */
export const getAuthToken = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // SECURITY: Add security headers
    addSecurityHeaders(res);
    
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    try {
      const {sessionId} = req.body;

      if (!sessionId) {
        res.status(400).json({error: "Session ID required"});
        return;
      }

      // Retrieve the Stripe session
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (!session || !session.metadata?.email) {
        res.status(404).json({error: "Session not found or missing email"});
        return;
      }

      const email = session.metadata.email;

      // Get the Firebase user
      const firebaseUser = await admin.auth().getUserByEmail(email);
      
      // Generate custom token
      const customToken = await admin.auth().createCustomToken(firebaseUser.uid);

      res.json({
        customToken: customToken,
        email: email,
        uid: firebaseUser.uid
      });

    } catch (error) {
      res.status(500).json(handleError(error, "getAuthToken"));
    }
  });
});

/**
 * Firestore auto-generates unique document IDs - no custom function needed
 * This ensures guaranteed uniqueness across all documents
 */
