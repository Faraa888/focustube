// server/src/index.ts
// Express backend server for FocusTube
// Handles AI classification, license verification, Stripe webhooks

// Load environment variables FIRST (before any imports that use them)
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Stripe from "stripe";
import OpenAI from "openai";
import { getUserPlan, updateUserPlan } from "./supabase";

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
// CACHING (in-memory cache for API responses)
// ─────────────────────────────────────────────────────────────
interface CacheEntry {
  value: any;
  expiresAt: number;
}

const planCache = new Map<string, CacheEntry>(); // email -> { plan, expiresAt }
const aiCache = new Map<string, CacheEntry>(); // user_id + text -> { category, expiresAt }

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCached<T>(cache: Map<string, CacheEntry>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCached<T>(cache: Map<string, CacheEntry>, key: string, value: T): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// Clean up expired cache entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of planCache.entries()) {
    if (now > entry.expiresAt) planCache.delete(key);
  }
  for (const [key, entry] of aiCache.entries()) {
    if (now > entry.expiresAt) aiCache.delete(key);
  }
}, 60 * 60 * 1000); // 1 hour

// ─────────────────────────────────────────────────────────────
// STRIPE CLIENT INITIALIZATION
// ─────────────────────────────────────────────────────────────
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
let stripeClient: Stripe | null = null;

if (stripeSecretKey) {
  stripeClient = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
  });
} else {
  console.warn("⚠️  STRIPE_SECRET_KEY not set - checkout endpoint will not work");
}

// Price IDs (you'll add these after creating products in Stripe dashboard)
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || ""; // $6.99/month (7 day trial)
const STRIPE_PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL || ""; // $59.99/year (14 day trial)
const STRIPE_PRICE_LIFETIME = process.env.STRIPE_PRICE_LIFETIME || ""; // $99.00 one-time (Early Access)

// ─────────────────────────────────────────────────────────────
// OPENAI CLIENT INITIALIZATION
// ─────────────────────────────────────────────────────────────
const openaiApiKey = process.env.OPENAI_API_KEY;
let openaiClient: OpenAI | null = null;

if (openaiApiKey) {
  openaiClient = new OpenAI({
    apiKey: openaiApiKey,
  });
} else {
  console.warn("⚠️  OPENAI_API_KEY not set - AI classification will return neutral");
}

// Middleware
app.use(cors({
  origin: [
    /^chrome-extension:\/\/.*/, // Allow Chrome extensions
    "http://localhost:*",      // Allow localhost for development
  ],
  credentials: true,
}));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.text({ type: "application/json" })); // For Stripe webhook raw body

// Request logging middleware (development only)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ─────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────

/**
 * Health check endpoint
 * GET /health
 */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    timestamp: Date.now(),
    service: "focustube-server",
  });
});

/**
 * AI Classification endpoint
 * POST /ai/classify
 * 
 * Classifies YouTube content using OpenAI as productive, neutral, or distracting
 * Caches results for 24h per user/text
 */
app.post("/ai/classify", async (req, res) => {
  try {
    const { user_id, text, context } = req.body;

    if (!user_id || !text) {
      return res.status(400).json({
        ok: false,
        error: "user_id and text are required",
      });
    }

    // Check cache first
    const cacheKey = `${user_id}:${text}`.toLowerCase().trim();
    const cachedResult = getCached<{ allowed: boolean; category: string; reason: string }>(aiCache, cacheKey);
    if (cachedResult !== null) {
      return res.json(cachedResult);
    }

    // Fallback result if OpenAI is not configured or fails
    let result: { allowed: boolean; category: string; reason: string } = {
      allowed: true,
      category: "neutral",
      reason: "openai_not_configured",
    };

    // Call OpenAI if configured
    if (openaiClient) {
      try {
        const prompt = `Classify this YouTube content as one of three categories:
- "productive": Educational, learning, skill-building, informative content
- "neutral": Entertainment, relaxation, general interest content
- "distracting": Time-wasting, addictive, low-value content

Content: "${text}"
${context ? `Context: ${context}` : ""}

Respond with ONLY one word: "productive", "neutral", or "distracting".`;

        const completion = await openaiClient.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a content classifier that categorizes YouTube content for productivity. Respond with only one word: productive, neutral, or distracting.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3, // Lower temperature for consistent classification
          max_tokens: 10, // We only need one word
        });

        const responseText = completion.choices[0]?.message?.content?.trim().toLowerCase() || "";
        
        // Parse response to extract category
        let category = "neutral";
        if (responseText.includes("productive")) {
          category = "productive";
        } else if (responseText.includes("distracting")) {
          category = "distracting";
        } else {
          category = "neutral";
        }

        // Determine if content is allowed (distracting content requires allowance)
        const allowed = category !== "distracting";

        result = {
          allowed,
          category,
          reason: `openai_classification_${category}`,
        };

        console.log(`[AI Classify] ${text.substring(0, 50)}... → ${category}`);
      } catch (openaiError: any) {
        console.error("[AI Classify] OpenAI error:", openaiError.message || openaiError);
        // Fallback to neutral on error
        result = {
          allowed: true,
          category: "neutral",
          reason: "openai_error",
        };
      }
    } else {
      console.warn("[AI Classify] OpenAI not configured, returning neutral");
    }

    // Cache the result (even if it's a fallback)
    setCached(aiCache, cacheKey, result);

    res.json(result);
  } catch (error: any) {
    console.error("Error in /ai/classify:", error);
    // Always return a valid response, even on error
    res.status(500).json({
      allowed: true,
      category: "neutral",
      reason: "error_fallback",
      error: "Internal server error",
    });
  }
});

