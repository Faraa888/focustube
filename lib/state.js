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
  ft_plan: "free",                // free | pro | test
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
  
  // Milestone tracking
  ft_last_shorts_milestone: 0,     // last milestone shown (10, 20, 30, etc.) - deprecated, kept for compatibility
  ft_last_time_milestone: 0        // last time-based milestone threshold shown (120, 300, 600, 900, 1200 seconds)
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
    ft_watch_visits_today: 0,
    ft_watch_seconds_today: 0,
    ft_shorts_seconds_today: 0,
    ft_blocked_today: false,
    ft_block_shorts_today: false,
    ft_pro_manual_block_shorts: false,
    ft_unlock_until_epoch: 0,
    ft_last_shorts_milestone: 0,
    ft_last_time_milestone: 0
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
    await setLocal({
      ...resetShape(),
      ft_last_reset_key: currentKey
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
export const bumpShorts  = () => bump("ft_short_visits_today"); // Total scrolled
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

export async function getPlanConfig() {
  const { ft_plan } = await getLocal(["ft_plan"]);
  const plan =
    ft_plan === PLAN_PRO  ? PLAN_PRO  :
    ft_plan === PLAN_TEST ? PLAN_TEST :
    PLAN_FREE;
  return { plan, config: CONFIG_BY_PLAN[plan] };
}

export async function setPlan(plan) {
  const valid =
    plan === PLAN_PRO  ? PLAN_PRO  :
    plan === PLAN_TEST ? PLAN_TEST :
    PLAN_FREE;
  await setLocal({ ft_plan: valid });
  return valid;
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
// DEBUG SNAPSHOT
// ─────────────────────────────────────────────────────────────
// Returns all stored values so you can check them in the console.
export async function getSnapshot() {
  return chrome.storage.local.get(Object.keys(DEFAULTS));
}