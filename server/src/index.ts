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
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  getUserPlan,
  getUserPlanInfo,
  updateUserPlan,
  upsertVideoClassification,
  updateVideoWatchTime,
  insertVideoSessions,
  pruneVideoData,
  insertJournalEntry,
  getUserIdFromEmail,
  UserPlanInfo,
  supabase,
} from "./supabase";

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
// CACHING (in-memory cache for API responses)
// ─────────────────────────────────────────────────────────────
interface CacheEntry {
  value: any;
  expiresAt: number;
}

const planCache = new Map<string, CacheEntry>(); // email -> { UserPlanInfo, expiresAt }
const aiCache = new Map<string, CacheEntry>(); // user_id + text -> { category, expiresAt }

// ─────────────────────────────────────────────────────────────
// ADMIN RATE LIMITER (in-memory, 10 calls/hour per IP)
// ─────────────────────────────────────────────────────────────
const adminRateLimitMap = new Map<string, number[]>(); // IP -> array of call timestamps
const ADMIN_RATE_LIMIT = 10;
const ADMIN_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkAdminRateLimit(ip: string): boolean {
  const now = Date.now();
  const calls = (adminRateLimitMap.get(ip) || []).filter(t => now - t < ADMIN_RATE_WINDOW_MS);
  if (calls.length >= ADMIN_RATE_LIMIT) return false;
  calls.push(now);
  adminRateLimitMap.set(ip, calls);
  return true;
}

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
const STRIPE_PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL || ""; // $59.99/year (30 day trial)
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
  console.log("✅ OpenAI client initialized successfully");
} else {
  console.warn("⚠️  OPENAI_API_KEY not set - AI classification will return neutral");
}

// ─────────────────────────────────────────────────────────────
// ANTHROPIC CLIENT INITIALIZATION
// ─────────────────────────────────────────────────────────────
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
let anthropicClient: Anthropic | null = null;

if (!anthropicApiKey) {
  console.error('ANTHROPIC_API_KEY missing — Pass 2 classification disabled');
} else {
  anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
  console.log('Anthropic API key loaded successfully');
}

// ─────────────────────────────────────────────────────────────
// RATE LIMITING (in-memory per-user daily counters)
// ─────────────────────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  date: string; // YYYY-MM-DD
}
const classifyRateLimit = new Map<string, RateLimitEntry>(); // email -> { count, date }
const CLASSIFY_DAILY_LIMIT = 500;

function checkClassifyRateLimit(email: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().split("T")[0];
  const entry = classifyRateLimit.get(email);
  if (!entry || entry.date !== today) {
    classifyRateLimit.set(email, { count: 1, date: today });
    return { allowed: true, remaining: CLASSIFY_DAILY_LIMIT - 1 };
  }
  if (entry.count >= CLASSIFY_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: CLASSIFY_DAILY_LIMIT - entry.count };
}

// Clean rate limit map daily
setInterval(() => {
  const today = new Date().toISOString().split("T")[0];
  for (const [key, entry] of classifyRateLimit.entries()) {
    if (entry.date !== today) classifyRateLimit.delete(key);
  }
}, 60 * 60 * 1000);

// ─────────────────────────────────────────────────────────────
// AI PROMPT CONFIGURATION
// ─────────────────────────────────────────────────────────────
interface ClassifierPrompt {
  version: string;
  model_hint?: string;
  role: string;
  core_logic: string[];
  global_channel_tag?: {
    description?: string;
  rules?: string[];
  };
  shorts_rule?: string;
  inputs?: Record<string, any>;
  steps: string[];
  output_schema: Record<string, any>;
  fallback: {
    category: string;
    distraction_level: string;
    confidence: number;
    goals_alignment: string;
    reasons: string[];
  };
  examples?: any[];
}

const DEFAULT_CLASSIFIER_OUTPUT_SCHEMA = {
  category: "string",
  distraction_level: "productive | neutral | distracting",
  confidence: "number between 0 and 1",
  goals_alignment: "aligned | partially_aligned | misaligned",
  reasons: ["string", "string"]
};

let classifierPrompt: ClassifierPrompt | null = null;

try {
  // Try compiled path first (dist/prompts/classifier.json), then source path (src/prompts/classifier.json)
  let promptPath = join(__dirname, "prompts", "classifier.json");
  if (!existsSync(promptPath)) {
    // Fallback to source path
    promptPath = join(__dirname, "..", "src", "prompts", "classifier.json");
  }
  const promptData = readFileSync(promptPath, "utf-8");
  classifierPrompt = JSON.parse(promptData) as ClassifierPrompt;
  console.log(`✅ Loaded AI classifier prompt v${classifierPrompt.version}`);
} catch (error: any) {
  console.warn("⚠️  Failed to load AI classifier prompt:", error.message);
  console.warn("   Using default prompt structure");
}

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, or Chrome extensions)
    if (!origin) {
      return callback(null, true);
    }
    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    // Allow localhost for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return callback(null, true);
    }
    // Allow YouTube (for content scripts)
    if (origin.includes('youtube.com')) {
      return callback(null, true);
    }
    // Allow Vercel frontend
    if (origin.includes('focustube-beta.vercel.app') || origin.includes('vercel.app')) {
      return callback(null, true);
    }
    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
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
 * Two-pass classification: GPT-4o-mini first, Claude sonnet-3-5 if confidence < 0.65.
 * Accepts: { email, video_id, title, channel, description, category, tags, is_shorts }
 * Returns: { classification, confidence, cached, model }
 * Rate limit: 50/user/day
 */
