// lib/state.js
// Handles storage, counters, plan, resets, and unlocks for FocusTube.
// This file runs in the background — it never touches the webpage directly.

// ─────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────
import {
  PERIOD_DAILY,
  PERIOD_WEEKLY,
  PERIOD_MONTHLY,
  PLAN_FREE,
  PLAN_PRO,
  PLAN_TRIAL,
  PLAN_TEST
} from "./constants.js";
import { CONFIG_BY_PLAN } from "./rules.js";

// ─────────────────────────────────────────────────────────────
// DEFAULT STORAGE VALUES
// ─────────────────────────────────────────────────────────────
// These keys live in chrome.storage.local.
// They are automatically created the first time the extension runs.
const DEFAULTS = {
  // Plan and rotation setup
  ft_plan: "free",                // free | pro | test | trial
  ft_user_email: "",              // user email for server sync
  ft_trial_expires_at: null,      // ISO timestamp when trial expires (null if not trial)
  ft_days_left: null,             // number of days left in trial (null if not trial)
  ft_user_goals: [],              // user goals array (for AI classification)
  ft_user_anti_goals: [],         // user anti-goals array (what distracts them)
  ft_user_distraction_channels: [], // user distraction channels array (channels that derail them)
  ft_onboarding_completed: false, // true = user has completed onboarding
  ft_reset_period: "daily",       // daily | weekly | monthly
  ft_last_reset_key: "",          // stores last date/week/month key

  // Activity counters
  ft_blocked_today: false,        // true = globally blocked
  ft_searches_today: 0,           // number of searches
  ft_short_visits_today: 0,       // number of shorts viewed (total scrolled)
  ft_shorts_engaged_today: 0,      // number of shorts engaged (>5 seconds watched)
  ft_watch_visits_today: 0,       // number of normal videos viewed
  ft_watch_seconds_today: 0,      // total watch time in seconds
  ft_shorts_seconds_today: 0,      // time spent on Shorts in seconds (Pro plan tracking)
  ft_block_shorts_today: false,    // true = hard block Shorts for today (Pro plan self-block)
  ft_pro_manual_block_shorts: false, // true = Pro user manually blocked Shorts (shows Pro overlay on redirects)

  // Unlock feature (used for "pay to unlock")
  ft_unlock_until_epoch: 0,        // timestamp when temporary unlock expires

  // AI Allowance (Pro users only - daily allowance for distracting content)
  ft_allowance_videos_left: 1,     // daily allowance for distracting videos (default: 1)
  ft_allowance_seconds_left: 600,  // daily allowance for distracting content in seconds (default: 10 minutes = 600 seconds)
  
  // Current video tracking (for allowance decrement)
  ft_current_video_classification: null,  // { videoId, category, startTime, title } or null
  
  // Watch event queue (batched analytics)
  ft_watch_event_queue: [],  // Array of watch session objects
  
  // Extension data (synced with Supabase)
  ft_blocked_channels: [],           // Array of blocked channel names
  ft_watch_history: [],              // Array of watch events (last 7 days)
  ft_channel_spiral_count: {},       // Object: {channel: {today, this_week, last_watched}}
  ft_extension_settings: {},         // Other extension settings
  
  // Focus Window (time-based blocking)
  ft_focus_window_enabled: false,    // true = focus window is active
  ft_focus_window_start: "13:00",    // Start time in 24h format (1:00 PM)
  ft_focus_window_end: "18:00",      // End time in 24h format (6:00 PM)
  
  // Spiral detection
  ft_blocked_channels_today: [],     // Temporary blocks (reset at midnight)
  ft_channel_lifetime_stats: {},     // Lifetime stats per channel for dashboard
  ft_spiral_detected: null,          // Current spiral flag {channel, count, type, message, detected_at}
  ft_spiral_events: []               // Array of spiral detection events (last 30 days)
};