/**
 * License verification endpoint
 * GET /license/verify?email=user@example.com
 * 
 * Returns user plan from Supabase database (cached for 24h)
 */
app.get("/license/verify", async (req, res) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Email parameter required",
      });
    }

    // Check cache first
    const cacheKey = email.toLowerCase().trim();
    const cachedPlan = getCached<string>(planCache, cacheKey);
    if (cachedPlan !== null) {
      return res.json({
        plan: cachedPlan,
      });
    }

    // Get user plan from Supabase
    const plan = await getUserPlan(email);

    if (plan === null) {
      // User not found - return free plan as default
      setCached(planCache, cacheKey, "free");
      res.json({
        plan: "free",
      });
    } else {
      setCached(planCache, cacheKey, plan);
      res.json({
        plan: plan,
      });
    }
  } catch (error) {
    console.error("Error in /license/verify:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/**
 * Update user plan endpoint (dev/testing)
 * POST /user/update-plan
 * 
 * Updates user plan in Supabase (for testing)
 * Body: { email: "user@example.com", plan: "free" | "pro" }
 */
app.post("/user/update-plan", async (req, res) => {
  try {
    const { email, plan } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Email is required",
      });
    }

    if (!plan || !["free", "pro"].includes(plan)) {
      return res.status(400).json({
        ok: false,
        error: "Plan must be 'free' or 'pro'",
      });
    }

    // Update user plan in Supabase
    const updated = await updateUserPlan(email, plan);

    if (updated) {
      // Invalidate cache for this email (plan changed)
      const cacheKey = email.toLowerCase().trim();
      planCache.delete(cacheKey);
      
      res.json({
        ok: true,
        message: `Plan updated to ${plan}`,
        plan: plan,
      });
    } else {
      res.status(500).json({
        ok: false,
        error: "Failed to update plan in database",
      });
    }
  } catch (error: any) {
    console.error("Error in /user/update-plan:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/**
 * Stripe Checkout endpoint
 * POST /stripe/create-checkout
 * 
 * Creates a Stripe Checkout Session and returns the checkout URL
 * Body: { email: "user@example.com", planType: "monthly" | "annual" | "lifetime" }
 */
app.post("/stripe/create-checkout", async (req, res) => {
  try {
    const { email, planType } = req.body;

    // Validate input
    if (!email || typeof email !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Email is required",
      });
    }

    if (!planType || !["monthly", "annual", "lifetime"].includes(planType)) {
      return res.status(400).json({
        ok: false,
        error: "planType must be 'monthly', 'annual', or 'lifetime'",
      });
    }

    // Check if Stripe is configured
    if (!stripeClient) {
      console.error("[Stripe Checkout] Stripe client not initialized - missing STRIPE_SECRET_KEY");
      return res.status(500).json({
        ok: false,
        error: "Stripe not configured. Please contact support.",
      });
    }

    // Get price ID based on plan type
    let priceId: string;
    if (planType === "monthly") {
      priceId = STRIPE_PRICE_MONTHLY;
    } else if (planType === "annual") {
      priceId = STRIPE_PRICE_ANNUAL;
    } else {
      priceId = STRIPE_PRICE_LIFETIME;
    }

    if (!priceId) {
      console.error(`[Stripe Checkout] Price ID not set for ${planType} plan`);
      return res.status(500).json({
        ok: false,
        error: "Pricing not configured. Please contact support.",
      });
    }

    // Create Stripe Checkout Session
    // Note: Stripe handles trials automatically if configured in dashboard
    const session = await stripeClient.checkout.sessions.create({
      mode: planType === "lifetime" ? "payment" : "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email, // Pre-fill email (user can confirm/edit in Stripe)
      success_url: `${req.protocol}://${req.get("host")}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get("host")}/checkout-cancel`,
      metadata: {
        user_email: email,
        plan_type: planType,
      },
    });

    // Return checkout URL
    res.json({
      ok: true,
      checkoutUrl: session.url,
    });
  } catch (error: any) {
    console.error("Error in /stripe/create-checkout:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to create checkout session. Please try again.",
    });
  }
});

