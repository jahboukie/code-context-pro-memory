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
    apiVersion: "2022-08-01",
  }
);

// Debug logging
console.log("Stripe key available:", !!(process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key));

const corsHandler = cors({origin: true});

/**
 * Get current pricing and availability
 */
export const getPricing = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const statsDoc = await db.collection("public").doc("stats").get();
      const stats = statsDoc.data() || {
        earlyAdoptersSold: 0,
        earlyAdopterLimit: 10000,
      };

      const remaining = Math.max(0, stats.earlyAdopterLimit - stats.earlyAdoptersSold);
      const isEarlyAdopterAvailable = remaining > 0;

      res.json({
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
      console.error("Error getting pricing:", error);
      res.status(500).json({error: "Failed to get pricing"});
    }
  });
});

/**
 * Create Stripe checkout session
 */
export const createCheckout = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    try {
      const {email, tier} = req.body;

      if (!email || !tier) {
        res.status(400).json({error: "Email and tier required"});
        return;
      }

      // Get current pricing
      const statsDoc = await db.collection("public").doc("stats").get();
      const stats = statsDoc.data() || {earlyAdoptersSold: 0, earlyAdopterLimit: 10000};
      
      let priceData;
      if (tier === "early_adopter") {
        const remaining = Math.max(0, stats.earlyAdopterLimit - stats.earlyAdoptersSold);
        if (remaining <= 0) {
          res.status(400).json({error: "Early adopter licenses sold out"});
          return;
        }
        priceData = {
          unit_amount: 9900, // $99.00
          currency: "usd",
          recurring: {interval: "month" as "month"},
          product_data: {
            name: "CodeContext Memory Pro - Early Adopter",
            description: "🔥 LOCKED-IN FOREVER: $99/month AI Memory Revolution (First 10,000 only)",
          },
        };
      } else {
        priceData = {
          unit_amount: 19900, // $199.00
          currency: "usd",
          recurring: {interval: "month" as "month"},
          product_data: {
            name: "CodeContext Memory Pro - Standard",
            description: "🧠 AI Memory Revolution: $199/month",
          },
        };
      }

      const session = await stripe.checkout.sessions.create({
        customer_email: email,
        payment_method_types: ["card"],
        line_items: [{
          price_data: priceData,
          quantity: 1,
        }],
        mode: "subscription",
        success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/cancel`,
        metadata: {
          email: email,
          tier: tier,
        },
      });

      res.json({sessionId: session.id, url: session.url});
    } catch (error) {
      console.error("Error creating checkout:", error);
      res.status(500).json({error: "Failed to create checkout session"});
    }
  });
});

/**
 * Handle Stripe webhook events
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || functions.config().stripe?.webhook_secret || ""
    );
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
    console.error("Webhook error:", error);
    res.status(500).json({error: "Webhook processing failed"});
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

  // Generate license key
  const licenseKey = generateLicenseKey(email);

  // Create license document
  const licenseData = {
    id: licenseKey,
    email: email,
    tier: tier,
    price: tier === "early_adopter" ? 99 : 199,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: null, // Subscription-based, no expiry
    active: true,
    features: {
      persistentMemory: true,
      cloudSync: true,
      multiProject: true,
      prioritySupport: true,
      executionEngine: false, // Phase 2 feature
    },
    maxProjects: -1, // Unlimited
  };

  await db.collection("licenses").doc(licenseKey).set(licenseData);

  // Update stats if early adopter
  if (tier === "early_adopter") {
    await db.collection("public").doc("stats").update({
      earlyAdoptersSold: admin.firestore.FieldValue.increment(1),
    });
  }

  // TODO: Send welcome email with license key
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
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    try {
      const {email, licenseKey} = req.body;

      if (!email || !licenseKey) {
        res.status(400).json({error: "Email and license key required"});
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

      // Return license data (without sensitive info)
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
        },
      });
    } catch (error) {
      console.error("Error validating license:", error);
      res.status(500).json({error: "Failed to validate license"});
    }
  });
});

/**
 * Report usage analytics
 */
export const reportUsage = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
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
      console.error("Error reporting usage:", error);
      res.status(500).json({error: "Failed to report usage"});
    }
  });
});

/**
 * Initialize database with default stats (admin function)
 */
export const initializeDatabase = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // Initialize stats document
      await db.collection("public").doc("stats").set({
        earlyAdoptersSold: 0,
        earlyAdopterLimit: 10000,
        initializedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: "Database initialized with default stats",
        stats: {
          earlyAdoptersSold: 0,
          earlyAdopterLimit: 10000
        }
      });
    } catch (error) {
      console.error("Database initialization error:", error);
      res.status(500).json({error: "Failed to initialize database"});
    }
  });
});

/**
 * Generate secure license key
 */
function generateLicenseKey(email: string): string {
  const timestamp = Date.now();
  const hash = createHash("sha256")
    .update(`${email}-${timestamp}-codecontext-pro`)
    .digest("hex")
    .substring(0, 16)
    .toUpperCase();

  return `CCP-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
}