// ─────────────────────────────────────────────────────────────
// CHROME STORAGE HELPERS
// ─────────────────────────────────────────────────────────────
export async function getLocal(keys) {
  return chrome.storage.local.get(keys);
}
export async function setLocal(obj) {
  return chrome.storage.local.set(obj);
}

// ─────────────────────────────────────────────────────────────
// ENSURE DEFAULTS EXIST
// ─────────────────────────────────────────────────────────────
// Checks if any keys are missing and fills them in.
// Called at startup or installation — safe to call anytime.
export async function ensureDefaults() {
  const current = await getLocal(Object.keys(DEFAULTS));
  const toSet = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (current[k] === undefined) toSet[k] = v;
  }
  if (Object.keys(toSet).length > 0) await setLocal(toSet);
}

// ─────────────────────────────────────────────────────────────
// RESET KEY BUILDERS
// ─────────────────────────────────────────────────────────────
// Used to decide if we’ve crossed into a new day/week/month.

function buildDailyKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`; // example: 2025-10-31
}

function buildWeeklyKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1..7 (Mon..Sun)
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // move to Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const w = String(weekNo).padStart(2, "0");
  return `${d.getUTCFullYear()}-W${w}`; // example: 2025-W44
}

function buildMonthlyKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // example: 2025-11
}

// ─────────────────────────────────────────────────────────────
// RESET SHAPE
// ─────────────────────────────────────────────────────────────
// Defines what gets cleared when the day/week/month changes.
function resetShape() {
  return {
    ft_searches_today: 0,
    ft_short_visits_today: 0,
    ft_shorts_engaged_today: 0,
    ft_shorts_seconds_today: 0,
    ft_watch_visits_today: 0,
    ft_watch_seconds_today: 0,
    ft_blocked_today: false,
    ft_block_shorts_today: false,
    ft_pro_manual_block_shorts: false,
    ft_unlock_until_epoch: 0,
    ft_allowance_videos_left: 1,      // Reset to default: 1 video
    ft_allowance_seconds_left: 600,   // Reset to default: 10 minutes (600 seconds)
    ft_current_video_classification: null  // Clear current video tracking
  };
}

// ─────────────────────────────────────────────────────────────
// ROTATION LOGIC
// ─────────────────────────────────────────────────────────────
// Called often to check if the date/week/month changed.
// If it has, resets all counters to zero.
export async function maybeRotateCounters(now = new Date()) {
  const { ft_reset_period, ft_last_reset_key } = await getLocal([
    "ft_reset_period",
    "ft_last_reset_key"
  ]);

  const period =
    ft_reset_period === PERIOD_WEEKLY  ? PERIOD_WEEKLY  :
    ft_reset_period === PERIOD_MONTHLY ? PERIOD_MONTHLY :
    PERIOD_DAILY;

  const currentKey =
    period === PERIOD_WEEKLY  ? buildWeeklyKey(now)  :
    period === PERIOD_MONTHLY ? buildMonthlyKey(now) :
    buildDailyKey(now);

  if (!ft_last_reset_key || ft_last_reset_key !== currentKey) {
    // Save daily totals before reset (only for daily period)
    if (period === PERIOD_DAILY && ft_last_reset_key) {
      // Get current counters before reset
      const current = await getLocal([
        "ft_watch_seconds_today",
        "ft_short_visits_today",
        "ft_searches_today",
        "ft_watch_visits_today"
      ]);

      // Build date key for storage (YYYY-MM-DD)
      const dateKey = ft_last_reset_key; // Already in YYYY-MM-DD format for daily
      const dailyTotalsKey = `ft_daily_totals_${dateKey}`;

      // Save daily totals
      const dailyTotals = {
        date: dateKey,
        watch_seconds: Number(current.ft_watch_seconds_today || 0),
        shorts_count: Number(current.ft_short_visits_today || 0),
        searches_count: Number(current.ft_searches_today || 0),
        videos_watched: Number(current.ft_watch_visits_today || 0),
        saved_at: new Date().toISOString()
      };

      await setLocal({ [dailyTotalsKey]: dailyTotals });
      console.log(`[FT] Daily totals saved for ${dateKey}:`, dailyTotals);
    }

    // Reset counters
    await setLocal({
      ...resetShape(),
      ft_last_reset_key: currentKey,
      ft_blocked_channels_today: []  // Clear temporary blocks on daily reset
      // Note: ft_channel_lifetime_stats is NOT reset (lifetime tracking)
    });
  }
}

// ─────────────────────────────────────────────────────────────
// COUNTERS
// ─────────────────────────────────────────────────────────────
// These bump the numbers stored in chrome.storage.
// Example: +1 every time a user searches.
export async function increment(key) {
  const cur = await getLocal([key]);
  const next = (cur[key] || 0) + 1;
  await setLocal({ [key]: next });
  return next;
}

export async function bump(key) {
  return increment(key);
}

// Optional helper wrappers for clarity
export const bumpSearches = () => bump("ft_searches_today");
export const bumpShorts  = () => bump("ft_short_visits_today");
export const bumpWatch   = () => bump("ft_watch_visits_today");

// Helper to increment engaged Shorts (watched > 5 seconds)
export async function incrementEngagedShorts() {
  const cur = await getLocal(["ft_shorts_engaged_today"]);
  const current = Number(cur.ft_shorts_engaged_today || 0);
  const next = current + 1;
  await setLocal({ ft_shorts_engaged_today: next });
  return next;
}

// Helper to increment Shorts watch time (in seconds)
export async function incrementShortsSeconds(seconds = 1) {
  const cur = await getLocal(["ft_shorts_seconds_today"]);
  const current = Number(cur.ft_shorts_seconds_today || 0);
  const next = current + seconds;
  await setLocal({ ft_shorts_seconds_today: next });
  return next;
}

// ─────────────────────────────────────────────────────────────
// GET AND RESET PERIOD
// ─────────────────────────────────────────────────────────────
export async function getResetPeriod() {
  const { ft_reset_period } = await getLocal(["ft_reset_period"]);
  if (ft_reset_period === PERIOD_WEEKLY)  return PERIOD_WEEKLY;
  if (ft_reset_period === PERIOD_MONTHLY) return PERIOD_MONTHLY;
  return PERIOD_DAILY;
}

export async function resetCounters() {
  await setLocal(resetShape());
}

// ─────────────────────────────────────────────────────────────
// PLAN CONFIG
// ─────────────────────────────────────────────────────────────
// Links plan name ("free" | "pro" | "test") to its limits.
export { CONFIG_BY_PLAN };

/**
 * Get trial status - checks if trial is expired
 * @returns { plan, days_left } where plan is the effective plan (trial -> free if expired)
 */
export async function getTrialStatus() {
  const { ft_plan, ft_days_left } = await getLocal(["ft_plan", "ft_days_left"]);
  
  // If not on trial, return current plan
  if (ft_plan !== PLAN_TRIAL) {
    return { plan: ft_plan || PLAN_FREE, days_left: null };
  }
  
  // If on trial, check if expired
  const daysLeft = typeof ft_days_left === "number" ? ft_days_left : null;
  if (daysLeft !== null && daysLeft <= 0) {
    // Trial expired - treat as free
    return { plan: PLAN_FREE, days_left: 0 };
  }
  
  // Trial active
  return { plan: PLAN_TRIAL, days_left: daysLeft };
}

export async function getPlanConfig() {
  const { ft_plan } = await getLocal(["ft_plan"]);
  const plan =
    ft_plan === PLAN_PRO   ? PLAN_PRO   :
    ft_plan === PLAN_TRIAL ? PLAN_TRIAL :
    ft_plan === PLAN_TEST  ? PLAN_TEST  :
    PLAN_FREE;
  
  // Check if trial is expired - if so, use free config
  let effectivePlan = plan;
  if (plan === PLAN_TRIAL) {
    const trialStatus = await getTrialStatus();
    if (trialStatus.plan === PLAN_FREE) {
      effectivePlan = PLAN_FREE;
    } else {
      effectivePlan = PLAN_PRO; // Active trial gets Pro features
    }
  } else {
    effectivePlan = plan;
  }
  
  return { plan, config: CONFIG_BY_PLAN[effectivePlan] };
}

export async function setPlan(plan) {
  const valid =
    plan === PLAN_PRO   ? PLAN_PRO   :
    plan === PLAN_TRIAL ? PLAN_TRIAL :
    plan === PLAN_TEST  ? PLAN_TEST  :
    PLAN_FREE;
  await setLocal({ ft_plan: valid });
  return valid;
}

// ─────────────────────────────────────────────────────────────
// SERVER SYNC (fetch plan from Express server)
// ─────────────────────────────────────────────────────────────

// Server URL (production)
const SERVER_URL = "https://focustube-backend-4xah.onrender.com";

// Debounce: only sync once per 30 seconds
let lastSyncTime = 0;
const SYNC_DEBOUNCE_MS = 30 * 1000; // 30 seconds

/**
 * Fetch user plan and trial info from server
 * @param email - User email
 * @returns { plan, days_left, trial_expires_at } or null if error
 */
export async function fetchUserPlanFromServer(email) {
  if (!email || email.trim() === "") {
    console.warn("[FT] No email provided, cannot sync plan");
    return null;
  }

  try {
    const url = `${SERVER_URL}/license/verify?email=${encodeURIComponent(email)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[FT] Server error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const planRaw = data?.plan;

    // Normalize plan to lowercase (handle "Pro", "PRO", etc.)
    const plan = typeof planRaw === "string" ? planRaw.toLowerCase() : null;

    if (plan === "free" || plan === "pro" || plan === "test" || plan === "trial") {
      return {
        plan,
        days_left: data?.days_left ?? null,
        trial_expires_at: data?.trial_expires_at ?? null,
      };
    }

    console.warn("[FT] Invalid plan from server:", planRaw);
    return null;
  } catch (error) {
    console.warn("[FT] Failed to fetch plan from server:", error.message);
    return null;
  }
}

