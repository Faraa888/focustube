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
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  getUserPlan,
  updateUserPlan,
  upsertVideoClassification,
  updateVideoWatchTime,
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
  console.log("✅ OpenAI client initialized successfully");
} else {
  console.warn("⚠️  OPENAI_API_KEY not set - AI classification will return neutral");
}

// ─────────────────────────────────────────────────────────────
// AI PROMPT CONFIGURATION
// ─────────────────────────────────────────────────────────────
interface ClassifierPrompt {
  version: string;
  role: string;
  constraints: string[];
  input_schema: any;
  output_schema: any;
  decision_rules: string[];
  allowance_mapping: any;
  examples: any[];
  failsafe: any;
}

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
    const { 
      user_id, 
      text, // For search queries
      context, 
      user_goals,
      // Video metadata fields
      video_id,
      video_title,
      video_description,
      video_tags,
      channel_name,
      video_category,
      is_shorts,
      related_videos,
      duration_seconds,
      video_url // Phase 2: URL for server-side validation
    } = req.body;

    // Determine if this is a search (text) or watch (video_title) request
    const isVideoRequest = video_title && video_title.trim().length > 0;
    const isSearchRequest = text && text.trim().length > 0;
    
    const displayText = isVideoRequest ? video_title : (text || "unknown");
    console.log(`[AI Classify] Request received: ${displayText.substring(0, 50)}... (context: ${context || "watch"})`);

    // Step 6: Debug logging - show what metadata was received
    if (isVideoRequest) {
      console.log(`[AI Classify] Metadata received:`, {
        video_id: video_id || "MISSING",
        title: video_title?.substring(0, 50) || "MISSING",
        description_length: video_description?.length || 0,
        tags_count: Array.isArray(video_tags) ? video_tags.length : 0,
        channel: channel_name || "MISSING",
        category: video_category || "MISSING",
        related_videos_count: Array.isArray(related_videos) ? related_videos.length : 0,
        is_shorts: is_shorts || false,
        duration_seconds: duration_seconds || null,
        user_goals_count: Array.isArray(user_goals) ? user_goals.length : 0
      });
    }

    if (!user_id || (!isVideoRequest && !isSearchRequest)) {
      console.warn("[AI Classify] Missing required fields: user_id and either text (search) or video_title (watch)");
      return res.status(400).json({
        ok: false,
        error: "user_id and either text (search) or video_title (watch) are required",
      });
    }

    // Phase 2: Server-side validation - extract video_id from URL and compare
    if (isVideoRequest && video_url && video_id) {
      try {
        const urlObj = new URL(video_url);
        const urlVideoId = urlObj.searchParams.get("v");
        if (urlVideoId && urlVideoId !== video_id) {
          console.error(`[AI Classify] ⚠️ CRITICAL: video_id mismatch!`, {
            received_video_id: video_id,
            url_video_id: urlVideoId,
            url: video_url,
            title: video_title?.substring(0, 50)
          });
          // Use video_id from URL (more reliable)
          video_id = urlVideoId;
          console.log(`[AI Classify] Using video_id from URL: ${video_id}`);
        }
      } catch (e) {
        console.warn(`[AI Classify] Could not validate video_id from URL:`, e.message);
      }
    }

    // Phase 2: Cache key with title hash for additional validation
    // Use video_id + title hash to prevent wrong cache hits
    let cacheKey: string;
    if (isVideoRequest) {
      if (video_id) {
        // Phase 2: Add title hash to cache key for validation
        const titleHash = video_title ? video_title.toLowerCase().trim().substring(0, 30).replace(/[^a-z0-9]/g, '') : '';
        cacheKey = `${user_id}:${video_id}:${titleHash}`;
      } else {
        console.warn(`[AI Classify] ⚠️  video_id missing for video request - using title as cache key (less reliable)`);
        cacheKey = `${user_id}:${video_title}`.toLowerCase().trim();
      }
    } else {
      cacheKey = `${user_id}:${text}`.toLowerCase().trim();
    }
    console.log(`[AI Classify] Cache key: ${cacheKey.substring(0, 80)}...`);
    const cachedResult = getCached<any>(aiCache, cacheKey);
    if (cachedResult !== null) {
      const displayCategory = cachedResult.category_primary || cachedResult.category || "unknown";
      const displayDistraction = cachedResult.distraction_level || cachedResult.category || "neutral";
      const displayConfidence = cachedResult.confidence_distraction || cachedResult.confidence || 0.5;
      console.log(`[AI Classify] Cache hit: ${displayCategory} (${displayDistraction}, confidence: ${displayConfidence})`);
      return res.json(cachedResult);
    }

    // Fallback result if OpenAI is not configured or fails
    // Use failsafe from prompt config if available, then map to old schema for compatibility
    const failsafeNew = classifierPrompt?.failsafe || {
      category_primary: "Other",
      category_secondary: [],
      distraction_level: "neutral",
      confidence_category: 0.2,
      confidence_distraction: 0.2,
      goals_alignment: "unknown",
      reasons: ["fallback"],
      suggestions_summary: {
        on_goal_ratio: 0.0,
        shorts_ratio: 0.0,
        dominant_themes: []
      },
      flags: {
        is_shorts: false,
        clickbait_likelihood: 0.0,
        time_sink_risk: 0.0
      }
    };
    
    // Map new schema to old for backward compatibility
    let result: any = {
      // New schema fields (full)
      ...failsafeNew,
      // Old schema fields (for compatibility)
      category: failsafeNew.distraction_level || "neutral",
      confidence: failsafeNew.confidence_distraction || 0.5,
      reason: Array.isArray(failsafeNew.reasons) ? failsafeNew.reasons.join("; ") : (failsafeNew.reasons || "fallback"),
      tags: failsafeNew.suggestions_summary?.dominant_themes || [],
      block_reason_code: failsafeNew.flags?.time_sink_risk > 0.7 ? "likely-rabbit-hole" : "ok",
      action_hint: failsafeNew.distraction_level === "distracting" && failsafeNew.flags?.time_sink_risk > 0.7 ? "block" : "allow",
      allowance_cost: failsafeNew.distraction_level === "distracting" ? { type: "video", amount: 1 } : { type: "none", amount: 0 },
      allowed: failsafeNew.distraction_level !== "distracting"
    };

    // Call OpenAI if configured
    if (openaiClient) {
      console.log("[AI Classify] Calling OpenAI API...");
      try {
        // Build prompt from JSON config or use default
        let systemPrompt = "You are a content classifier that categorizes YouTube content for productivity. Respond with only one word: productive, neutral, or distracting.";
        
        let contentText = "";
        if (isVideoRequest) {
          contentText = `Video: "${video_title.replace(/"/g, '\\"')}"`;
          if (video_description) contentText += `\nDescription: "${video_description.substring(0, 200).replace(/"/g, '\\"')}"`;
          if (channel_name) contentText += `\nChannel: ${channel_name}`;
          if (video_category) contentText += `\nCategory: ${video_category}`;
        } else {
          contentText = `Content: "${text.replace(/"/g, '\\"')}"`;
        }
        
        let userPrompt = `Classify this YouTube content as one of three categories:
- "productive": Educational, learning, skill-building, informative content
- "neutral": Entertainment, relaxation, general interest content
- "distracting": Time-wasting, addictive, low-value content

${contentText}
${context ? `Context: ${context}` : ""}

Respond with ONLY one word: "productive", "neutral", or "distracting".`;

        // Use improved prompt if available
        if (classifierPrompt) {
          // Build simplified system prompt
          const rules = classifierPrompt.rules || [];
          const categorySet = classifierPrompt.category_set || [];
          const distractionLevels = classifierPrompt.distraction_levels || {};
          
          systemPrompt = `${classifierPrompt.role}

Key Rules:
${rules.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}

Distraction Levels:
${Object.entries(distractionLevels).map(([level, desc]) => `- ${level}: ${desc}`).join("\n")}

Category Guidelines (prefer these, but use descriptive name if content doesn't fit):
${categorySet.join(", ")}`;
          
          // Build user prompt in natural language format
          let videoInfoText = "";
          
          if (isVideoRequest) {
            // Format video data in readable way
            videoInfoText = `Title: ${video_title || "Unknown"}`;
            
            if (video_description) {
              const descPreview = video_description.substring(0, 300);
              videoInfoText += `\nDescription: ${descPreview}${video_description.length > 300 ? "..." : ""}`;
            }
            
            if (channel_name) {
              videoInfoText += `\nChannel: ${channel_name}`;
            }
            
            if (video_category) {
              videoInfoText += `\nYouTube Category: ${video_category}`;
            }
            
            if (video_tags && Array.isArray(video_tags) && video_tags.length > 0) {
              videoInfoText += `\nTags: ${video_tags.slice(0, 5).join(", ")}${video_tags.length > 5 ? "..." : ""}`;
            }
            
            if (is_shorts) {
              videoInfoText += `\nType: Shorts video`;
            }
            
            if (duration_seconds) {
              const minutes = Math.floor(duration_seconds / 60);
              const seconds = duration_seconds % 60;
              videoInfoText += `\nDuration: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
            
            // Add related videos context
            if (related_videos && Array.isArray(related_videos) && related_videos.length > 0) {
              videoInfoText += `\n\nRelated Videos:`;
              related_videos.slice(0, 3).forEach((rv: any, idx: number) => {
                const title = typeof rv === "string" ? rv : (rv.title || "Unknown");
                const channel = typeof rv === "object" ? (rv.channel_name || "") : "";
                const isShorts = typeof rv === "object" ? (rv.is_shorts || false) : false;
                videoInfoText += `\n${idx + 1}. ${title}${channel ? ` (${channel})` : ""}${isShorts ? " [Shorts]" : ""}`;
              });
            }
          } else {
            // Search query
            videoInfoText = `Search Query: ${text || "Unknown"}`;
          }
          
          // Add user goals if available
          let goalsText = "";
          if (user_goals && Array.isArray(user_goals) && user_goals.length > 0) {
            goalsText = `\n\nUser Goals: ${user_goals.join(", ")}`;
          }
          
          // Build step-by-step classification prompt
          userPrompt = `Classify this YouTube content:

${videoInfoText}${goalsText}

Answer these questions:
1. What category does this belong to? (Use category guidelines above, or a descriptive name if it doesn't fit)
2. Is it productive, neutral, or distracting? (Based on user goals if provided)
3. Why? (Provide 2 short reasons, max 120 chars each)

Return your answer as JSON matching this format:
${JSON.stringify(classifierPrompt.output_schema, null, 2)}

Important: Return ONLY valid JSON. No extra text or commentary.`;
        }

        const completion = await openaiClient.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500, // Increased for detailed structured JSON response (new schema has more fields)
          response_format: { type: "json_object" }, // Force JSON output
        });

        const responseText = completion.choices[0]?.message?.content?.trim() || "";
        
        // Parse JSON response
        let parsedResponse: any = null;
        try {
          parsedResponse = JSON.parse(responseText);
        } catch (parseError) {
          console.warn("[AI Classify] Failed to parse JSON response, retrying with strict instruction");
          // Retry once with strict instruction
          try {
            const retryCompletion = await openaiClient.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt + "\n\nReturn ONLY valid JSON. No prose." }
              ],
              temperature: 0.3,
              max_tokens: 500,
              response_format: { type: "json_object" },
            });
            const retryText = retryCompletion.choices[0]?.message?.content?.trim() || "";
            parsedResponse = JSON.parse(retryText);
          } catch (retryError) {
            console.error("[AI Classify] Retry also failed, using failsafe");
            parsedResponse = null;
          }
        }

        // Validate and normalize new schema response
        if (parsedResponse) {
          // Extract new schema fields
          const categoryPrimary = parsedResponse.category_primary || "Other";
          const categorySecondary = parsedResponse.category_secondary || [];
          const distractionLevel = parsedResponse.distraction_level || "neutral";
          const confidenceCategory = parsedResponse.confidence_category || 0.5;
          const confidenceDistraction = parsedResponse.confidence_distraction || 0.5;
          const goalsAlignment = parsedResponse.goals_alignment || "unknown";
          const reasons = Array.isArray(parsedResponse.reasons) ? parsedResponse.reasons : [parsedResponse.reason || "No reason provided"];
          const suggestionsSummary = parsedResponse.suggestions_summary || {
            on_goal_ratio: 0.0,
            shorts_ratio: 0.0,
            dominant_themes: []
          };
          const flags = parsedResponse.flags || {
            is_shorts: is_shorts || false,
            clickbait_likelihood: 0.0,
            time_sink_risk: 0.0
          };

          // Map new schema to old for backward compatibility
          const category = distractionLevel; // distraction_level maps to old category
          const confidence = confidenceDistraction; // Use distraction confidence
          const reason = reasons.join("; "); // Join reasons array
          const tags = suggestionsSummary.dominant_themes || [];
          const blockReasonCode = flags.time_sink_risk > 0.7 ? "likely-rabbit-hole" : 
                                 flags.clickbait_likelihood > 0.7 ? "clickbait" : "ok";
          const actionHint = distractionLevel === "distracting" && flags.time_sink_risk > 0.7 ? "block" :
                           distractionLevel === "distracting" ? "soft-warn" : "allow";
          const allowanceCost = distractionLevel === "distracting" ? { type: "video", amount: 1 } : { type: "none", amount: 0 };
          const allowed = distractionLevel !== "distracting";

          // Build full result with both new and old schema
          result = {
            // New schema (full)
            category_primary: categoryPrimary,
            category_secondary: categorySecondary,
            distraction_level: distractionLevel,
            confidence_category: confidenceCategory,
            confidence_distraction: confidenceDistraction,
            goals_alignment: goalsAlignment,
            reasons: reasons,
            suggestions_summary: suggestionsSummary,
            flags: flags,
            // Old schema (for compatibility)
            allowed,
            category,
            confidence,
            reason,
            tags,
            block_reason_code: blockReasonCode,
            action_hint: actionHint,
            allowance_cost: allowanceCost,
          };
        } else {
          // If parsing failed completely, use failsafe
          result = {
            ...failsafeNew,
            category: failsafeNew.distraction_level,
            confidence: failsafeNew.confidence_distraction,
            reason: Array.isArray(failsafeNew.reasons) ? failsafeNew.reasons.join("; ") : (failsafeNew.reasons || "fallback"),
            tags: failsafeNew.suggestions_summary?.dominant_themes || [],
            block_reason_code: failsafeNew.flags?.time_sink_risk > 0.7 ? "likely-rabbit-hole" : "ok",
            action_hint: failsafeNew.distraction_level === "distracting" ? "block" : "allow",
            allowance_cost: failsafeNew.distraction_level === "distracting" ? { type: "video", amount: 1 } : { type: "none", amount: 0 },
            allowed: failsafeNew.distraction_level !== "distracting"
          };
        }

        const displayTitle = isVideoRequest ? video_title : (text || "unknown");
        const displayCategory = result.category_primary || result.category || "unknown";
        const displayDistraction = result.distraction_level || result.category || "neutral";
        console.log(`[AI Classify] ✅ OpenAI response: ${displayTitle.substring(0, 50)}... → ${displayCategory} (${displayDistraction}, confidence: ${result.confidence_distraction || result.confidence})`);
      } catch (openaiError: any) {
        console.error("[AI Classify] ❌ OpenAI error:", openaiError.message || openaiError);
        // Fallback to failsafe from prompt config (already mapped above)
        result = {
          ...failsafeNew,
          category: failsafeNew.distraction_level,
          confidence: failsafeNew.confidence_distraction,
          reason: Array.isArray(failsafeNew.reasons) ? failsafeNew.reasons.join("; ") : (failsafeNew.reasons || "fallback"),
          tags: failsafeNew.suggestions_summary?.dominant_themes || [],
          block_reason_code: failsafeNew.flags?.time_sink_risk > 0.7 ? "likely-rabbit-hole" : "ok",
          action_hint: failsafeNew.distraction_level === "distracting" ? "block" : "allow",
          allowance_cost: failsafeNew.distraction_level === "distracting" ? { type: "video", amount: 1 } : { type: "none", amount: 0 },
          allowed: failsafeNew.distraction_level !== "distracting"
        };
      }
    } else {
      console.warn("[AI Classify] ⚠️ OpenAI client not initialized - using failsafe (returning neutral)");
      // Result already set to failsafe above (with mapping)
    }

    // Store classification for analytics (fire-and-forget)
    if (result && isVideoRequest && user_id) {
      upsertVideoClassification({
        user_id,
        video_id: video_id || "",
        video_title: video_title || text || "",
        channel_name: channel_name || null,
        video_category: video_category || null,
        distraction_level: result.distraction_level || result.category || null,
        category_primary: result.category_primary || null,
        confidence_distraction: result.confidence_distraction || result.confidence || null,
      }).catch((dbErr) => {
        console.warn("[AI Classify] Failed to upsert video classification (non-blocking):", dbErr);
      });
    }

    // Cache the result (even if it's a fallback)
    setCached(aiCache, cacheKey, result);

    res.json(result);
  } catch (error: any) {
    console.error("Error in /ai/classify:", error);
    // Always return a valid response, even on error
    // Use failsafe from prompt config
    const failsafeNew = classifierPrompt?.failsafe || {
      category_primary: "Other",
      category_secondary: [],
      distraction_level: "neutral",
      confidence_category: 0.2,
      confidence_distraction: 0.2,
      goals_alignment: "unknown",
      reasons: ["error_fallback"],
      suggestions_summary: {
        on_goal_ratio: 0.0,
        shorts_ratio: 0.0,
        dominant_themes: []
      },
      flags: {
        is_shorts: false,
        clickbait_likelihood: 0.0,
        time_sink_risk: 0.0
      }
    };
    
    res.status(500).json({
      ...failsafeNew,
      category: failsafeNew.distraction_level,
      confidence: failsafeNew.confidence_distraction,
      reason: Array.isArray(failsafeNew.reasons) ? failsafeNew.reasons.join("; ") : (failsafeNew.reasons || "error_fallback"),
      tags: failsafeNew.suggestions_summary?.dominant_themes || [],
      block_reason_code: "unknown",
      action_hint: "allow",
      allowance_cost: { type: "none", amount: 0 },
      allowed: true,
      error: "Internal server error",
    });
  }
});

/**
 * Update watch time for a classified video
 * POST /video/update-watch-time
 */
app.post("/video/update-watch-time", async (req, res) => {
  try {
    const { user_id, video_id, watch_seconds } = req.body || {};

    if (!user_id || !video_id || typeof watch_seconds !== "number" || watch_seconds < 0) {
      return res.status(400).json({ error: "Missing or invalid fields" });
    }

    const success = await updateVideoWatchTime(user_id, video_id, watch_seconds);
    if (!success) {
      return res.status(500).json({ error: "Failed to update watch time" });
    }

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