app.post("/ai/classify", async (req, res) => {
  try {
    const {
      email,
      video_id,
      title,
      channel,
      description,
      category,
      tags,
      is_shorts,
      // Legacy fields (backward compat with background.js)
      user_id,
      video_title,
      channel_name,
      video_description,
      video_category,
      video_tags,
    } = req.body;

    // Normalise: accept both new (email/title/channel) and legacy (user_id/video_title/channel_name)
    const userEmail = (email || user_id || "").toLowerCase().trim();
    const videoId = video_id || "";
    const videoTitle = title || video_title || "";
    const channelName = channel || channel_name || "";
    const videoDescription = description || video_description || "";
    const videoCategory = category || video_category || "";
    const videoTags: string[] = Array.isArray(tags) ? tags : (Array.isArray(video_tags) ? video_tags : []);
    const isShorts = Boolean(is_shorts);

    if (!userEmail || !videoTitle) {
      return res.status(400).json({ error: "email (or user_id) and title (or video_title) are required" });
    }

    // ── Rate limit ──────────────────────────────────────────────
    const rateCheck = checkClassifyRateLimit(userEmail);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: "Daily classification limit reached (50/day)", remaining: 0 });
    }

    // ── Shorts fast-path ─────────────────────────────────────────
    if (isShorts) {
      console.log(`[AI Classify] Shorts fast-path → distracting: ${videoTitle.substring(0, 50)}`);
      return res.json({ classification: "distracting", confidence: 1.0, cached: false, model: "shorts-rule" });
    }

    // ── DB cache lookup (video_classifications, expires_at) ───────
    const userId = await getUserIdFromEmail(userEmail);
    if (userId && videoId) {
      const { data: cachedRow } = await supabase
        .from("video_classifications")
        .select("distraction_level, confidence_distraction, expires_at")
        .eq("user_id", userId)
        .eq("video_id", videoId)
        .single();

      if (cachedRow && cachedRow.distraction_level && cachedRow.expires_at) {
        const expiresAt = new Date(cachedRow.expires_at).getTime();
        if (Date.now() < expiresAt) {
          console.log(`[AI Classify] DB cache hit for video ${videoId}`);
          return res.json({
            classification: cachedRow.distraction_level,
            confidence: cachedRow.confidence_distraction ?? 0.5,
            cached: true,
            model: "cache",
          });
        }
      }
    }

    // ── In-memory cache ───────────────────────────────────────────
    const memCacheKey = userId && videoId ? `${userId}:${videoId}` : `${userEmail}:${videoTitle}`.toLowerCase().trim();
    const memCached = getCached<any>(aiCache, memCacheKey);
    if (memCached) {
      console.log(`[AI Classify] Memory cache hit: ${memCacheKey.substring(0, 60)}`);
      return res.json({ ...memCached, cached: true });
    }

    // ── Fetch user goals & pitfalls for prompt ────────────────────
    let userGoals: string[] = [];
    let userPitfalls: string[] = [];
    if (userId) {
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("goals, pitfalls")
          .eq("id", userId)
          .single();
        if (userData?.goals) {
          userGoals = typeof userData.goals === "string" ? JSON.parse(userData.goals) : (Array.isArray(userData.goals) ? userData.goals : []);
        }
        if (userData?.pitfalls) {
          userPitfalls = typeof userData.pitfalls === "string" ? JSON.parse(userData.pitfalls) : (Array.isArray(userData.pitfalls) ? userData.pitfalls : []);
        }
      } catch (_) { /* non-critical */ }
    }

    // ── Build prompt parts ────────────────────────────────────────
    const goalsLine = userGoals.length > 0 ? userGoals.join(", ") : "not provided";
    const pitfallsLine = userPitfalls.length > 0 ? userPitfalls.join(", ") : "none";
    const tagsLine = videoTags.length > 0 ? videoTags.slice(0, 5).join(", ") : "none";

    // Pass 1 prompts
    const systemPromptPass1 = `You are a strict YouTube video classifier for a productivity tool. Your job is to classify videos as productive, neutral, or distracting. You must be honest about uncertainty — do not guess confidently on ambiguous inputs. Respond with JSON only. No explanation. No markdown.`;

    const userPromptPass1 = `STEP 1 — Classify on content alone:
- productive: clearly educational, tutorial, skill-building, or professional development
- distracting: clearly entertainment, sports, celebrity, gaming, vlogs, reaction videos, drama, or anything with no learning value
- neutral: news, documentary, or genuinely ambiguous content where you are not sure

STEP 2 — Override with user context using semantic matching:
- Compare the video content SEMANTICALLY against the user's pitfalls — do not require exact keyword matches
- If the video's topic, theme, or tone is clearly within the spirit of a pitfall → downgrade to distracting
- Examples of semantic matches:
  * Pitfall "AI doom content" matches: "Why AI Will Destroy Us", "AI Existential Risk Explained", "Should We Be Scared of AI?"
  * Pitfall "gaming videos" matches: "Fortnite highlights", "Best FIFA plays", "Minecraft Let's Play"
  * Pitfall "celebrity drama" matches: "KSI vs Logan Paul reaction", "Top 10 celebrity feuds"
- If the match is ambiguous or a stretch → do not override, keep content-based classification
- Pitfall overrides always produce confidence >= 0.80

CONFIDENCE RULES — follow these strictly:
- Only return confidence >= 0.85 when the classification is obvious (e.g. Fortnite gaming = distracting, Python tutorial = productive)
- Return confidence 0.4–0.64 when the title, channel, or description is vague, generic, or gives no clear signal
- Return confidence 0.65–0.84 for moderately clear cases
- Never return high confidence on vague or content-free inputs

USER CONTEXT:
Goals: ${goalsLine}
Pitfalls: ${pitfallsLine}

VIDEO:
Title: ${videoTitle}
Channel: ${channelName || "unknown"}
Description: ${videoDescription.substring(0, 300) || "none"}
Category: ${videoCategory || "unknown"}
Tags: ${tagsLine}

Respond with JSON only:
{"classification": "productive|neutral|distracting", "confidence": 0.0}`;

    // Pass 2 prompts (for Claude if Pass 1 confidence < 0.65)
    const systemPromptPass2 = `You are a second-opinion YouTube video classifier. 
A previous classifier was uncertain. Make a definitive classification.
Respond with JSON only. No explanation. No markdown.`;

    const userPromptPass2 = `VIDEO:
Title: ${videoTitle}
Channel: ${channelName || "unknown"}
Description: ${videoDescription.substring(0, 300) || "none"}
Category: ${videoCategory || "unknown"}
Tags: ${tagsLine}

USER CONTEXT:
Goals: ${goalsLine}
Pitfalls: ${pitfallsLine}

CLASSIFICATION LOGIC:

STEP 1 — Classify on content alone:
- productive: educational, tutorial, skill-building, professional development
- distracting: entertainment, sports, celebrity, gaming, vlogs, reaction videos, drama, anything with no learning value
- neutral: news, documentary, ambiguous content that could go either way

STEP 2 — Override with user context only on a direct match:
- If video directly matches a user goal → upgrade to productive
- If video directly matches a user pitfall → downgrade to distracting
- If no direct match → keep the content-based classification from Step 1

IMPORTANT: Entertainment content must never default to neutral. If it has no clear learning or professional value it is distracting. Neutral is reserved for genuinely ambiguous content only.

The previous classifier was uncertain — commit to a clear answer.
Do not return confidence below 0.65. You are the final decision.

Respond with JSON only:
{"classification": "productive|neutral|distracting", "confidence": 0.0}`;

    // ── Pass 1: GPT-4o-mini ───────────────────────────────────────
    let classification = "neutral";
    let confidence = 0.0;
    let model = "fallback";
    let pass1Failed = false;

    if (openaiClient) {
      try {
        console.log(`[AI Classify] Pass 1 (gpt-4o-mini): ${videoTitle.substring(0, 50)}`);
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPromptPass1 },
            { role: "user", content: userPromptPass1 },
          ],
          temperature: 0.2,
          max_tokens: 120,
          response_format: { type: "json_object" },
        });
        const text = completion.choices[0]?.message?.content?.trim() || "{}";
        const parsed = JSON.parse(text);
        const rawClass = (parsed.classification || "neutral").toLowerCase();
        classification = ["productive", "neutral", "distracting"].includes(rawClass) ? rawClass : "neutral";
        confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
        model = "gpt-4o-mini";
        console.log(`[AI Classify] Pass 1 result: ${classification} (confidence: ${confidence})`);
      } catch (err: any) {
        console.error("[AI Classify] Pass 1 (OpenAI) failed:", err.message || err);
        pass1Failed = true;
      }
    }

    // ── Pass 2: Claude sonnet-3-5 if confidence < 0.65 ───────────
    let pass2Failed = false;
    if (confidence < 0.65 && anthropicClient) {
      try {
        console.log(`[AI Classify] Pass 2 (claude-haiku-4-5-20251001): confidence was ${confidence}`);
        const response = await anthropicClient.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 100,
          system: systemPromptPass2,
          messages: [{ role: "user", content: userPromptPass2 }],
        });
        const raw = (response.content[0] as any)?.text || "{}";
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const rawClass = (parsed.classification || "neutral").toLowerCase();
        const claudeClass = ["productive", "neutral", "distracting"].includes(rawClass) ? rawClass : "neutral";
        const claudeConf = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
        // Accept Pass 2 result regardless of confidence
        classification = claudeClass;
        confidence = claudeConf;
        model = "claude-haiku-4-5-20251001";
        console.log(`[AI Classify] Pass 2 result: ${claudeClass} (confidence: ${claudeConf}) → accepted`);
      } catch (err: any) {
        console.error("[AI Classify] Pass 2 (Claude) failed - full error:", err);
        pass2Failed = true;
        // Default to neutral on failure
        if (model === "fallback") {
          classification = "neutral";
          confidence = 0.0;
        }
      }
    }

    const result = { classification, confidence, cached: false, model };

    // ── Persist to DB and cache only if not failed/defaulted ──────
    const isFallback = model === "fallback" || pass1Failed || (confidence < 0.65 && pass2Failed);
    
    if (!isFallback) {
      // Only cache successful classifications
      if (userId && videoId) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const classifiedAt = new Date().toISOString();
        supabase
          .from("video_classifications")
          .upsert({
            user_id: userId,
            video_id: videoId,
            video_title: videoTitle || null,
            channel_name: channelName || null,
            video_category: videoCategory || null,
            distraction_level: classification,
            confidence_distraction: confidence,
            model_used: model,
            classified_at: classifiedAt,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }, { onConflict: "user_id,video_id" })
          .then(({ error }) => {
            if (error) console.warn("[AI Classify] DB upsert failed:", error.message);
          });
      }

      // Store in memory cache
      setCached(aiCache, memCacheKey, result);
    } else {
      console.log(`[AI Classify] Skipping cache for failed/defaulted result`);
    }

    console.log(`[AI Classify] ✅ ${videoTitle.substring(0, 50)} → ${classification} (${confidence}) via ${model}`);
    res.json(result);
  } catch (error: any) {
    console.error("Error in /ai/classify:", error);
    res.json({ classification: "neutral", confidence: 0.0, cached: false, model: "fallback" });
  }
});

/**
 * Save completed video watch session
 * POST /video/update-watch-time
 * Accepts: { email, video_id, video_title, channel_name, classification, watch_seconds }
 */
