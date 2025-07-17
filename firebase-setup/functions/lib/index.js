"use strict";
/**
 * CodeContext Memory Pro - Firebase Functions
 * Handles payments, licensing, and user management
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthToken = exports.validateUsage = exports.getLicenseKey = exports.initializeDatabase = exports.reportUsage = exports.validateLicense = exports.stripeWebhook = exports.createCheckout = exports.getPricingHttp = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const cors_1 = __importDefault(require("cors"));
// Keep using 1st Gen functions for now
admin.initializeApp();
const db = admin.firestore();
// Initialize Stripe - mix of secrets and config for compatibility
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || "", {
    apiVersion: "2023-10-16",
});
// Debug logging
console.log("Stripe key available:", !!(process.env.STRIPE_SECRET_KEY || ((_b = functions.config().stripe) === null || _b === void 0 ? void 0 : _b.secret_key)));
const corsHandler = (0, cors_1.default)({ origin: true });
/**
 * Get current pricing and availability
 */
exports.getPricingHttp = functions.https.onRequest((req, res) => {
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
        }
        catch (error) {
            console.error("Error getting pricing:", error);
            res.status(500).json({ error: "Failed to get pricing" });
        }
    });
});
/**
 * Create Stripe checkout session
 */
exports.createCheckout = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        console.log("createCheckout function started with:", req.body);
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const { email, tier } = req.body;
            console.log("Processing checkout for:", email, tier);
            if (!email || !tier) {
                res.status(400).json({ error: "Email and tier required" });
                return;
            }
            // Get current pricing
            const statsDoc = await db.collection("public").doc("stats").get();
            const stats = statsDoc.data() || { earlyAdoptersSold: 0, earlyAdopterLimit: 10000 };
            let priceData;
            if (tier === "test") {
                priceData = {
                    price: "price_1Rm0RrELGHd3NbdJ2HSzqwDu", // $1.00 Test
                };
            }
            else if (tier === "early_adopter") {
                const remaining = Math.max(0, stats.earlyAdopterLimit - stats.earlyAdoptersSold);
                if (remaining <= 0) {
                    res.status(400).json({ error: "Early adopter licenses sold out" });
                    return;
                }
                priceData = {
                    price: "price_1Rlu15ELGHd3NbdJ2oxuZF26", // $99 Early Adopter Live
                };
            }
            else {
                priceData = {
                    price: "price_1RluloELGHd3NbdJdakkqP7J", // $199 Standard Live
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
            res.json({ sessionId: session.id, url: session.url });
        }
        catch (error) {
            // Log the detailed error with a structured object for Cloud Logging
            console.error("Stripe Checkout Session Error:", {
                message: error.message,
                statusCode: error.statusCode,
                type: error.type,
                code: error.code,
                rawError: error // Log the entire error object for full details
            });
            res.status(500).json({
                error: "Failed to create checkout session",
                details: error.message || "Unknown error"
            });
        }
    });
});
/**
 * Handle Stripe webhook events
 */
exports.stripeWebhook = functions.runWith({
    memory: "256MB"
}).https.onRequest(async (req, res) => {
    var _a;
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.webhook_secret);
    console.log("Webhook received, signature:", sig ? "present" : "missing");
    console.log("Webhook secret configured:", webhookSecret ? "yes" : "no");
    let event;
    try {
        // Ensure we have the raw body for signature verification
        const body = req.rawBody || req.body;
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret || "");
        console.log("Webhook signature verified successfully for event:", event.type);
    }
    catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    try {
        switch (event.type) {
            case "checkout.session.completed":
                await handleSuccessfulPayment(event.data.object);
                break;
            case "customer.subscription.deleted":
                await handleSubscriptionCanceled(event.data.object);
                break;
            case "invoice.payment_failed":
                await handlePaymentFailed(event.data.object);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});
/**
 * Handle successful payment
 */