/**
 * Sync plan from server (debounced)
 * Fetches plan and trial info from server and saves to Chrome storage
 * @param force - Force sync even if debounced (default: false)
 * @returns true if synced, false if skipped or failed
 */
export async function syncPlanFromServer(force = false) {
  const now = Date.now();

  // Debounce: only sync once per 30 seconds (unless forced)
  // For production, sync every 6 hours (21600000 ms) instead of 30 seconds
  const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  if (!force && now - lastSyncTime < SYNC_INTERVAL_MS) {
    console.log("[FT] Plan sync skipped (debounced)");
    return false;
  }

  // Get user email from storage
  const { ft_user_email } = await getLocal(["ft_user_email"]);

  if (!ft_user_email || ft_user_email.trim() === "") {
    // Not signed in - default to free plan
    console.log("[FT] No email set, defaulting to free plan");
    await setPlan("free");
    return true;
  }

  // Fetch plan and trial info from server
  const planInfo = await fetchUserPlanFromServer(ft_user_email);

  if (planInfo === null) {
    // Server error - use cached plan (don't crash)
    console.warn("[FT] Server unavailable, using cached plan");
    return false;
  }

  // Save plan to storage (even if trial info is missing)
  // This ensures plan sync works even if trial_expires_at column doesn't exist yet
  if (planInfo.plan) {
    await setPlan(planInfo.plan);
  } else {
    console.warn("[FT] No plan in server response, skipping sync");
    return false;
  }
  
  // Save trial info if present
  const toStore = {};
  if (planInfo.days_left !== null && planInfo.days_left !== undefined) {
    toStore.ft_days_left = planInfo.days_left;
  }
  if (planInfo.trial_expires_at !== null && planInfo.trial_expires_at !== undefined) {
    toStore.ft_trial_expires_at = planInfo.trial_expires_at;
  } else if (planInfo.plan !== "trial") {
    // Clear trial data if not on trial
    toStore.ft_trial_expires_at = null;
    toStore.ft_days_left = null;
  }
  
  if (Object.keys(toStore).length > 0) {
    await setLocal(toStore);
  }
  
  lastSyncTime = now;

  if (planInfo.plan === "trial" && planInfo.days_left !== null) {
    console.log(`[FT] Plan synced from server: ${planInfo.plan} (${planInfo.days_left} days left)`);
  } else {
    console.log(`[FT] Plan synced from server: ${planInfo.plan}`);
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// TEMPORARY UNLOCK
// ─────────────────────────────────────────────────────────────
// Used when a user "pays to unlock" or temporarily bypasses blocks.
export async function isTemporarilyUnlocked(now = Date.now()) {
  const { ft_unlock_until_epoch } = await getLocal(["ft_unlock_until_epoch"]);
  return typeof ft_unlock_until_epoch === "number" && now < ft_unlock_until_epoch;
}

export async function setTemporaryUnlock(minutes = 10) {
  const until = Date.now() + minutes * 60 * 1000;
  await setLocal({ ft_unlock_until_epoch: until });
}

// ─────────────────────────────────────────────────────────────
// EXTENSION DATA SYNC (blocked channels, watch history, etc.)
// ─────────────────────────────────────────────────────────────

/**
 * Merge blocked channels from local and server sources
 * - Combines both arrays, dedupes case-insensitively
 * - Preserves original case (prefers server, falls back to local)
 * - Never returns empty array unless both sources are truly empty
 * @param {string[]} localChannels - Channels from local storage
 * @param {string[]} serverChannels - Channels from server (may be null/undefined)
 * @returns {string[]} Merged and deduplicated array
 */
function mergeBlockedChannels(localChannels, serverChannels) {
  // Normalize inputs: treat null/undefined as empty array
  const local = Array.isArray(localChannels) ? localChannels : [];
  const server = Array.isArray(serverChannels) ? serverChannels : [];
  
  // If both are empty, return empty array
  if (local.length === 0 && server.length === 0) {
    return [];
  }
  
  // If only one exists, use it (after filtering invalid entries)
  if (local.length === 0) {
    return server.filter(ch => ch && typeof ch === 'string' && ch.trim().length > 0);
  }
  if (server.length === 0) {
    return local.filter(ch => ch && typeof ch === 'string' && ch.trim().length > 0);
  }
  
  // Both exist: merge and dedupe
  // Use Map with normalized (lowercase, trimmed) key to track seen channels
  const channelMap = new Map(); // key: normalized name, value: original case string
  
  // Add local channels first (preserve local case initially)
  local.forEach(channel => {
    if (!channel || typeof channel !== 'string') return;
    const normalized = channel.trim().toLowerCase();
    if (normalized.length > 0 && !channelMap.has(normalized)) {
      channelMap.set(normalized, channel.trim()); // Preserve original case
    }
  });
  
  // Add server channels (server case takes precedence if duplicate)
  server.forEach(channel => {
    if (!channel || typeof channel !== 'string') return;
    const normalized = channel.trim().toLowerCase();
    if (normalized.length > 0) {
      channelMap.set(normalized, channel.trim()); // Server case overwrites local
    }
  });
  
  // Convert back to array
  return Array.from(channelMap.values());
}

/**
 * Load extension data from server (blocked channels, watch history, etc.)
 * @returns {Promise<Object|null>} Extension data or null if failed
 */
export async function loadExtensionDataFromServer() {
  try {
    const { ft_user_email } = await getLocal(["ft_user_email"]);
    
    if (!ft_user_email || ft_user_email.trim() === "") {
      console.log("[FT] No email set, skipping extension data load");
      return null;
    }

    const response = await fetch(
      `${SERVER_URL}/extension/get-data?email=${encodeURIComponent(ft_user_email)}`
    );

    if (!response.ok) {
      console.warn("[FT] Failed to load extension data:", response.status);
      return null;
    }

    const result = await response.json();
    
    if (!result.ok || !result.data) {
      console.warn("[FT] Invalid extension data response:", result);
      return null;
    }

    // Save to local storage
    const { 
      blocked_channels, 
      watch_history, 
      channel_spiral_count, 
      settings,
      goals,
      anti_goals
    } = result.data;
    
    const { ft_watch_history: localWatchHistory = [] } = await getLocal(["ft_watch_history"]);
    const { ft_blocked_channels: localBlockedChannels = [] } = await getLocal(["ft_blocked_channels"]);
    const serverWatchHistory = watch_history || [];
    const serverBlockedChannels = blocked_channels;
    
    // Smart merge: combine both, dedupe by video_id + watched_at, keep most recent
    // This prevents data loss when server has old data and local has new data
    const historyMap = new Map();

    // Add local entries first
    localWatchHistory.forEach(entry => {
      if (!entry.video_id || !entry.watched_at) return; // Skip invalid entries
      const key = `${entry.video_id}_${entry.watched_at}`;
      historyMap.set(key, entry);
    });

    // Add server entries (will only add if not already present, or if server has newer data)
    serverWatchHistory.forEach(entry => {
      if (!entry.video_id || !entry.watched_at) return; // Skip invalid entries
      const key = `${entry.video_id}_${entry.watched_at}`;
      if (!historyMap.has(key)) {
        // New entry from server - add it
        historyMap.set(key, entry);
      } else {
        // Entry exists - keep the one with more recent watched_at timestamp
        const existing = historyMap.get(key);
        const existingTime = new Date(existing.watched_at).getTime();
        const serverTime = new Date(entry.watched_at).getTime();
        if (serverTime > existingTime) {
          historyMap.set(key, entry); // Server has newer version
        }
      }
    });

    // Convert back to array and sort by watched_at (newest first)
    const mergedWatchHistory = Array.from(historyMap.values())
      .sort((a, b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime());

    // Merge blocked channels: combine local + server, dedupe case-insensitively
    // This prevents data loss when server has stale/empty data
    const mergedBlockedChannels = mergeBlockedChannels(localBlockedChannels, serverBlockedChannels);
    
    // If server data was stale (local had channels server didn't), schedule background sync
    const serverHadStaleData = Array.isArray(serverBlockedChannels) && 
                                serverBlockedChannels.length < localBlockedChannels.length &&
                                mergedBlockedChannels.length > serverBlockedChannels.length;
    
    if (serverHadStaleData) {
      // Schedule background sync to update server with merged data
      // Don't await - let it happen in background
      saveExtensionDataToServer().catch((err) => {
        console.warn("[FT] Background sync of merged blocked channels failed (non-critical):", err);
      });
    }

    const storageUpdate = {
      ft_blocked_channels: mergedBlockedChannels,
      ft_watch_history: mergedWatchHistory,
      ft_channel_spiral_count: channel_spiral_count || {},
      ft_extension_settings: settings || {},
    };
    
    // Load focus window settings and spiral events from settings object if present
    if (settings && typeof settings === 'object') {
      if (settings.focus_window_enabled !== undefined) {
        storageUpdate.ft_focus_window_enabled = settings.focus_window_enabled;
      }
      if (settings.focus_window_start !== undefined) {
        storageUpdate.ft_focus_window_start = settings.focus_window_start;
      }
      if (settings.focus_window_end !== undefined) {
        storageUpdate.ft_focus_window_end = settings.focus_window_end;
      }
      if (settings.spiral_events !== undefined) {
        storageUpdate.ft_spiral_events = Array.isArray(settings.spiral_events) ? settings.spiral_events : [];
      }
    }

    // Load goals if provided (from users table)
    if (goals !== undefined) {
      storageUpdate.ft_user_goals = Array.isArray(goals) ? goals : [];
    }

    // Load anti_goals if provided (from users table)
    if (anti_goals !== undefined) {
      storageUpdate.ft_user_anti_goals = Array.isArray(anti_goals) ? anti_goals : [];
    }

    // Load distracting_channels if provided (from users table)
    const distracting_channels = result.data?.distracting_channels;
    if (distracting_channels !== undefined) {
      storageUpdate.ft_user_distraction_channels = Array.isArray(distracting_channels) ? distracting_channels : [];
    }
    
    await setLocal(storageUpdate);
    
    // Merge timer from server (for cross-device sync)
    await mergeTimerFromServer().catch((err) => {
      console.warn("[FT] Failed to merge timer from server (non-critical):", err);
    });

    console.log("[FT] Extension data loaded from server:", {
      blockedChannels: (blocked_channels || []).length,
      watchHistory: (watch_history || []).length,
      goals: (goals || []).length,
      antiGoals: (anti_goals || []).length,
      distractionChannels: (distracting_channels || []).length,
    });

    return result.data;
  } catch (error) {
    console.warn("[FT] Error loading extension data:", error.message);
    return null;
  }
}

/**
 * Save extension data to server (blocked channels, watch history, etc.)
 * @param {Object} data - Data to save (optional, will use local storage if not provided)
 * @returns {Promise<boolean>} True if saved successfully
 */
export async function saveExtensionDataToServer(data = null) {
  try {
    const { ft_user_email } = await getLocal(["ft_user_email"]);
    
    if (!ft_user_email || ft_user_email.trim() === "") {
      console.log("[FT] No email set, skipping extension data save");
      return false;
    }

    // Get current local data
    const {
      ft_blocked_channels = [],
      ft_watch_history = [],
      ft_channel_spiral_count = {},
      ft_extension_settings = {},
      ft_user_goals = [],
      ft_user_anti_goals = [],
      ft_channel_lifetime_stats = {},
      ft_focus_window_enabled = false,
      ft_focus_window_start = "13:00",
      ft_focus_window_end = "18:00",
      ft_spiral_events = [],
    } = await getLocal([
      "ft_blocked_channels",
      "ft_watch_history",
      "ft_channel_spiral_count",
      "ft_extension_settings",
      "ft_user_goals",
      "ft_user_anti_goals",
      "ft_channel_lifetime_stats",
      "ft_focus_window_enabled",
      "ft_focus_window_start",
      "ft_focus_window_end",
      "ft_spiral_events",
    ]);

    // Merge focus window settings and spiral events into settings object
    const settingsToSave = {
      ...ft_extension_settings,
      focus_window_enabled: ft_focus_window_enabled,
      focus_window_start: ft_focus_window_start,
      focus_window_end: ft_focus_window_end,
      spiral_events: ft_spiral_events, // Store in settings JSONB for now
    };

    // Use provided data or fall back to local storage
    const toSave = data || {
      blocked_channels: ft_blocked_channels,
      watch_history: ft_watch_history,
      channel_spiral_count: ft_channel_spiral_count,
      settings: settingsToSave,
      goals: ft_user_goals,
      anti_goals: ft_user_anti_goals,
      channel_lifetime_stats: ft_channel_lifetime_stats,
    };
    
    // Always merge missing fields from local storage (even if data is provided)
    if (data) {
      // Merge core fields if not provided
      if (data.blocked_channels === undefined) {
        toSave.blocked_channels = ft_blocked_channels;
      }
      if (data.watch_history === undefined) {
        toSave.watch_history = ft_watch_history;
      }
      if (data.channel_spiral_count === undefined) {
        toSave.channel_spiral_count = ft_channel_spiral_count;
      }
    }
    
    // Always ensure settings include focus window and spiral_events (even if data is provided)
    if (!data || !data.settings) {
      toSave.settings = settingsToSave;
    } else {
      // Merge focus window and spiral_events into provided settings
      toSave.settings = {
        ...data.settings,
        focus_window_enabled: data.settings.focus_window_enabled !== undefined 
          ? data.settings.focus_window_enabled 
          : ft_focus_window_enabled,
        focus_window_start: data.settings.focus_window_start || ft_focus_window_start,
        focus_window_end: data.settings.focus_window_end || ft_focus_window_end,
        spiral_events: data.settings.spiral_events !== undefined 
          ? data.settings.spiral_events 
          : ft_spiral_events,
      };
    }

    // Always include goals, anti_goals, and lifetime stats if they exist in local storage (even if data is provided)
    // This ensures they are synced whenever we save
    if (!data || data.goals === undefined) {
      toSave.goals = ft_user_goals;
    }
    if (!data || data.anti_goals === undefined) {
      toSave.anti_goals = ft_user_anti_goals;
    }
    if (!data || data.channel_lifetime_stats === undefined) {
      toSave.channel_lifetime_stats = ft_channel_lifetime_stats;
    }

    const response = await fetch(`${SERVER_URL}/extension/save-data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: ft_user_email,
        data: toSave,
      }),
    });

    if (!response.ok) {
      console.warn("[FT] Failed to save extension data:", response.status);
      return false;
    }

    const result = await response.json();
    
    if (!result.ok) {
      console.warn("[FT] Extension data save failed:", result.error);
      return false;
    }

    console.log("[FT] Extension data saved to server");
    return true;
  } catch (error) {
    console.warn("[FT] Error saving extension data:", error.message);
    return false;
  }
}

/**
 * Merge timer from server (for cross-device sync)
 * Takes MAX of device timer and server timer to get total across devices
 */
export async function mergeTimerFromServer() {
  try {
    const { ft_user_email, ft_watch_seconds_today: deviceTimer } = await getLocal([
      "ft_user_email",
      "ft_watch_seconds_today"
    ]);
    
    if (!ft_user_email || ft_user_email.trim() === "") {
      return; // Not logged in, skip
    }

    const response = await fetch(
      `${SERVER_URL}/extension/get-timer?email=${encodeURIComponent(ft_user_email)}`
    );

    if (!response.ok) {
      console.warn("[FT] Failed to fetch timer from server:", response.status);
      return;
    }

    const result = await response.json();
    
    if (!result.ok) {
      console.warn("[FT] Invalid timer response:", result);
      return;
    }

    const serverTimer = Number(result.watch_seconds_today || 0);
    const deviceTimerNum = Number(deviceTimer || 0);
    
    // Merge: Take MAX (highest across devices = total)
    const mergedTimer = Math.max(deviceTimerNum, serverTimer);
    
    if (mergedTimer !== deviceTimerNum) {
      // Update device timer with merged total
      await setLocal({ ft_watch_seconds_today: mergedTimer });
      console.log(`[FT] Timer merged: device=${deviceTimerNum}s, server=${serverTimer}s, merged=${mergedTimer}s`);
    }
  } catch (error) {
    console.warn("[FT] Error merging timer from server:", error);
    // Non-critical, don't throw
  }
}

/**
 * Save timer to server (for cross-device sync)
 * Called periodically when logged in
 */
export async function saveTimerToServer() {
  try {
    const { ft_user_email, ft_watch_seconds_today } = await getLocal([
      "ft_user_email",
      "ft_watch_seconds_today"
    ]);
    
    if (!ft_user_email || ft_user_email.trim() === "") {
      return false; // Not logged in, skip
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const watchSeconds = Number(ft_watch_seconds_today || 0);

    const response = await fetch(`${SERVER_URL}/extension/save-timer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: ft_user_email,
        watch_seconds_today: watchSeconds,
        date: today,
      }),
    });

    if (!response.ok) {
      console.warn("[FT] Failed to save timer to server:", response.status);
      return false;
    }

    const result = await response.json();
    if (result.ok) {
      console.log(`[FT] Timer saved to server: ${watchSeconds}s`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn("[FT] Error saving timer to server:", error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// DEBUG SNAPSHOT
// ─────────────────────────────────────────────────────────────
// Returns all stored values so you can check them in the console.
export async function getSnapshot() {
  return chrome.storage.local.get(Object.keys(DEFAULTS));
}