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
 * Classifies YouTube content using OpenAI as productive, neutral, or distracting
 * Caches results for 24h per user/text
 */
app.post("/ai/classify", async (req, res) => {
  let fallbackLegacyResponse: any = null;
  try {
    const { 
      user_id, 
      text, // For search queries
      context, 
      user_goals,
      global_tag,
      // Video metadata fields
      video_id: initialVideoId,
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
    
    // Allow video_id to be reassigned if URL validation finds a mismatch
    let video_id = initialVideoId;

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

    // Fetch anti-goals from database for logging
    let userAntiGoals: string[] = [];
    if (user_id) {
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("anti_goals")
          .or(`id.eq.${user_id},email.eq.${user_id}`)
          .single();
        
        if (userData?.anti_goals) {
          userAntiGoals = typeof userData.anti_goals === "string"
            ? JSON.parse(userData.anti_goals)
            : (Array.isArray(userData.anti_goals) ? userData.anti_goals : []);
        }
      } catch (e) {
        // Silently fail - anti-goals not critical for classification
      }
    }

    // Enhanced logging for debugging in Render
    console.log(`[AI Classify] 📋 INPUT:`, JSON.stringify({
      title: video_title || text || "N/A",
      channel: channel_name || "N/A",
      user_goals: Array.isArray(user_goals) ? user_goals : (user_goals ? [user_goals] : []),
      user_anti_goals: userAntiGoals.length > 0 ? userAntiGoals : "None set",
      is_shorts: is_shorts || false,
      context: context || "watch"
    }, null, 2));

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
      } catch (e: any) {
        console.warn(`[AI Classify] Could not validate video_id from URL:`, e?.message || String(e));
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

    const relatedVideosList = Array.isArray(related_videos) ? related_videos : [];
    const derivedShortsRatio = relatedVideosList.length > 0
      ? relatedVideosList.filter((video: any) => video?.is_shorts).length / relatedVideosList.length
      : 0;

    const buildSuggestionsSummary = (incoming?: any) => ({
      on_goal_ratio: typeof incoming?.on_goal_ratio === "number" ? incoming.on_goal_ratio : 0,
      shorts_ratio: typeof incoming?.shorts_ratio === "number" ? incoming.shorts_ratio : derivedShortsRatio,
      dominant_themes: Array.isArray(incoming?.dominant_themes) ? incoming.dominant_themes : [],
    });

    const buildFlags = (incoming: any, distractionLevel: string) => ({
      is_shorts: typeof incoming?.is_shorts === "boolean" ? incoming.is_shorts : Boolean(is_shorts),
      clickbait_likelihood:
        typeof incoming?.clickbait_likelihood === "number"
          ? incoming.clickbait_likelihood
          : distractionLevel === "distracting"
            ? 0.75
            : 0.25,
      time_sink_risk:
        typeof incoming?.time_sink_risk === "number"
          ? incoming.time_sink_risk
          : distractionLevel === "distracting"
            ? 0.8
            : distractionLevel === "neutral"
              ? 0.4
              : 0.15,
    });

    const toLegacyResult = (payload: {
      category_primary: string;
      category_secondary?: string[];
      distraction_level: string;
      confidence: number;
      goals_alignment: string;
      reasons: string[];
      suggestions_summary?: any;
      flags?: any;
    }) => {
      const confidenceValue = typeof payload.confidence === "number" ? payload.confidence : 0.4;
      const reasonsList =
        Array.isArray(payload.reasons) && payload.reasons.length > 0
          ? payload.reasons.slice(0, 2)
          : ["No reason provided"];
      const suggestionsSummary = buildSuggestionsSummary(payload.suggestions_summary);
      const flags = buildFlags(payload.flags, payload.distraction_level);
      const blockReasonCode =
        flags.time_sink_risk > 0.7
          ? "likely-rabbit-hole"
          : flags.clickbait_likelihood > 0.7
            ? "clickbait"
            : "ok";
      const actionHint =
        payload.distraction_level === "distracting"
          ? flags.time_sink_risk > 0.7
            ? "block"
            : "soft-warn"
          : "allow";
      const allowanceCost =
        payload.distraction_level === "distracting"
          ? { type: "video", amount: 1 }
          : { type: "none", amount: 0 };
      const allowed = payload.distraction_level !== "distracting";

      return {
        category_primary: payload.category_primary,
        category_secondary: payload.category_secondary || [],
        distraction_level: payload.distraction_level,
        confidence_category: confidenceValue,
        confidence_distraction: confidenceValue,
        goals_alignment: payload.goals_alignment,
        reasons: reasonsList,
        suggestions_summary: suggestionsSummary,
        flags,
        allowed,
        category: payload.distraction_level,
        confidence: confidenceValue,
        reason: reasonsList.join("; "),
        tags: suggestionsSummary.dominant_themes,
        block_reason_code: blockReasonCode,
        action_hint: actionHint,
        allowance_cost: allowanceCost,
      };
    };

    const fallbackTemplate = classifierPrompt?.fallback || {
      category: "other",
      distraction_level: "neutral",
      confidence: 0.4,
      goals_alignment: "unknown",
      reasons: ["fallback"],
    };

    const fallbackLegacy = toLegacyResult({
      category_primary: fallbackTemplate.category || "other",
      category_secondary: [],
      distraction_level: fallbackTemplate.distraction_level || "neutral",
      confidence: typeof fallbackTemplate.confidence === "number" ? fallbackTemplate.confidence : 0.4,
      goals_alignment: fallbackTemplate.goals_alignment || "unknown",
      reasons:
        Array.isArray(fallbackTemplate.reasons) && fallbackTemplate.reasons.length > 0
          ? fallbackTemplate.reasons.slice(0, 2)
          : ["fallback"],
    });

    fallbackLegacyResponse = fallbackLegacy;
    let result: any = fallbackLegacy;

    // Call OpenAI if configured
    if (openaiClient) {
      console.log("[AI Classify] Calling OpenAI API...");
      try {
        const modelToUse =
          process.env.OPENAI_CLASSIFIER_MODEL ||
          classifierPrompt?.model_hint ||
          "gpt-4o-mini";

        const effectiveOutputSchema = classifierPrompt?.output_schema || DEFAULT_CLASSIFIER_OUTPUT_SCHEMA;
        const coreLogic = classifierPrompt?.core_logic || [
          "Productive = directly supports the user's stated goals.",
          "Neutral = practical or educational but not aligned with goals.",
          "Distracting = entertainment, gossip, sports highlights, vlogs, memes, gaming, reaction videos, compilations, or clickbait spirals.",
        ];
        const stepInstructions = classifierPrompt?.steps || [
          "Identify the topic from title + channel.",
          "Compare the topic to user goals.",
          "Decide productive vs neutral vs distracting.",
          "Provide two short reasons and stay concise.",
        ];

        const systemSections = [
          classifierPrompt?.role || "You classify YouTube videos for FocusTube.",
          "",
          "Core logic:",
          coreLogic.map((line, idx) => `${idx + 1}. ${line}`).join("\n"),
        ];

        if (classifierPrompt?.global_channel_tag) {
          const tagInfo = classifierPrompt.global_channel_tag;
          systemSections.push(
            "",
            "Global channel tag rules:",
            tagInfo.description || "",
            (tagInfo.rules || []).map((rule: string, idx: number) => `${idx + 1}. ${rule}`).join("\n")
          );
        }

        if (classifierPrompt?.shorts_rule) {
          systemSections.push("", `Shorts rule: ${classifierPrompt.shorts_rule}`);
        }

        systemSections.push("", "Only return valid JSON. No prose.");

        let systemPrompt = systemSections.filter(Boolean).join("\n");

        const infoLines: string[] = [];
          if (isVideoRequest) {
          infoLines.push(`Title: ${video_title || "Unknown"}`);
            if (video_description) {
              const descPreview = video_description.substring(0, 300);
            infoLines.push(`Description: ${descPreview}${video_description.length > 300 ? "..." : ""}`);
          }
          if (channel_name) infoLines.push(`Channel: ${channel_name}`);
          if (video_category) infoLines.push(`YouTube Category: ${video_category}`);
            if (video_tags && Array.isArray(video_tags) && video_tags.length > 0) {
            infoLines.push(`Tags: ${video_tags.slice(0, 5).join(", ")}${video_tags.length > 5 ? "..." : ""}`);
          }
          if (is_shorts) infoLines.push("Type: Shorts video");
            if (duration_seconds) {
              const minutes = Math.floor(duration_seconds / 60);
              const seconds = duration_seconds % 60;
            infoLines.push(`Duration: ${minutes}m ${seconds}s`);
            }
          } else {
          infoLines.push(`Search Query: ${text || "Unknown query"}`);
        }

        const goalsLine =
          user_goals && Array.isArray(user_goals) && user_goals.length > 0
            ? user_goals.join(", ")
            : "not provided";

        const suggestionsPreview =
          relatedVideosList.slice(0, 5)
            .map((video: any, idx: number) => {
              const title = video?.title || `Untitled suggestion ${idx + 1}`;
              return `- ${title}${video?.is_shorts ? " (Shorts)" : ""}`;
            })
            .join("\n") || "- none provided";

        const stepsSection = stepInstructions.map((step, idx) => `${idx + 1}. ${step}`).join("\n");

        let userPrompt = `Video context:
${infoLines.join("\n")}

User goals: ${goalsLine}
Global channel tag: ${global_tag || "none"}
Nearby suggestions:
${suggestionsPreview}

Follow these steps:
${stepsSection}

Return JSON matching this schema:
${JSON.stringify(effectiveOutputSchema, null, 2)}

No extra commentary.`;

        const completion = await openaiClient.chat.completions.create({
          model: modelToUse,
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
          max_tokens: 350,
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
              model: modelToUse,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt + "\n\nReturn ONLY valid JSON. No prose." }
              ],
              temperature: 0.3,
              max_tokens: 350,
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
          const categoryPrimary =
            parsedResponse.category ||
            parsedResponse.category_primary ||
            "other";
          const categorySecondary = parsedResponse.category_secondary || [];
          const distractionLevel =
            parsedResponse.distraction_level ||
            parsedResponse.category ||
            "neutral";
          const confidenceValue =
            typeof parsedResponse.confidence === "number"
              ? parsedResponse.confidence
              : typeof parsedResponse.confidence_distraction === "number"
                ? parsedResponse.confidence_distraction
                : 0.5;
          const goalsAlignment = parsedResponse.goals_alignment || "unknown";
          const reasons =
            Array.isArray(parsedResponse.reasons) && parsedResponse.reasons.length > 0
              ? parsedResponse.reasons.slice(0, 2)
              : ["No reason provided"];

          result = toLegacyResult({
            category_primary: categoryPrimary,
            category_secondary: categorySecondary,
            distraction_level: distractionLevel,
            confidence: confidenceValue,
            goals_alignment: goalsAlignment,
            reasons,
            suggestions_summary: parsedResponse.suggestions_summary,
            flags: parsedResponse.flags,
          });
        } else {
          // If parsing failed completely, use failsafe
          result = { ...fallbackLegacy };
        }

        const displayTitle = isVideoRequest ? video_title : (text || "unknown");
        const displayCategory = result.category_primary || result.category || "unknown";
        const displayDistraction = result.distraction_level || result.category || "neutral";
        
        // Enhanced output logging for debugging in Render
        console.log(`[AI Classify] ✅ OUTPUT:`, JSON.stringify({
          title: displayTitle.substring(0, 80),
          channel: channel_name || "N/A",
          user_goals: Array.isArray(user_goals) ? user_goals : (user_goals ? [user_goals] : []),
          user_anti_goals: userAntiGoals.length > 0 ? userAntiGoals : "None set",
          classification: displayDistraction,
          category: displayCategory,
          confidence: result.confidence_distraction || result.confidence || 0.5,
          reasons: Array.isArray(result.reasons) ? result.reasons : [result.reason || "N/A"]
        }, null, 2));
      } catch (openaiError: any) {
        console.error("[AI Classify] ❌ OpenAI error:", openaiError.message || openaiError);
        // Fallback to failsafe from prompt config (already mapped above)
        result = { ...fallbackLegacy };
      }
    } else {
      console.warn("[AI Classify] ⚠️ OpenAI client not initialized - using failsafe (returning neutral)");
      // Result already set to failsafe above (with mapping)
    }

    // Store classification for analytics (fire-and-forget)
    if (result && isVideoRequest && user_id) {
      // Look up UUID from email (user_id is email from extension)
      getUserIdFromEmail(user_id.toLowerCase().trim()).then((userId) => {
        if (!userId) {
          console.warn("[AI Classify] User not found for email, skipping classification save:", user_id);
          return;
        }
        return upsertVideoClassification({
          user_id: userId, // Use UUID instead of email
          video_id: video_id || "",
          video_title: video_title || text || "",
          channel_name: channel_name || null,
          video_category: video_category || null,
          distraction_level: result.distraction_level || result.category || null,
          category_primary: result.category_primary || null,
          confidence_distraction: result.confidence_distraction || result.confidence || null,
        });
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
    const errorFallback =
      fallbackLegacyResponse ||
      {
        category_primary: "other",
        category_secondary: [],
        distraction_level: "neutral",
        confidence_category: 0.4,
        confidence_distraction: 0.4,
        goals_alignment: "unknown",
        reasons: ["fallback", "classifier unavailable"],
        suggestions_summary: {
          on_goal_ratio: 0,
          shorts_ratio: 0,
          dominant_themes: [],
        },
        flags: {
          is_shorts: false,
          clickbait_likelihood: 0.2,
          time_sink_risk: 0.2,
        },
        category: "neutral",
        confidence: 0.4,
        reason: "fallback; classifier unavailable",
        tags: [],
        block_reason_code: "ok",
        action_hint: "allow",
        allowance_cost: { type: "none", amount: 0 },
        allowed: true,
      };

    res.status(500).json({
      ...errorFallback,
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

    // Look up UUID from email (user_id is email from extension)
    const userEmail = user_id.toLowerCase().trim();
    const userId = await getUserIdFromEmail(userEmail);
    
    if (!userId) {
      console.warn("[Update Watch Time] User not found for email:", userEmail);
      return res.status(404).json({ error: "User not found" });
    }

    const success = await updateVideoWatchTime(userId, video_id, watch_seconds);
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
 * Returns user plan and trial info from Supabase database (cached for 24h)
 * Response: { plan: "trial"|"pro"|"free", days_left?: number }
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
    const cachedPlanInfo = getCached<UserPlanInfo>(planCache, cacheKey);
    if (cachedPlanInfo !== null) {
      // For cached plan, return it with exists: true (cached plans are only for existing users)
      const { plan, trial_expires_at } = cachedPlanInfo;
      // Only log cache hits in development mode to reduce log noise
      if (process.env.NODE_ENV === "development") {
        console.log(`[License Verify] Cache hit for ${email}: ${plan}`);
      }
      
      // Calculate days_left for trial users
      let days_left: number | undefined = undefined;
      if (plan === "trial" && trial_expires_at) {
        const expiresAt = new Date(trial_expires_at);
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        days_left = Math.max(0, diffDays); // Don't return negative days
      }

      const response: any = {
        exists: true,
        plan,
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
      });
    } else {
      const { plan, trial_expires_at } = planInfo;
      console.log(`[License Verify] Fetched plan from Supabase for ${email}: ${plan}`);
      setCached(planCache, cacheKey, planInfo);

      // Calculate days_left for trial users
      let days_left: number | undefined = undefined;
      if (plan === "trial" && trial_expires_at) {
        const expiresAt = new Date(trial_expires_at);
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        days_left = Math.max(0, diffDays); // Don't return negative days
      }

      const response: any = { 
        exists: true,
        plan 
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
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("goals, anti_goals, distracting_channels")
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

    // Parse anti_goals (stored as TEXT in database, should be JSON array)
    let anti_goals: string[] = [];
    if (userData?.anti_goals) {
      try {
        anti_goals = typeof userData.anti_goals === "string"
          ? JSON.parse(userData.anti_goals)
          : (Array.isArray(userData.anti_goals) ? userData.anti_goals : []);
      } catch (e) {
        console.warn("[Extension Data] Failed to parse anti_goals:", e);
        anti_goals = [];
      }
    }

    // Parse distracting_channels (stored as TEXT in database, should be JSON array)
    let distracting_channels: string[] = [];
    if (userData?.distracting_channels) {
      try {
        distracting_channels = typeof userData.distracting_channels === "string"
          ? JSON.parse(userData.distracting_channels)
          : (Array.isArray(userData.distracting_channels) ? userData.distracting_channels : []);
      } catch (e) {
        console.warn("[Extension Data] Failed to parse distracting_channels:", e);
        distracting_channels = [];
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
          anti_goals: anti_goals,
          distracting_channels: distracting_channels,
        },
      });
    }

    res.json({
      ok: true,
      data: {
        blocked_channels: extensionData.blocked_channels || [],
        watch_history: extensionData.watch_history || [],
        channel_spiral_count: extensionData.channel_spiral_count || {},
        settings: extensionData.settings || {},
        goals: goals,
        anti_goals: anti_goals,
        distracting_channels: distracting_channels,
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
 * Save timer endpoint
 * POST /extension/save-timer
 * 
 * Saves watch timer to extension_data.settings for cross-device sync
 * Body: { email: "user@example.com", watch_seconds_today: 1800, date: "2025-01-13" }
 */
app.post("/extension/save-timer", async (req, res) => {
  try {
    const { email, watch_seconds_today, date } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Email is required",
      });
    }

    if (watch_seconds_today === undefined || typeof watch_seconds_today !== "number") {
      return res.status(400).json({
        ok: false,
        error: "watch_seconds_today is required and must be a number",
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

    const today = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get existing extension_data using UUID
    const { data: existingData, error: fetchError } = await supabase
      .from("extension_data")
      .select("settings")
      .eq("user_id", userId)
      .single();

    let settings: any = {};
    if (existingData && existingData.settings && typeof existingData.settings === 'object') {
      settings = existingData.settings;
    }

    // Update timer in settings
    settings.watch_seconds_today = watch_seconds_today;
    settings.timer_synced_at = new Date().toISOString();
    settings.timer_date = today;

    // Upsert extension_data with updated settings
    const { error: updateError } = await supabase
      .from("extension_data")
      .upsert({
        user_id: userId,
        settings: settings,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    if (updateError) {
      console.error("[Timer] Error saving timer:", updateError);
      return res.status(500).json({
        ok: false,
        error: "Failed to save timer",
      });
    }

    res.json({
      ok: true,
      message: "Timer saved successfully",
    });
  } catch (error) {
    console.error("Error in /extension/save-timer:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/**
 * Get timer endpoint
 * GET /extension/get-timer?email=user@example.com
 * 
 * Returns watch timer from extension_data.settings for cross-device sync
 */
app.get("/extension/get-timer", async (req, res) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Email is required",
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

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get extension_data using UUID
    const { data, error } = await supabase
      .from("extension_data")
      .select("settings")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[Timer] Error fetching timer:", error);
      return res.status(500).json({
        ok: false,
        error: "Failed to fetch timer",
      });
    }

    // If no data found, return 0
    if (!data || !data.settings) {
      return res.json({
        ok: true,
        watch_seconds_today: 0,
        timer_date: today,
      });
    }

    const settings = data.settings || {};
    const timerDate = settings.timer_date || today;
    
    // Only return timer if it's for today (don't use yesterday's timer)
    if (timerDate === today) {
      return res.json({
        ok: true,
        watch_seconds_today: Number(settings.watch_seconds_today || 0),
        timer_date: timerDate,
        timer_synced_at: settings.timer_synced_at || null,
      });
    } else {
      // Timer is for a different day, return 0
      return res.json({
        ok: true,
        watch_seconds_today: 0,
        timer_date: today,
      });
    }
  } catch (error) {
    console.error("Error in /extension/get-timer:", error);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
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
                 seconds >= 45 && 
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
      .filter((event) => event.watch_seconds >= 45);

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
    const { user_id, note, context } = req.body || {};

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
      context: context || {},
    });

    if (!success) {
      console.error("[Journal] Failed to insert journal entry");
      return res.status(500).json({
        ok: false,
        error: "Failed to store journal entry",
      });
    }

    console.log(`[Journal] Entry saved for user ${user_id}: ${note.substring(0, 50)}...`);
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

