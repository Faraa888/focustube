// server/src/index.ts
// Express backend server for FocusTube
// Handles AI classification, license verification, Stripe webhooks

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
 * AI Classification endpoint (stub)
 * POST /ai/classify
 * 
 * TODO: Connect OpenAI in Lesson 10
 */
app.post("/ai/classify", (req, res) => {
  try {
    const { user_id, text, context } = req.body;

    // Stub response - always returns neutral/allowed
    // TODO: Implement OpenAI classification
    res.json({
      allowed: true,
      category: "neutral",
      reason: "stub_response",
    });
  } catch (error) {
    console.error("Error in /ai/classify:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/**
 * License verification endpoint (stub)
 * GET /license/verify
 * 
 * TODO: Connect Supabase in Lesson 8C
 */
app.get("/license/verify", (req, res) => {
  try {
    // Stub response - always returns free plan
    // TODO: Verify JWT token from Supabase
    // TODO: Fetch user plan from Supabase database
    res.json({
      plan: "free",
    });
  } catch (error) {
    console.error("Error in /license/verify:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/**
 * Stripe webhook endpoint (stub)
 * POST /webhook/stripe
 * 
 * TODO: Connect Supabase plan updates in Lesson 8C
 */
app.post("/webhook/stripe", bodyParser.raw({ type: "application/json" }), (req, res) => {
  try {
    // Stub - log event, return success
    // TODO: Verify Stripe signature
    // TODO: Update user plan in Supabase
    const event = req.body;
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Stripe Webhook] Event received:", event.type || "unknown");
    }

    res.json({
      ok: true,
      received: true,
    });
  } catch (error) {
    console.error("Error in /webhook/stripe:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
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