/**
 * Stripe webhook endpoint
 * POST /webhook/stripe
 * 
 * Handles Stripe payment events and updates user plan in Supabase
 */
app.post("/webhook/stripe", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  try {
    // Parse Stripe event
    const event = JSON.parse(req.body.toString());
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Stripe Webhook] Event received:", event.type || "unknown");
    }

    // Handle checkout.session.completed event (payment succeeded)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerEmail = session.customer_email || session.customer_details?.email;

      if (customerEmail) {
        // Update user plan to "pro" in Supabase
        const updated = await updateUserPlan(customerEmail, "pro");

        if (updated) {
          // Invalidate cache for this email (plan changed)
          const cacheKey = customerEmail.toLowerCase().trim();
          planCache.delete(cacheKey);
          console.log(`[Stripe Webhook] Updated ${customerEmail} to Pro plan`);
        } else {
          console.error(`[Stripe Webhook] Failed to update plan for ${customerEmail}`);
          // Still return success to Stripe (we'll retry or handle manually)
        }
      } else {
        console.warn("[Stripe Webhook] No customer email in checkout session");
      }
    }

    // Always return success to Stripe (even if we couldn't update plan)
    res.json({
      received: true,
    });
  } catch (error) {
    console.error("Error in /webhook/stripe:", error);
    // Still return success to Stripe (prevents retries)
    res.status(200).json({
      received: true,
      error: "Internal error (logged)",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not found",
    path: req.path,
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  });
});

// ─────────────────────────────────────────────────────────────
// STRIPE CHECKOUT PAGES
// ─────────────────────────────────────────────────────────────

/**
 * Stripe Checkout Success Page
 * GET /checkout-success
 * 
 * Shown after successful payment
 */
app.get("/checkout-success", (req, res) => {
  const sessionId = req.query.session_id as string;
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - FocusTube</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
      max-width: 500px;
    }
    h1 {
      margin: 0 0 1rem 0;
      font-size: 2rem;
    }
    p {
      margin: 1rem 0;
      opacity: 0.9;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 12px 24px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✅ Payment Successful!</h1>
    <p>Thank you for upgrading to FocusTube Pro.</p>
    <p>Your plan has been updated. Return to YouTube to start using Pro features.</p>
    <a href="https://www.youtube.com/" class="button">Return to YouTube</a>
  </div>
</body>
</html>
  `);
});

/**
 * Stripe Checkout Cancel Page
 * GET /checkout-cancel
 * 
 * Shown when user cancels payment
 */
app.get("/checkout-cancel", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Cancelled - FocusTube</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
      max-width: 500px;
    }
    h1 {
      margin: 0 0 1rem 0;
      font-size: 2rem;
    }
    p {
      margin: 1rem 0;
      opacity: 0.9;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 12px 24px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Payment Cancelled</h1>
    <p>Your payment was cancelled. No charges were made.</p>
    <p>You can upgrade to Pro anytime from the extension.</p>
    <a href="https://www.youtube.com/" class="button">Return to YouTube</a>
  </div>
</body>
</html>
  `);
});

// ─────────────────────────────────────────────────────────────
// SERVER STARTUP
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 FocusTube server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  
  // Warn about missing env vars (non-critical for stubs)
  if (!process.env.SUPABASE_URL && process.env.NODE_ENV === "development") {
    console.log(`   ⚠️  SUPABASE_URL not set (optional for stubs)`);
  }
  if (!process.env.OPENAI_API_KEY && process.env.NODE_ENV === "development") {
    console.log(`   ⚠️  OPENAI_API_KEY not set (optional for stubs)`);
  }
  if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === "development") {
    console.log(`   ⚠️  STRIPE_SECRET_KEY not set (optional for stubs)`);
  }
});

