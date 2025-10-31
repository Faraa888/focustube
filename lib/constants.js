// lib/constants.js
// Fixed labels (enums). No Chrome APIs. Safe to import anywhere.

// Plans
export const PLAN_FREE  = "free";
export const PLAN_PRO   = "pro";
export const PLAN_TEST  = "test";   // optional for dev

export const ALL_PLANS = [PLAN_FREE, PLAN_PRO, PLAN_TEST];

// Reset periods
export const PERIOD_DAILY   = "daily";
export const PERIOD_WEEKLY  = "weekly";
export const PERIOD_MONTHLY = "monthly";

export const ALL_PERIODS = [PERIOD_DAILY, PERIOD_WEEKLY, PERIOD_MONTHLY];