async function handleSuccessfulPayment(session) {
    var _a, _b;
    const email = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.email;
    const tier = (_b = session.metadata) === null || _b === void 0 ? void 0 : _b.tier;
    if (!email || !tier) {
        throw new Error("Missing email or tier in session metadata");
    }
    // Create Firebase Auth user if they don't exist
    let firebaseUser;
    try {
        firebaseUser = await admin.auth().getUserByEmail(email);
    }
    catch (error) {
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
        key: licenseKey,
        id: licenseKey,
        email: email,
        firebaseUid: firebaseUser.uid,
        tier: tier,
        price: tier === "test" ? 7.99 : tier === "early_adopter" ? 99 : 199,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: null,
        active: true,
        features: {
            persistentMemory: true,
            cloudSync: tier !== "test",
            multiProject: tier !== "test",
            prioritySupport: tier === "early_adopter",
            executionEngine: false, // Phase 2 feature
        },
        maxProjects: tier === "test" ? 1 : -1,
        // Usage tracking
        usage: {
            currentMonth: new Date().toISOString().substring(0, 7),
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
async function handleSubscriptionCanceled(subscription) {
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
async function handlePaymentFailed(invoice) {
    // Mark license as payment failed (but keep active for grace period)
    const subscription = invoice.subscription;
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
exports.validateLicense = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const { email, licenseKey } = req.body;
            if (!email || !licenseKey) {
                res.status(400).json({ error: "Email and license key required" });
                return;
            }
            const licenseDoc = await db.collection("licenses").doc(licenseKey).get();
            if (!licenseDoc.exists) {
                res.status(404).json({ error: "License not found" });
                return;
            }
            const license = licenseDoc.data();
            if ((license === null || license === void 0 ? void 0 : license.email) !== email) {
                res.status(403).json({ error: "License email mismatch" });
                return;
            }
            if (!(license === null || license === void 0 ? void 0 : license.active)) {
                res.status(403).json({ error: "License inactive" });
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
        }
        catch (error) {
            console.error("Error validating license:", error);
            res.status(500).json({ error: "Failed to validate license" });
        }
    });
});
/**
 * Report usage analytics
 */
exports.reportUsage = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const { licenseKey, action, metadata } = req.body;
            if (!licenseKey || !action) {
                res.status(400).json({ error: "License key and action required" });
                return;
            }
            // Verify license exists
            const licenseDoc = await db.collection("licenses").doc(licenseKey).get();
            if (!licenseDoc.exists) {
                res.status(404).json({ error: "License not found" });
                return;
            }
            // Store usage event
            await db.collection("usage").add({
                licenseKey: licenseKey,
                action: action,
                metadata: metadata || {},
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            res.json({ success: true });
        }
        catch (error) {
            console.error("Error reporting usage:", error);
            res.status(500).json({ error: "Failed to report usage" });
        }
    });
});
/**
 * Initialize database with default stats (admin function)
 */
exports.initializeDatabase = functions.https.onRequest(async (req, res) => {
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
        }
        catch (error) {
            console.error("Database initialization error:", error);
            res.status(500).json({ error: "Failed to initialize database" });
        }
    });
});
/**
 * Get license key from Stripe session ID
 */
exports.getLicenseKey = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a;
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const { sessionId } = req.body;
            if (!sessionId) {
                res.status(400).json({ error: "Session ID required" });
                return;
            }
            // Retrieve the session from Stripe
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (!session) {
                res.status(404).json({ error: "Session not found" });
                return;
            }
            const email = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.email;
            if (!email) {
                res.status(400).json({ error: "Email not found in session metadata" });
                return;
            }
            // Find the license by email (since we create it in the webhook)
            const licensesQuery = await db.collection("licenses")
                .where("email", "==", email)
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();
            if (licensesQuery.empty) {
                res.status(404).json({ error: "License not found" });
                return;
            }
            const licenseDoc = licensesQuery.docs[0];
            const licenseData = licenseDoc.data();
            res.json({
                licenseKey: licenseData.key || licenseData.id,
                email: licenseData.email,
                tier: licenseData.tier
            });
        }
        catch (error) {
            console.error("Error fetching license key:", error);
            res.status(500).json({ error: "Failed to fetch license key" });
        }
    });
});
/**
 * Validate usage and increment counter (SECURITY CRITICAL)
 * This prevents gaming the system - all operations must be server-validated
 */
exports.validateUsage = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const { licenseKey, operation, email } = req.body;
            if (!licenseKey || !operation || !email) {
                res.status(400).json({ error: "License key, operation, and email required" });
                return;
            }
            // Get license document
            const licenseDoc = await db.collection("licenses").doc(licenseKey).get();
            if (!licenseDoc.exists) {
                res.status(404).json({ error: "License not found" });
                return;
            }
            const license = licenseDoc.data();
            // Verify email matches
            if ((license === null || license === void 0 ? void 0 : license.email) !== email) {
                res.status(403).json({ error: "License email mismatch" });
                return;
            }
            // Check if license is active
            if (!(license === null || license === void 0 ? void 0 : license.active)) {
                res.status(403).json({ error: "License inactive" });
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
        }
        catch (error) {
            console.error("Usage validation error:", error);
            res.status(500).json({ error: "Failed to validate usage" });
        }
    });
});
/**
 * Generate custom token for user authentication after successful payment
 */
exports.getAuthToken = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a;
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        try {
            const { sessionId } = req.body;
            if (!sessionId) {
                res.status(400).json({ error: "Session ID required" });
                return;
            }
            // Retrieve the Stripe session
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (!session || !((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.email)) {
                res.status(404).json({ error: "Session not found or missing email" });
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
        }
        catch (error) {
            console.error("Error generating auth token:", error);
            res.status(500).json({ error: "Failed to generate auth token" });
        }
    });
});
/**
 * Firestore auto-generates unique document IDs - no custom function needed
 * This ensures guaranteed uniqueness across all documents
 */
//# sourceMappingURL=index.js.map