app.post("/video/update-watch-time", async (req, res) => {
  try {
    const {
      email,
      video_id,
      video_title,
      channel_name,
      classification,
      watch_seconds,
      // Legacy field compat
      user_id,
    } = req.body || {};

    const userEmail = (email || user_id || "").toLowerCase().trim();
    if (!userEmail || !video_id || typeof watch_seconds !== "number" || watch_seconds < 0) {
      return res.status(400).json({ error: "email, video_id, and watch_seconds are required" });
    }

    const userId = await getUserIdFromEmail(userEmail);
    if (!userId) {
      console.warn("[Watch Time] User not found:", userEmail);
      return res.status(404).json({ error: "User not found" });
    }

    const distractionLevel = ["productive", "neutral", "distracting"].includes(classification)
      ? classification
      : "neutral";

    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("video_sessions").insert({
      user_id: userId,
      video_id,
      video_title: video_title || null,
      channel_name: channel_name || null,
      watch_seconds,
      watched_at: nowIso,
      distraction_level: distractionLevel,
      created_at: nowIso,
    });

    if (error) {
      console.error("[Watch Time] DB insert error:", error);
      return res.status(500).json({ error: "Failed to save session" });
    }

    console.log(`[Watch Time] Saved session: ${video_id} (${distractionLevel}, ${watch_seconds}s) for ${userEmail}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error in /video/update-watch-time:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * License verification endpoint
 * GET /license/verify?email=user@example.com
 * 
 * Returns user plan and trial info from Supabase database (cached for 24h)
 * Response: { plan: "trial"|"pro"|"free", days_left?: number }
 */
/**
 * Helper function to check if a user can record data (Pro or active Trial)
 * @param email - User email address
 * @returns Promise<boolean> - true if user can record, false otherwise
 */
async function canUserRecord(email: string): Promise<boolean> {
  const planInfo = await getUserPlanInfo(email);
  if (!planInfo) return false;
  const { plan, trial_expires_at } = planInfo;
  if (plan === "pro") return true;
  if (plan === "trial" && trial_expires_at) {
    const expiresAt = new Date(trial_expires_at);
    const now = new Date();
    return expiresAt.getTime() > now.getTime();
  }
  return false;
}

/**
 * Bootstrap endpoint for extension popup
 * GET /extension/bootstrap?email=user@email.com
 * 
 * Returns all user data needed for extension initialization:
 * - plan, trial_days_left
 * - goals, pitfalls
 * - blocked_channels
 * - settings (focus_window_start, focus_window_end, etc.)
 */
app.get("/extension/bootstrap", async (req, res) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Email parameter required",
      });
    }

    // Get user from Supabase
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);

    if (userError) {
      console.error("[Bootstrap] Error fetching user:", userError);
      return res.status(500).json({
        ok: false,
        error: "Database error",
      });
    }

    if (!users || users.length === 0) {
      // User not found - return 401 to indicate invalid session
      return res.status(401).json({
        ok: false,
        error: "User not found",
      });
    }

    const user = users[0];
    let plan = user.plan || "free";
    const trial_expires_at = user.trial_expires_at;

    // Auto-downgrade expired trials
    if (plan === "trial" && trial_expires_at) {
      const expiresAt = new Date(trial_expires_at);
      const now = new Date();
      if (expiresAt.getTime() <= now.getTime()) {
        plan = "free";
      }
    }

    // Helper function to parse JSON array from TEXT column
    function parseJsonArray(value: any): string[] {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    }

    // Calculate trial_days_left
    let trial_days_left: number | null = null;
    if (plan === "trial" && trial_expires_at) {
      const expiresAt = new Date(trial_expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      trial_days_left = Math.max(0, diffDays);
    }

    // Parse JSON arrays from TEXT columns
    const goals = parseJsonArray(user.goals);
    const pitfalls = parseJsonArray(user.pitfalls);
    const blocked_channels = parseJsonArray(user.blocked_channels);

    // Get extension_data by user_id (not email)
    const { data: extensionData, error: extError } = await supabase
      .from("extension_data")
      .select("settings")
      .eq("user_id", user.id)
      .limit(1);

    if (extError && extError.code !== "PGRST116") {
      console.error("[Bootstrap] Error fetching extension_data:", extError);
    }

    const extData = extensionData && extensionData.length > 0 ? extensionData[0] : null;

    // Get settings from extension_data (JSONB column)
    const settings = extData?.settings || {};

    // Extract focus window from settings
    const focus_window_enabled = settings.focus_window_enabled || false;
    const focus_window_start = settings.focus_window_start || null;
    const focus_window_end = settings.focus_window_end || null;

    return res.json({
      ok: true,
      plan,
      trial_days_left,
      trial_expires_at,
      goals,
      pitfalls,
      blocked_channels,
      settings,
      focus_window_enabled,
      focus_window_start,
      focus_window_end,
    });
  } catch (error: any) {
    console.error("[Bootstrap] Error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
});

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
    const cachedPlanInfo = getCached<UserPlanInfo>(planCache, cacheKey);
    if (cachedPlanInfo !== null) {
      // For cached plan, return it with exists: true (cached plans are only for existing users)
      let { plan, trial_expires_at } = cachedPlanInfo;
      console.log(`[License Verify] Cache hit for ${email}: ${plan}`);
      
      // Auto-downgrade expired trials BEFORE calculating can_record
      if (plan === "trial" && trial_expires_at) {
        const expiresAt = new Date(trial_expires_at);
        const now = new Date();
        if (expiresAt.getTime() <= now.getTime()) {
          // Trial expired - downgrade to free
          plan = "free";
          console.log(`[License Verify] Auto-downgraded expired trial for ${email} to free`);
        }
      }
      
      // Calculate days_left for trial users (only if still trial)
      let days_left: number | undefined = undefined;
      if (plan === "trial" && trial_expires_at) {
        const expiresAt = new Date(trial_expires_at);
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        days_left = Math.max(0, diffDays); // Don't return negative days
      }

      // Calculate can_record flag (using potentially downgraded plan)
      const can_record = plan === "pro" || (plan === "trial" && trial_expires_at && new Date(trial_expires_at).getTime() > Date.now());

      const response: any = {
        exists: true,
        plan,
        can_record,
      };
      if (days_left !== undefined) {
        response.days_left = days_left;
      }
      if (trial_expires_at) {
        response.trial_expires_at = trial_expires_at;
      }
      return res.json(response);
    }
    
    console.log(`[License Verify] Cache miss for ${email}, fetching from Supabase...`);

    // Get user plan and trial info from Supabase
    const planInfo = await getUserPlanInfo(email);

    if (planInfo === null) {
      // User not found - return exists: false
      // Don't cache this - we want to check again if user signs up
      console.log(`[License Verify] User ${email} not found in Supabase, returning exists: false`);
      res.json({
        exists: false,
        plan: "free", // Default for non-existent users
        can_record: false,
      });
    } else {
      let { plan, trial_expires_at } = planInfo;
      console.log(`[License Verify] Fetched plan from Supabase for ${email}: ${plan}`);
      
      // Auto-downgrade expired trials BEFORE caching and calculating can_record
      if (plan === "trial" && trial_expires_at) {
        const expiresAt = new Date(trial_expires_at);
        const now = new Date();
        if (expiresAt.getTime() <= now.getTime()) {
          // Trial expired - downgrade to free
          plan = "free";
          console.log(`[License Verify] Auto-downgraded expired trial for ${email} to free`);
        }
      }
      
      // Cache the plan info (with potentially downgraded plan)
      setCached(planCache, cacheKey, { ...planInfo, plan });

      // Calculate days_left for trial users (only if still trial)
      let days_left: number | undefined = undefined;
      if (plan === "trial" && trial_expires_at) {
        const expiresAt = new Date(trial_expires_at);
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        days_left = Math.max(0, diffDays); // Don't return negative days
      }

      // Calculate can_record flag (using potentially downgraded plan)
      const can_record = plan === "pro" || (plan === "trial" && trial_expires_at && new Date(trial_expires_at).getTime() > Date.now());

      const response: any = { 
        exists: true,
        plan,
        can_record,
      };
      if (days_left !== undefined) {
        response.days_left = days_left;
      }
      if (trial_expires_at) {
        response.trial_expires_at = trial_expires_at;
      }
      res.json(response);
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
 * Normalize YouTube channel names endpoint
 * POST /ai/normalize-channels
 * 
 * Takes user-typed channel names and returns exact canonical names as they appear in YouTube metadata
 */
app.post("/ai/normalize-channels", async (req, res) => {
  try {
    const { channel_names } = req.body;

    if (!channel_names || !Array.isArray(channel_names) || channel_names.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "channel_names array is required",
      });
    }

    // If OpenAI not configured, return original names (no normalization)
    if (!openaiClient) {
      console.warn("[Normalize Channels] ⚠️ OpenAI not configured, returning original names");
      return res.json({
        ok: true,
        normalized_names: channel_names,
        warning: "OpenAI not configured - normalization skipped",
      });
    }
    
    console.log(`[Normalize Channels] 🔄 Normalizing ${channel_names.length} channel(s):`, channel_names);

    // Build prompt
    const prompt = `You are a YouTube channel name normalizer. Your job is to correct typos, fix spelling, add missing words/articles, and return the EXACT channel name as it appears on YouTube.

User typed these channel names (may contain typos, missing words, or formatting issues):
${JSON.stringify(channel_names)}

Return a JSON array with the corrected, canonical channel names in the same order.

CRITICAL RULES:
1. Fix ALL typos and spelling mistakes (e.g., "calfrezy" → "calfreezy", "Justic" → "Justice", "crciket" → "cricket")
2. Add missing articles like "The" when the channel name includes it (e.g., "Overlap" → "The Overlap", "United Stand" → "The United Stand")
3. Fix spacing issues (e.g., "Loganpaul" → "Logan Paul")
4. Add missing words if the channel name is incomplete (e.g., "sky crciket" → "Sky Sports Cricket")
5. Use proper capitalization as shown on YouTube (e.g., "eddie hall" → "Eddie Hall The Beast")
6. Preserve numbers, special characters, and suffixes exactly as on YouTube
7. If unsure, search your knowledge of popular YouTube channels
8. Keep the same order as input
9. Return ONLY a JSON array, no other text

Examples:
- "vikkstar" → "Vikkstar123"
- "eddie hall" → "Eddie Hall The Beast"  
- "mr beast" → "MrBeast"
- "calfrezy" → "calfreezy"
- "matt davelia" → "Matt D'Avella"
- "Overlap" → "The Overlap"
- "United Stand" → "The United Stand"
- "Zach Justic" → "Zach Justice"
- "Loganpaul" → "Logan Paul"
- "sky crciket" → "Sky Sports Cricket"

Return format: ["Channel1", "Channel2", "Channel3"]`;

    try {
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini", // Use cheaper model for simple normalization
        messages: [
          {
            role: "system",
            content: "You are a YouTube channel name normalizer. Return only valid JSON arrays.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 200,
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || "";
      console.log("[Normalize Channels] 📥 GPT raw response:", responseText);
      
      // Try to parse JSON array from response
      let normalizedNames: string[] = channel_names; // Fallback to original
      
      try {
        // Remove markdown code blocks if present
        const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        
        if (Array.isArray(parsed) && parsed.length === channel_names.length) {
          normalizedNames = parsed.map((name: any) => String(name).trim()).filter(Boolean);
          console.log("[Normalize Channels] ✅ Successfully normalized:", normalizedNames);
          
          // Log which names changed
          const changes = channel_names.map((original, idx) => {
            const normalized = normalizedNames[idx];
            if (original.toLowerCase().trim() !== normalized.toLowerCase().trim()) {
              return `${original} → ${normalized}`;
            }
            return null;
          }).filter(Boolean);
          
          if (changes.length > 0) {
            console.log("[Normalize Channels] 📝 Name changes:", changes);
          } else {
            console.log("[Normalize Channels] ℹ️ No names changed (already correct or GPT returned same)");
          }
        } else {
          console.warn("[Normalize Channels] ⚠️ Response format invalid - expected array of length", channel_names.length, "got:", parsed);
        }
      } catch (parseError) {
        console.warn("[Normalize Channels] ⚠️ Failed to parse OpenAI response:", parseError);
        console.warn("[Normalize Channels] Raw response was:", responseText);
        // Fallback to original names
      }

      return res.json({
        ok: true,
        normalized_names: normalizedNames,
      });
    } catch (openaiError: any) {
      console.error("[Normalize Channels] ❌ OpenAI error:", openaiError.message);
      console.error("[Normalize Channels] Error details:", openaiError);
      // Return original names on error (graceful degradation)
      return res.json({
        ok: true,
        normalized_names: channel_names,
        warning: `Normalization failed: ${openaiError.message}`,
      });
    }
  } catch (error) {
    console.error("Error in /ai/normalize-channels:", error);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/**
 * Get extension data endpoint
 * GET /extension/get-data?email=user@example.com
 * 
 * Returns extension data (blocked channels, watch history, goals, etc.) from Supabase
 */
app.get("/extension/get-data", async (req, res) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Email parameter required",
      });
    }

    // Get UUID from email (like dashboard does)
    const userEmail = email.toLowerCase().trim();
    const userId = await getUserIdFromEmail(userEmail);
    
    if (!userId) {
      return res.status(404).json({
        ok: false,
        error: "User not found",
      });
    }

    // Get extension data from Supabase using UUID
    const { data: extensionData, error: extensionError } = await supabase
      .from("extension_data")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Get user goals from users table (using email)
    // blocked_channels lives in extension_data only — not read from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("goals, pitfalls")
      .eq("email", userEmail)
      .single();

    // Parse goals (stored as TEXT in database, should be JSON array)
    let goals: string[] = [];
    if (userData?.goals) {
      try {
        goals = typeof userData.goals === "string" 
          ? JSON.parse(userData.goals) 
          : (Array.isArray(userData.goals) ? userData.goals : []);
      } catch (e) {
        console.warn("[Extension Data] Failed to parse goals:", e);
        goals = [];
      }
    }

    // Parse pitfalls (stored as TEXT in database, should be JSON array)
    let pitfalls: string[] = [];
    if (userData?.pitfalls) {
      try {
        pitfalls = typeof userData.pitfalls === "string"
          ? JSON.parse(userData.pitfalls)
          : (Array.isArray(userData.pitfalls) ? userData.pitfalls : []);
      } catch (e) {
        console.warn("[Extension Data] Failed to parse pitfalls:", e);
        pitfalls = [];
      }
    }

    if (extensionError && extensionError.code !== "PGRST116") {
      // PGRST116 = no rows found (acceptable)
      console.error("[Extension Data] Error fetching extension_data:", extensionError);
      return res.status(500).json({
        ok: false,
        error: "Failed to fetch extension data",
      });
    }

    // If no extension_data found, return defaults (but still include goals if available)
    if (extensionError && extensionError.code === "PGRST116") {
      return res.json({
        ok: true,
        data: {
          blocked_channels: [],
          watch_history: [],
          channel_spiral_count: {},
          settings: {},
          goals: goals,
          pitfalls: pitfalls,
        },
      });
    }

    // Check for pending full reset flag — consume it atomically
    const rawSettings = extensionData.settings || {};
    const pendingFullReset = rawSettings._pending_full_reset === true;
    let cleanedSettings = rawSettings;

    if (pendingFullReset) {
      // Remove the flag before returning settings to extension
      const { _pending_full_reset: _, ...settingsWithoutFlag } = rawSettings;
      cleanedSettings = settingsWithoutFlag;
      // Clear the flag in DB (best-effort — do not block response on failure)
      supabase
        .from("extension_data")
        .update({ settings: cleanedSettings, updated_at: new Date().toISOString() })
        .eq("user_id", extensionData.user_id)
        .then(({ error }) => {
          if (error) console.error("[Extension Data] Failed to clear _pending_full_reset:", error);
        });
    }

    res.json({
      ok: true,
      full_reset: pendingFullReset,
      data: {
        blocked_channels: extensionData.blocked_channels || [],
        watch_history: extensionData.watch_history || [],
        channel_spiral_count: extensionData.channel_spiral_count || {},
        settings: cleanedSettings,
        goals: goals,
        pitfalls: pitfalls,
      },
    });
  } catch (error) {
    console.error("Error in /extension/get-data:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/**
 * Save extension data endpoint
 * POST /extension/save-data
 * 
 * Saves extension data (blocked channels, watch history, goals, etc.) to Supabase
 * Body: { email: "user@example.com", data: { blocked_channels: [...], goals: [...], ... } }
 */
app.post("/extension/save-data", async (req, res) => {
  try {
    const { email, data } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Email is required",
      });
    }

    if (!data || typeof data !== "object") {
      return res.status(400).json({
        ok: false,
        error: "Data object is required",
      });
    }

    // Get UUID from email (like dashboard does)
    const userEmail = email.toLowerCase().trim();
    const userId = await getUserIdFromEmail(userEmail);
    
    if (!userId) {
      return res.status(404).json({
        ok: false,
        error: "User not found",
      });
    }

    // Check if user can record data (Pro or active Trial only)
    // Note: blocked_channels is exempt — it's a core free-tier feature
    const canRecord = await canUserRecord(userEmail);

    // ─────────────────────────────────────────────────────────────
    // SAFETY CHECK: Reject if blocked_channels list shrinks
    // Channels are permanently blocked - list can only grow
    // ─────────────────────────────────────────────────────────────
    if (data.blocked_channels !== undefined) {
      const incomingChannels = Array.isArray(data.blocked_channels) ? data.blocked_channels : [];
      const incomingCount = incomingChannels.length;
      
      // Check for admin override
      const adminSecret = req.headers['x-admin-secret'];
      const isAdminOverride = data.forceClear === true && 
                               process.env.ADMIN_SECRET && 
                               adminSecret === process.env.ADMIN_SECRET;
      
      // Get current blocked_channels from Supabase
      const { data: currentData } = await supabase
        .from("extension_data")
        .select("blocked_channels")
        .eq("user_id", userId)
        .single();
      
      const currentChannels = currentData?.blocked_channels || [];
      const currentCount = Array.isArray(currentChannels) ? currentChannels.length : 0;
      
      // Log the update attempt
      console.log(`[Extension Data] Blocked channels update attempt:`, {
        userId: userId.substring(0, 8) + "...",
        email: userEmail,
        currentCount: currentCount,
        incomingCount: incomingCount,
        isAdminOverride: isAdminOverride,
        timestamp: new Date().toISOString()
      });
      
      // Admin override: Allow clear if forceClear flag is set with correct secret
      if (isAdminOverride) {
        console.log(`[Extension Data] [ADMIN] Force clear allowed for ${userEmail}`);
        // Allow the save to proceed
      } else {
        // REJECT if list gets smaller (user trying to remove channels)
        if (incomingCount < currentCount) {
          console.error(`[Extension Data] [SAFETY] Rejecting blocked_channels update: ${currentCount} → ${incomingCount} (list cannot shrink)`);
          return res.status(400).json({
            ok: false,
            error: "Cannot remove blocked channels. Channels are permanently blocked. Use monthly reset feature to clear all.",
            currentCount: currentCount,
            incomingCount: incomingCount
          });
        }
        
        // REJECT if list is empty and user has existing channels
        if (incomingCount === 0 && currentCount > 0) {
          console.error(`[Extension Data] [SAFETY] Rejecting empty blocked_channels (user has ${currentCount} channels)`);
          return res.status(400).json({
            ok: false,
            error: "Cannot clear all blocked channels. Channels are permanently blocked.",
            currentCount: currentCount
          });
        }
        
        // Allow if: new user (both 0) OR list growing (incoming >= current)
        console.log(`[Extension Data] Blocked channels update allowed: ${currentCount} → ${incomingCount}`);
      }
    }

    // Upsert extension data (insert or update) using UUID
    if (data.user_id && data.user_id !== userId) {
      return res.status(400).json({
        ok: false,
        error: "user_id does not match authenticated user",
      });
    }

    // Block Pro-only writes if user can't record
    // blocked_channels is a core feature — allowed for ALL plans
    if (!canRecord) {
      const hasProOnlyFields = data.settings !== undefined ||
                                data.goals !== undefined ||
                                data.pitfalls !== undefined ||
                                data.channel_spiral_count !== undefined ||
                                data.channel_lifetime_stats !== undefined ||
                                data.watch_history !== undefined;
      if (hasProOnlyFields) {
        console.log(`[Extension Save] Blocked Pro-only writes for inactive plan: ${userEmail}`);
        return res.status(400).json({
          ok: false,
          error: "plan_inactive",
          message: "Upgrade to Pro to change settings"
        });
      }
      // Allow through — payload only contains blocked_channels (free-tier feature)
      console.log(`[Extension Save] Allowing blocked_channels write for ${userEmail} (free-tier feature)`);
    }

    const { error: extensionError } = await supabase
      .from("extension_data")
      .upsert({
        user_id: userId,
        blocked_channels: data.blocked_channels !== undefined ? data.blocked_channels : undefined,
        watch_history: data.watch_history !== undefined ? data.watch_history : undefined,
        channel_spiral_count: data.channel_spiral_count !== undefined ? data.channel_spiral_count : undefined,
        settings: data.settings !== undefined ? data.settings : undefined,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    if (extensionError) {
      console.error("[Extension Data] Error saving extension_data:", extensionError);
      return res.status(500).json({
        ok: false,
        error: "Failed to save extension data",
      });
    }

    // Save goals and anti_goals to users table if provided
    if (data.goals !== undefined || data.anti_goals !== undefined) {
      const updateData: any = {};
      
      if (data.goals !== undefined) {
        // Store goals as JSON string in TEXT column
        updateData.goals = Array.isArray(data.goals) 
          ? JSON.stringify(data.goals) 
          : (data.goals || null);
      }
      
      if (data.anti_goals !== undefined) {
        // Store anti_goals as JSON string in TEXT column
        updateData.anti_goals = Array.isArray(data.anti_goals)
          ? JSON.stringify(data.anti_goals)
          : (data.anti_goals || null);
      }

        if (Object.keys(updateData).length > 0) {
          updateData.updated_at = new Date().toISOString();
          
          const { error: userError } = await supabase
            .from("users")
            .update(updateData)
            .eq("email", userEmail);

        if (userError) {
          console.error("[Extension Data] Error saving goals:", userError);
          // Don't fail the whole request if goals save fails, but log it
        } else {
          console.log("[Extension Data] Goals saved successfully for", userId);
        }
      }
    }

    res.json({
      ok: true,
      message: "Extension data saved successfully",
    });
  } catch (error) {
    console.error("Error in /extension/save-data:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/**
 * Save daily counter state
 * POST /extension/save-timer
 * Accepts: { email, date, distracting_videos, distracting_seconds, neutral_videos,
 *            neutral_seconds, productive_videos, productive_seconds, total_seconds }
 */
app.post("/extension/save-timer", async (req, res) => {
  try {
    const {
      email,
      date,
      distracting_videos = 0,
      distracting_seconds = 0,
      neutral_videos = 0,
      neutral_seconds = 0,
      productive_videos = 0,
      productive_seconds = 0,
      total_seconds,
      // Legacy compat
      watch_seconds_today,
    } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ ok: false, error: "email is required" });
    }

    const userEmail = email.toLowerCase().trim();
    const userId = await getUserIdFromEmail(userEmail);
    if (!userId) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const today = date || new Date().toISOString().split("T")[0];
    const totalSec = typeof total_seconds === "number"
      ? total_seconds
      : (typeof watch_seconds_today === "number" ? watch_seconds_today : distracting_seconds + neutral_seconds + productive_seconds);

    // Read existing settings to merge
    const { data: existingData } = await supabase
      .from("extension_data")
      .select("settings")
      .eq("user_id", userId)
      .single();

    const settings: any = (existingData?.settings && typeof existingData.settings === "object")
      ? { ...existingData.settings }
      : {};

    // Write daily counter fields
    settings.timer_date = today;
    settings.timer_synced_at = new Date().toISOString();
    settings.distracting_videos = distracting_videos;
    settings.distracting_seconds = distracting_seconds;
    settings.neutral_videos = neutral_videos;
    settings.neutral_seconds = neutral_seconds;
    settings.productive_videos = productive_videos;
    settings.productive_seconds = productive_seconds;
    settings.total_seconds = totalSec;
    settings.watch_seconds_today = totalSec; // legacy field kept in sync

    const { error: updateError } = await supabase
      .from("extension_data")
      .upsert({ user_id: userId, settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (updateError) {
      console.error("[Save Timer] DB error:", updateError);
      return res.status(500).json({ ok: false, error: "Failed to save timer" });
    }

    console.log(`[Save Timer] Saved counters for ${userEmail} on ${today}`);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error in /extension/save-timer:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * Get today's daily counter state
 * GET /extension/get-timer?email=user@example.com&date=2026-03-20
 * Returns: { ok, date, distracting_videos, distracting_seconds, neutral_videos,
 *            neutral_seconds, productive_videos, productive_seconds, total_seconds }
 */
app.get("/extension/get-timer", async (req, res) => {
  try {
    const email = (req.query.email as string || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ ok: false, error: "email query parameter required" });
    }

    const userId = await getUserIdFromEmail(email);
    if (!userId) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const today = (req.query.date as string) || new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("extension_data")
      .select("settings")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[Get Timer] DB error:", error);
      return res.status(500).json({ ok: false, error: "Failed to fetch timer" });
    }

    const emptyCounters = {
      ok: true,
      date: today,
      distracting_videos: 0,
      distracting_seconds: 0,
      neutral_videos: 0,
      neutral_seconds: 0,
      productive_videos: 0,
      productive_seconds: 0,
      total_seconds: 0,
    };

    if (!data?.settings) return res.json(emptyCounters);

    const s = data.settings;
    const timerDate = s.timer_date || "";

    // Only return counters if they're for today
    if (timerDate !== today) return res.json(emptyCounters);

    res.json({
      ok: true,
      date: timerDate,
      distracting_videos: Number(s.distracting_videos || 0),
      distracting_seconds: Number(s.distracting_seconds || 0),
      neutral_videos: Number(s.neutral_videos || 0),
      neutral_seconds: Number(s.neutral_seconds || 0),
      productive_videos: Number(s.productive_videos || 0),
      productive_seconds: Number(s.productive_seconds || 0),
      total_seconds: Number(s.total_seconds || s.watch_seconds_today || 0),
      timer_synced_at: s.timer_synced_at || null,
    });
  } catch (error) {
    console.error("Error in /extension/get-timer:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * GET /dashboard/stats?email=
 * Returns aggregated dashboard statistics for the user
 */
app.get("/dashboard/stats", async (req, res) => {
  try {
    const email = (req.query.email as string)?.trim();
    if (!email) {
      return res.status(400).json({ ok: false, error: "email query parameter required" });
    }

    // Look up user in Supabase
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, plan")
      .eq("email", email)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Pull extension data blob (contains watch_history + lifetime stats + settings)
    const { data: extData, error: extError } = await supabase
      .from("extension_data")
      .select("*")
      .eq("user_id", userData.id)
      .single();

    if (extError && extError.code !== "PGRST116") {
      console.error("[Dashboard] Failed to load extension_data:", extError);
      return res.status(500).json({ ok: false, error: "Failed to load dashboard data" });
    }

    const extensionData = extData || {};
    let watchHistory: any[] = [];
    let watchHistorySource: "extension" | "supabase" = "supabase";
    const settings = extensionData.settings || {};
    const spiralEvents = Array.isArray(settings.spiral_events) ? settings.spiral_events : [];

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    try {
      const { data: sessionRows, error: sessionError } = await supabase
        .from("video_sessions")
        .select("video_id, video_title, channel_name, watch_seconds, watched_at, distraction_level, category_primary, confidence_distraction")
        .eq("user_id", userData.id)
        .gte("watched_at", sixtyDaysAgo.toISOString())
        .order("watched_at", { ascending: false });

      if (sessionError) {
        console.warn("[Dashboard] Failed to fetch video_sessions:", sessionError);
      } else if (Array.isArray(sessionRows) && sessionRows.length > 0) {
        watchHistory = sessionRows;
        watchHistorySource = "supabase";
      }
      if (Array.isArray(watchHistory) && watchHistory.length > 0) {
        watchHistory = watchHistory.sort((a: any, b: any) => {
          const timeA = new Date(a?.watched_at || 0).getTime();
          const timeB = new Date(b?.watched_at || 0).getTime();
          return timeB - timeA;
        });
      }
    } catch (error) {
      console.warn("[Dashboard] Exception fetching sessions:", (error as Error).message);
    }

    if (!Array.isArray(watchHistory) || watchHistory.length === 0) {
      return res.json({
        ok: true,
        hasData: false,
        message: "no_watch_history",
        focusScore7Day: 0,
        watchTime: {
          todayMinutes: 0,
          thisWeekMinutes: 0,
          breakdownToday: { productive: 0, neutral: 0, distracting: 0 },
          breakdownWeek: { productive: 0, neutral: 0, distracting: 0 },
        },
        topDistractionsThisWeek: [],
        topChannels: [],
        categoryBreakdown: [],
        cleanupSuggestion: {
          seconds: 0,
          minutes: 0,
          hasDistractions: false,
        },
        hourlyWatchTime: [],
        spiralEvents: [],
        streakDays: 0,
        weeklyTrendMinutes: [0, 0, 0, 0, 0, 0, 0],
        dataSource: watchHistorySource,
        windowDays: 60,
      });
    }

    // Helper accumulators
    let watchSecondsToday = 0;
    let watchSecondsWeek = 0;

    const breakdownToday = { productive: 0, neutral: 0, distracting: 0 };
    const breakdownWeek = { productive: 0, neutral: 0, distracting: 0 };

    const productiveWeekVideos = { total: 0, productive: 0, neutral: 0 };

    const distractionsMap: Record<string, { seconds: number; videos: number }> = {};

    watchHistory.forEach((entry: any) => {
      if (!entry?.watched_at) return;

      const watchedAt = new Date(entry.watched_at);
      const seconds = Number(entry.watch_seconds ?? entry.seconds ?? 0);
      const category = (entry.distraction_level ?? entry.category ?? "neutral").toLowerCase();
      const channel = (entry.channel_name ?? entry.channel ?? "Unknown").trim();

      if (!Number.isFinite(seconds) || seconds <= 0) return;

      // Today stats - watched_at is already UTC from database
      if (watchedAt >= startOfToday) {
        watchSecondsToday += seconds;
        if (breakdownToday[category as keyof typeof breakdownToday] !== undefined) {
          breakdownToday[category as keyof typeof breakdownToday] += seconds;
        }
      }

      // 7-day rolling window - watched_at is already UTC from database
      if (watchedAt >= sevenDaysAgo) {
        watchSecondsWeek += seconds;
        if (breakdownWeek[category as keyof typeof breakdownWeek] !== undefined) {
          breakdownWeek[category as keyof typeof breakdownWeek] += seconds;
        }

        productiveWeekVideos.total += 1;
        if (category === "productive") {
          productiveWeekVideos.productive += 1;
        } else if (category === "neutral") {
          productiveWeekVideos.neutral += 1;
        }

        // Track top distractions within week window
        if (category === "distracting") {
          if (!distractionsMap[channel]) {
            distractionsMap[channel] = { seconds: 0, videos: 0 };
          }
          distractionsMap[channel].seconds += seconds;
          distractionsMap[channel].videos += 1;
        }
      }
    });

    // Convert to minutes for display
    const watchTimeTodayMinutes = Math.round(watchSecondsToday / 60);
    const watchTimeWeekMinutes = Math.round(watchSecondsWeek / 60);

    // Focus score (rolling 7 days) - based on time (seconds), not video counts
    // Calculate as % of time spent on non-distracting content (productive + neutral)
    const totalWeekSeconds = breakdownWeek.productive + breakdownWeek.neutral + breakdownWeek.distracting;
    const focusScore7Day =
      totalWeekSeconds > 0
        ? Math.round(((breakdownWeek.productive + breakdownWeek.neutral) / totalWeekSeconds) * 100)
        : 0;

    // Category breakdown: aggregate by category_primary (last 30 days, matching Most Viewed Channels)
    const categoryBreakdown: Record<string, { videos: number; seconds: number }> = {};
    watchHistory.forEach((entry: any) => {
      // Only count entries from last 30 days (matching Most Viewed Channels time window)
      if (!entry.watched_at) return;
      const watchedAt = new Date(entry.watched_at);
      if (watchedAt < thirtyDaysAgo) return;
      
      const category = (entry.category_primary || "Other").trim();
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { videos: 0, seconds: 0 };
      }
      categoryBreakdown[category].videos += 1;
      categoryBreakdown[category].seconds += Number(entry.watch_seconds ?? entry.seconds ?? 0);
    });

    // Biggest distractions (top 5 channels by seconds)
    const topDistractionsThisWeek = Object.entries(distractionsMap)
      .map(([channel, stats]) => ({
        channel,
        seconds: stats.seconds,
        minutes: Math.round(stats.seconds / 60),
        videos: stats.videos,
      }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);

    const cleanupSuggestionSeconds = topDistractionsThisWeek.reduce((sum, item) => sum + item.seconds, 0);
    const cleanupSuggestionMinutes = Math.round(cleanupSuggestionSeconds / 60);

    // Time blocks: 12am-8am, 8am-12pm, 12pm-4pm, 4pm-8pm, 8pm-12am (7-day window, watch_seconds >= 45)
    const sevenDaysAgoForHourly = new Date();
    sevenDaysAgoForHourly.setDate(sevenDaysAgoForHourly.getDate() - 7);
    
    const timeBlocks = [
      { label: "12am–8am", hours: [0, 1, 2, 3, 4, 5, 6, 7] },
      { label: "8am–12pm", hours: [8, 9, 10, 11] },
      { label: "12pm–4pm", hours: [12, 13, 14, 15] },
      { label: "4pm–8pm", hours: [16, 17, 18, 19] },
      { label: "8pm–12am", hours: [20, 21, 22, 23] },
    ];
    
    const hourlyBreakdown = timeBlocks.map((block) => {
      let distractingSeconds = 0;
      let neutralSeconds = 0;
      let productiveSeconds = 0;
      
      watchHistory
        .filter((w: any) => {
          if (!w?.watched_at) return false;
          const watchedAt = new Date(w.watched_at);
          const seconds = Number(w.watch_seconds ?? w.seconds ?? 0);
          // Filter: 7-day window AND watch_seconds >= 45 AND hour matches bucket
          return watchedAt >= sevenDaysAgoForHourly && 
                 seconds >= 30 && 
                 block.hours.includes(watchedAt.getHours());
        })
        .forEach((w: any) => {
          const seconds = Number(w.watch_seconds ?? w.seconds ?? 0);
          const category = (w.distraction_level ?? w.category ?? "neutral").toLowerCase();
          
          if (category === "distracting") {
            distractingSeconds += seconds;
          } else if (category === "productive") {
            productiveSeconds += seconds;
          } else {
            neutralSeconds += seconds;
          }
        });
      
      // Convert to minutes and round to 1 decimal place
      return {
        bucket: block.label,
        distracting_minutes: Math.round((distractingSeconds / 60) * 10) / 10,
        neutral_minutes: Math.round((neutralSeconds / 60) * 10) / 10,
        productive_minutes: Math.round((productiveSeconds / 60) * 10) / 10,
      };
    });

    // Spiral events (last 30 days, top 20 most recent)
    const recentSpiralEvents = spiralEvents
      .filter((e: any) => {
        if (!e?.detected_at) return false;
        const eventDate = new Date(e.detected_at);
        return eventDate >= sevenDaysAgo; // Show last 7 days in dashboard
      })
      .sort((a: any, b: any) => {
        const timeA = new Date(a.detected_at).getTime();
        const timeB = new Date(b.detected_at).getTime();
        return timeB - timeA; // Most recent first
      })
      .slice(0, 20); // Top 20 most recent

    // Most viewed channels - calculate from watch_history (last 30 days)
    // thirtyDaysAgo already declared above (line 1457) - remove this duplicate
    
    // Category breakdown - also use last 30 days (matching Most Viewed Channels)
    const categoryBreakdown30Days: Record<string, { videos: number; seconds: number }> = {};
    
    const channelStats: Record<string, { videos: number; seconds: number; firstWatched: string | null; lastWatched: string | null }> = {};
    let totalWatchTimeLast30Days = 0; // Total seconds watched in last 30 days
    
    watchHistory.forEach((entry: any) => {
      // Only count entries from last 30 days
      if (!entry.watched_at) return;
      const watchedAt = new Date(entry.watched_at);
      if (watchedAt < thirtyDaysAgo) return;
      
      const channel = (entry.channel_name ?? entry.channel ?? "Unknown").trim();
      if (!channel || channel === "Unknown") return;
      
      const seconds = Number(entry.watch_seconds ?? entry.seconds ?? 0);
      totalWatchTimeLast30Days += seconds;
      
      if (!channelStats[channel]) {
        channelStats[channel] = {
          videos: 0,
          seconds: 0,
          firstWatched: entry.watched_at || null,
          lastWatched: entry.watched_at || null,
        };
      }
      
      channelStats[channel].videos += 1;
      channelStats[channel].seconds += seconds;
      
      // Update first/last watched timestamps
      const firstWatched = channelStats[channel].firstWatched ? new Date(channelStats[channel].firstWatched!) : null;
      const lastWatched = channelStats[channel].lastWatched ? new Date(channelStats[channel].lastWatched!) : null;
      
      if (!firstWatched || watchedAt < firstWatched) {
        channelStats[channel].firstWatched = entry.watched_at;
      }
      if (!lastWatched || watchedAt > lastWatched) {
        channelStats[channel].lastWatched = entry.watched_at;
      }
    });
    
    const topChannels = Object.entries(channelStats)
      .map(([channel, stats]) => {
        // Calculate percentage of total watch time (last 30 days)
        const percentage = totalWatchTimeLast30Days > 0
          ? Math.round((stats.seconds / totalWatchTimeLast30Days) * 100)
          : 0;
        
        return {
          channel,
          videos: stats.videos,
          seconds: stats.seconds,
          minutes: Math.round(stats.seconds / 60),
          percentage, // Percentage of watch time in last 30 days
          firstWatched: stats.firstWatched,
          lastWatched: stats.lastWatched,
        };
      })
      .sort((a, b) => b.seconds - a.seconds) // Sort by watch time (most viewed first)
      .slice(0, 5); // Top 5 channels

    // TEMP DEBUG: Check what's being counted
    console.log(`[Dashboard Debug] 7-day calculation:`, {
      sevenDaysAgo: sevenDaysAgo.toISOString(),
      sevenDaysAgoLocal: sevenDaysAgo.toString(),
      now: now.toISOString(),
      nowLocal: now.toString(),
      totalVideos: watchHistory.length,
      weekSeconds: watchSecondsWeek,
      weekMinutes: watchTimeWeekMinutes,
      videosInWeek: watchHistory.filter((e: any) => {
        const d = new Date(e.watched_at);
        return d >= sevenDaysAgo;
      }).length
    });
    
    // Check those 3 specific videos
    const problemVideos = watchHistory.filter((e: any) => {
      const channel = (e.channel_name || e.channel || "").toLowerCase();
      return channel.includes("alex yee") || 
             channel.includes("unknown") || 
             channel.includes("nico felich");
    });
    if (problemVideos.length > 0) {
      console.log(`[Dashboard Debug] Problem videos:`, problemVideos.map((v: any) => ({
        channel: v.channel_name || v.channel,
        watched_at: v.watched_at,
        watch_seconds: v.watch_seconds,
        isInWeek: new Date(v.watched_at) >= sevenDaysAgo,
        sevenDaysAgo: sevenDaysAgo.toISOString()
      })));
    }

    return res.json({
      ok: true,
      focusScore7Day,
      watchTime: {
        todayMinutes: watchTimeTodayMinutes,
        thisWeekMinutes: watchTimeWeekMinutes,
        breakdownToday,
        breakdownWeek,
      },
      topDistractionsThisWeek,
      topChannels,
      categoryBreakdown: Object.entries(categoryBreakdown)
        .map(([category, stats]) => ({
          category,
          videos: stats.videos,
          minutes: Math.round(stats.seconds / 60),
        }))
        .sort((a, b) => b.minutes - a.minutes) // Sort by watch time (minutes), not video count
        .slice(0, 10), // Top 10 categories
      cleanupSuggestion: {
        seconds: cleanupSuggestionSeconds,
        minutes: cleanupSuggestionMinutes,
        hasDistractions: cleanupSuggestionSeconds > 0,
      },
      hourlyWatchTime: hourlyBreakdown, // Array of 5 time buckets with distracting/neutral/productive minutes (last 7 days, watch_seconds >= 45)
      spiralEvents: recentSpiralEvents, // Array of spiral detection events (last 7 days, top 20)
      // Streak + weekly trend can be added later when we persist more history
      streakDays: 0,
      weeklyTrendMinutes: [0, 0, 0, 0, 0, 0, 0],
      dataSource: watchHistorySource,
      windowDays: 60,
    });
  } catch (error: any) {
    console.error("Error in /dashboard/stats:", error);
    return res.status(500).json({ ok: false, error: error.message || "Failed to load dashboard stats" });
  }
});

/**
 * Update user plan endpoint (dev/testing)
 * POST /user/update-plan
 * 
 * Updates user plan in Supabase (for testing)
 * Body: { email: "user@example.com", plan: "free" | "pro" | "trial", days_left?: number }
 * - If plan is "trial" and days_left is provided, calculates trial_expires_at
 */
app.post("/user/update-plan", async (req, res) => {
  try {
    const { email, plan, days_left } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Email is required",
      });
    }

    if (!plan || !["free", "pro", "trial"].includes(plan)) {
      return res.status(400).json({
        ok: false,
        error: "Plan must be 'free', 'pro', or 'trial'",
      });
    }

    // Calculate trial_expires_at from days_left if provided
    let trial_expires_at: string | null = null;
    if (plan === "trial" && days_left !== undefined) {
      const expiresDate = new Date();
      expiresDate.setDate(expiresDate.getDate() + days_left);
      trial_expires_at = expiresDate.toISOString();
    }

    // Update user plan in Supabase
    const updated = await updateUserPlan(email, plan, trial_expires_at);

    if (updated) {
      // Invalidate cache for this email (plan changed)
      const cacheKey = email.toLowerCase().trim();
      planCache.delete(cacheKey);
      console.log(`[Update Plan] Cache invalidated for ${email}, plan set to ${plan}`);
      
      res.json({
        ok: true,
        message: `Plan updated to ${plan}`,
        plan: plan,
        trial_expires_at: trial_expires_at || undefined,
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
 * Watch events endpoint (MVP stub - no-op)
 * POST /events/watch
 * 
 * Receives batched watch session data from extension
 * Body: { video_id, title, channel, seconds, started_at, finished_at }[]
 * Returns 200 OK (no-op for MVP)
 */
app.post("/events/watch", async (req, res) => {
  try {
    const { user_id, events } = req.body || {};

    if (!user_id || typeof user_id !== "string") {
      return res.status(400).json({ ok: false, error: "user_id is required" });
    }

    if (!Array.isArray(events)) {
      return res.status(400).json({ ok: false, error: "events must be an array" });
    }

    // Look up UUID from email (user_id is email from extension)
    const userEmail = user_id.toLowerCase().trim();
    const userId = await getUserIdFromEmail(userEmail);
    
    if (!userId) {
      console.warn("[Events] User not found for email:", userEmail);
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Check if user can record data (Pro or active Trial only)
    const canRecord = await canUserRecord(userEmail);
    if (!canRecord) {
      console.log(`[Events] Blocked watch event write for inactive plan: ${userEmail}`);
      return res.status(400).json({ 
        ok: false, 
        error: "plan_inactive", 
        message: "Upgrade to Pro to resume tracking" 
      });
    }
    type SanitizedEvent = {
      video_id: string;
      video_title?: string | null;
      channel_name?: string | null;
      watch_seconds: number;
      watched_at: string;
      distraction_level?: string | null;
      category_primary?: string | null;
      confidence_distraction?: number | null;
    };

    const sanitized: SanitizedEvent[] = events
      .map((event: any): SanitizedEvent | null => {
        if (!event || typeof event !== "object") return null;
        const videoId = (event.video_id || "").trim();
        const rawSeconds = Number(event.watch_seconds ?? event.seconds ?? 0);
        if (!videoId || !Number.isFinite(rawSeconds)) return null;

        const watchSeconds = Math.max(0, Math.floor(rawSeconds));
        const watchedAt = event.watched_at || event.finished_at || new Date().toISOString();

        return {
          video_id: videoId,
          video_title: event.video_title || event.title || null,
          channel_name: event.channel_name || event.channel || null,
          watch_seconds: watchSeconds,
          watched_at: watchedAt,
          distraction_level: event.distraction_level || event.category || null,
          category_primary: event.category_primary || null,
          confidence_distraction: event.confidence_distraction ?? null,
        };
      })
      .filter((event): event is SanitizedEvent => event !== null)
      .filter((event) => event.watch_seconds >= 30);

    if (sanitized.length === 0) {
      return res.json({ ok: true, count: 0 });
    }

    const inserted = await insertVideoSessions(sanitized, userId);
    if (!inserted) {
      return res.status(500).json({ ok: false, error: "Failed to insert video sessions" });
    }

    const pruned = await pruneVideoData(60, userId);
    if (!pruned) {
      console.warn("[Events] Video data pruning failed for", userId);
    }

    res.json({ ok: true, count: sanitized.length });
  } catch (error: any) {
    console.error("Error in /events/watch:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * Journal entry endpoint
 * POST /journal
 * 
 * Receives journal notes from extension and stores in Supabase
 * Body: { user_id: string, note: string, context: { url, title, channel, source } }
 * Returns 200 OK with success status
 */
app.post("/journal", async (req, res) => {
  try {
    const { user_id, note, distraction_level, context } = req.body || {};

    // Validate input
    if (!user_id || typeof user_id !== "string") {
      return res.status(400).json({
        ok: false,
        error: "user_id is required",
      });
    }

    if (!note || typeof note !== "string" || note.trim() === "") {
      return res.status(400).json({
        ok: false,
        error: "note is required",
      });
    }

    // Store journal entry in Supabase
    const success = await insertJournalEntry({
      user_id,
      note: note.trim(),
      distraction_level: distraction_level || null,
      context: context || {},
    });

    if (!success) {
      console.error("[Journal] Failed to insert journal entry");
      return res.status(500).json({
        ok: false,
        error: "Failed to store journal entry",
      });
    }

    console.log(`[Journal] Entry saved for user ${user_id}: ${note.substring(0, 50)}... (source: ${context?.source || "unknown"}, level: ${distraction_level || "unknown"})`);
    res.status(200).json({ ok: true, message: "Journal entry saved" });
  } catch (error: any) {
    console.error("[Journal] Error processing journal entry:", error);
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

    // Handle customer.subscription.deleted event (subscription cancelled)
    if (event.type === "customer.subscription.deleted" && stripeClient) {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      
      // Fetch customer email from Stripe
      if (customerId && typeof customerId === "string") {
        try {
          const customer = await stripeClient.customers.retrieve(customerId);
          if (customer && !customer.deleted && "email" in customer && customer.email) {
            const customerEmail = customer.email;
            
            // Downgrade user to "free" plan
            const updated = await updateUserPlan(customerEmail, "free");
            
            if (updated) {
              // Invalidate cache for this email (plan changed)
              const cacheKey = customerEmail.toLowerCase().trim();
              planCache.delete(cacheKey);
              console.log(`[Stripe Webhook] Downgraded ${customerEmail} to Free plan (subscription cancelled)`);
            } else {
              console.error(`[Stripe Webhook] Failed to downgrade plan for ${customerEmail}`);
            }
          }
        } catch (error) {
          console.error(`[Stripe Webhook] Error fetching customer ${customerId}:`, error);
        }
      }
    }

    // Handle customer.subscription.updated event (subscription status changed)
    if (event.type === "customer.subscription.updated" && stripeClient) {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const status = subscription.status;
      
      // If subscription is cancelled or past_due, downgrade to free
      if (status === "canceled" || status === "unpaid" || status === "past_due") {
        if (customerId && typeof customerId === "string") {
          try {
            const customer = await stripeClient.customers.retrieve(customerId);
            if (customer && !customer.deleted && "email" in customer && customer.email) {
              const customerEmail = customer.email;
              
              // Downgrade user to "free" plan
              const updated = await updateUserPlan(customerEmail, "free");
              
              if (updated) {
                // Invalidate cache for this email (plan changed)
                const cacheKey = customerEmail.toLowerCase().trim();
                planCache.delete(cacheKey);
                console.log(`[Stripe Webhook] Downgraded ${customerEmail} to Free plan (subscription ${status})`);
              } else {
                console.error(`[Stripe Webhook] Failed to downgrade plan for ${customerEmail}`);
              }
            }
          } catch (error) {
            console.error(`[Stripe Webhook] Error fetching customer ${customerId}:`, error);
          }
        }
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


/**
 * Admin endpoint to reset user counters for testing
 * POST /admin/reset-counters
 * 
 * Protected by ADMIN_SECRET header check
 * Body: { "email": "user@example.com" }
 * 
 * Resets:
 * - extension_data.settings.daily_limit_minutes to 0
 * - Deletes all video_sessions for today for this user
 */
app.post("/admin/reset-counters", async (req, res) => {
  try {
    // Check admin secret
    const adminSecret = req.headers['x-admin-secret'] as string;
    if (!adminSecret || !process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized - invalid or missing ADMIN_SECRET",
      });
    }

    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const userEmail = email.toLowerCase().trim();
    
    // Find user by email
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .limit(1);

    if (userError || !users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const userId = users[0].id;

    // Update extension_data: set settings.daily_limit_minutes = 0
    const { data: currentExtData } = await supabase
      .from("extension_data")
      .select("settings")
      .eq("user_id", userId)
      .single();

    const currentSettings = currentExtData?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      daily_limit_minutes: 0,
      focus_window_enabled: false,
      // Clear all counter data so stale values don't trigger blocks
      total_seconds: 0,
      distracting_seconds: 0,
      distracting_videos: 0,
      neutral_seconds: 0,
      neutral_videos: 0,
      productive_seconds: 0,
      productive_videos: 0,
      watch_seconds_today: 0,
      timer_date: null,
      timer_synced_at: null,
    };

    const { error: updateError } = await supabase
      .from("extension_data")
      .upsert({
        user_id: userId,
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (updateError) {
      console.error("[Admin Reset] Failed to update extension_data:", updateError);
      return res.status(500).json({
        success: false,
        error: "Failed to update settings",
      });
    }

    // Delete all video_sessions for today
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;

    const { error: deleteError } = await supabase
      .from("video_sessions")
      .delete()
      .eq("user_id", userId)
      .gte("watched_at", todayStart)
      .lte("watched_at", todayEnd);

    if (deleteError) {
      console.error("[Admin Reset] Failed to delete video_sessions:", deleteError);
      return res.status(500).json({
        success: false,
        error: "Failed to delete video sessions",
      });
    }

    console.log(`[Admin Reset] ✅ Reset counters for ${userEmail}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Admin Reset] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

/**
 * Admin endpoint to set a user's plan for testing
 * POST /admin/set-plan
 *
 * Accepts X-Admin-Secret or Authorization: Bearer <secret>
 * Body: { "email": "user@example.com", "plan": "free" | "trial" | "pro" }
 */
app.post("/admin/set-plan", async (req, res) => {
  try {
    // Accept both X-Admin-Secret and Authorization: Bearer <secret>
    const xSecret = req.headers['x-admin-secret'] as string;
    const authHeader = req.headers['authorization'] as string;
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const adminSecret = xSecret || bearerSecret;

    if (!adminSecret || !process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized - invalid or missing ADMIN_SECRET",
      });
    }

    const { email, plan } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email is required" });
    }
    if (!plan || !["free", "trial", "pro"].includes(plan)) {
      return res.status(400).json({ success: false, error: "Plan must be free, trial, or pro" });
    }

    const userEmail = email.toLowerCase().trim();

    const { error: updateError } = await supabase
      .from("users")
      .update({ plan, updated_at: new Date().toISOString() })
      .eq("email", userEmail);

    if (updateError) {
      console.error("[Admin Set Plan] Failed to update plan:", updateError);
      return res.status(500).json({ success: false, error: "Failed to update plan" });
    }

    console.log(`[Admin Set Plan] ✅ Set plan for ${userEmail} to ${plan}`);
    res.json({ success: true, email: userEmail, plan });
  } catch (error: any) {
    console.error("[Admin Set Plan] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
});

/**
 * Admin endpoint: full extension reset for test users
 * POST /admin/reset-extension
 *
 * Clears today's video_sessions and video_classifications,
 * resets extension_data.settings to clean defaults,
 * and sets _pending_full_reset flag so the extension wipes
 * local counter state on its next /extension/get-data poll.
 *
 * Rate limit: 10 calls/hour per IP.
 * Logs every call with timestamp and email.
 */
app.post("/admin/reset-extension", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

  if (!checkAdminRateLimit(ip)) {
    return res.status(429).json({ success: false, error: "Too many requests. Max 10 calls per hour." });
  }

  const xSecret = req.headers["x-admin-secret"] as string;
  const authHeader = req.headers["authorization"] as string;
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const adminSecret = xSecret || bearerSecret;

  if (!adminSecret || !process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ success: false, error: "Unauthorized - invalid or missing ADMIN_SECRET" });
  }

  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  const userEmail = email.toLowerCase().trim();
  console.log(`[Admin Reset Extension] ${new Date().toISOString()} — ${userEmail} — from ${ip}`);

  try {
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .limit(1);

    if (userError || !users || users.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const userId = users[0].id;

    // Delete today's video_sessions
    const today = new Date().toISOString().split("T")[0];
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;

    const { count: sessionCount, error: sessionError } = await supabase
      .from("video_sessions")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .gte("watched_at", todayStart)
      .lte("watched_at", todayEnd);

    if (sessionError) {
      console.error("[Admin Reset Extension] Failed to delete video_sessions:", sessionError);
      return res.status(500).json({ success: false, error: "Failed to delete video sessions" });
    }

    // Delete today's video_classifications
    const { count: classCount, error: classError } = await supabase
      .from("video_classifications")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .gte("classified_at", todayStart)
      .lte("classified_at", todayEnd);

    if (classError) {
      console.error("[Admin Reset Extension] Failed to delete video_classifications:", classError);
      return res.status(500).json({ success: false, error: "Failed to delete video classifications" });
    }

    // Reset extension_data.settings to clean defaults + set pending reset flag
    const cleanSettings = {
      block_shorts: false,
      hide_recommendations: false,
      daily_limit_minutes: 0,
      focus_window_enabled: false,
      focus_window_start: "08:00",
      focus_window_end: "22:00",
      _pending_full_reset: true,
    };

    const { error: updateError } = await supabase
      .from("extension_data")
      .upsert(
        { user_id: userId, settings: cleanSettings, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (updateError) {
      console.error("[Admin Reset Extension] Failed to update extension_data:", updateError);
      return res.status(500).json({ success: false, error: "Failed to reset settings" });
    }

    console.log(`[Admin Reset Extension] ✅ Done — ${userEmail} — sessions: ${sessionCount ?? 0}, classifications: ${classCount ?? 0}`);

    res.json({
      success: true,
      reset: {
        video_sessions_deleted: sessionCount ?? 0,
        video_classifications_deleted: classCount ?? 0,
        settings_reset: true,
      },
    });
  } catch (error: any) {
    console.error("[Admin Reset Extension] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
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

