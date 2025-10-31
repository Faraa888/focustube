// lib/state.js
// Storage + rotation + counters + unlock helpers used by background.js

import { PERIOD_DAILY, PERIOD_WEEKLY, PLAN_FREE, PLAN_PRO } from "./constants.js";
import { CONFIG_BY_PLAN } from "./rules.js";

// ---------- Defaults ----------
const DEFAULTS = {
  // plan + rotation
  ft_plan: "free",                 // "free" | "pro"
  ft_reset_period: "daily",        // "daily" | "weekly"
  ft_last_reset_key: "",

  // daily/weekly counters
  ft_blocked_today: false,
  ft_searches_today: 0,
  ft_short_visits_today: 0,
  ft_watch_visits_today: 0,
  ft_watch_seconds_today: 0,

  // temporary unlock
  ft_unlock_until_epoch: 0
};

// ---------- chrome.storage helpers ----------
export async function getLocal(keys) {
  return chrome.storage.local.get(keys);
}
export async function setLocal(obj) {
  return chrome.storage.local.set(obj);
}

// Initialize any missing keys once (idempotent)
export async function ensureDefaults() {
  const current = await getLocal(Object.keys(DEFAULTS));
  const toSet = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (current[k] === undefined) toSet[k] = v;
  }
  if (Object.keys(toSet).length) await setLocal(toSet);
}

// ---------- period rotation (daily/weekly) ----------
function buildDailyKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`; // e.g. 2025-10-30
}

function buildWeeklyKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;       // 1..7 (Mon..Sun)
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // move to Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const w = String(weekNo).padStart(2, "0");
  return `${d.getUTCFullYear()}-W${w}`;   // e.g. 2025-W44
}

function resetShape() {
  return {
    ft_searches_today: 0,
    ft_short_visits_today: 0,
    ft_watch_visits_today: 0,
    ft_watch_seconds_today: 0,
    ft_blocked_today: false,
    ft_unlock_until_epoch: 0
  };
}

// Called frequently; no-op if not crossing boundary
export async function maybeRotateCounters(now = new Date()) {
  const { ft_reset_period, ft_last_reset_key } = await getLocal([
    "ft_reset_period",
    "ft_last_reset_key"
  ]);

  const period = (ft_reset_period === "weekly") ? "weekly" : "daily";
  const currentKey = period === "weekly" ? buildWeeklyKey(now) : buildDailyKey(now);

  if (!ft_last_reset_key || ft_last_reset_key !== currentKey) {
    await setLocal({
      ...resetShape(),
      ft_last_reset_key: currentKey
    });
  }
}

// ---------- counters ----------
export async function increment(key) {
  const cur = await getLocal([key]);
  const next = (cur[key] || 0) + 1;
  await setLocal({ [key]: next });
  return next;
}

// Alias: bump is same as increment
export async function bump(key) {
  return increment(key);
}

// Get reset period
export async function getResetPeriod() {
  const { ft_reset_period } = await getLocal(["ft_reset_period"]);
  return ft_reset_period === PERIOD_WEEKLY ? PERIOD_WEEKLY : PERIOD_DAILY;
}

// Reset counters manually (for testing or manual reset)
export async function resetCounters() {
  await setLocal(resetShape());
}

// ---------- plan config ----------
export { CONFIG_BY_PLAN };

export async function getPlanConfig() {
  const { ft_plan } = await getLocal(["ft_plan"]);
  const plan = (ft_plan === PLAN_PRO) ? PLAN_PRO : PLAN_FREE;
  return { plan, config: CONFIG_BY_PLAN[plan] };
}

export async function setPlan(plan) {
  const validPlan = (plan === PLAN_PRO) ? PLAN_PRO : PLAN_FREE;
  await setLocal({ ft_plan: validPlan });
  return validPlan;
}

// ---------- temporary unlock ----------
export async function isTemporarilyUnlocked(now = Date.now()) {
  const { ft_unlock_until_epoch } = await getLocal(["ft_unlock_until_epoch"]);
  return typeof ft_unlock_until_epoch === "number" && now < ft_unlock_until_epoch;
}
export async function setTemporaryUnlock(minutes = 10) {
  const until = Date.now() + minutes * 60 * 1000;
  await setLocal({ ft_unlock_until_epoch: until });
}

// ---------- debug snapshot ----------
export async function getSnapshot() {
  return chrome.storage.local.get(Object.keys(DEFAULTS));
}