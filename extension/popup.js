// popup.js
// Extension popup — 4 states: logged-out, trial, pro, expired

const SERVER_URL = typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : 'http://localhost:3000';
const FRONTEND_URL_VAL = typeof FRONTEND_URL_VAR !== 'undefined' ? FRONTEND_URL_VAR : 'http://localhost:8080';

// Days of trial remaining on which the upgrade nudge is shown
const NUDGE_DAYS = [1, 2, 3, 4, 7];

// ─── State panels ────────────────────────────────────────────────────────────

const panels = {
  loading:   document.getElementById('state-loading'),
  loggedout: document.getElementById('state-loggedout'),
  trial:     document.getElementById('state-trial'),
  pro:       document.getElementById('state-pro'),
  expired:   document.getElementById('state-expired'),
};

function showPanel(name) {
  Object.values(panels).forEach(el => el.classList.add('hidden'));
  panels[name].classList.remove('hidden');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateTrialDaysLeft(trialExpiresAt) {
  if (!trialExpiresAt) return 0;
  const expires = new Date(trialExpiresAt);
  if (Number.isNaN(expires.getTime())) return 0;
  const now = new Date();
  const ms = expires - now;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// ─── Backend calls ────────────────────────────────────────────────────────────

async function verifyEmail(email) {
  const resp = await fetch(
    `${SERVER_URL}/license/verify?email=${encodeURIComponent(email)}`
  );
  if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
  return resp.json();
}

async function fetchStats(email) {
  try {
    const resp = await fetch(
      `${SERVER_URL}/dashboard/stats?email=${encodeURIComponent(email)}`
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

// ─── State renderers ──────────────────────────────────────────────────────────

function renderLoggedOut() {
  showPanel('loggedout');
}

function renderTrial(email, daysLeft) {
  document.getElementById('trial-email').textContent = email;
  document.getElementById('trial-days').textContent =
    `Pro trial: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;

  // Upgrade nudge on specific days, dismissed once per calendar day
  const nudgeBanner = document.getElementById('upgrade-nudge');
  if (NUDGE_DAYS.includes(daysLeft)) {
    chrome.storage.local.get(['ft_trial_nudge_dismissed_date'], (result) => {
      const today = new Date().toDateString();
      if (result.ft_trial_nudge_dismissed_date !== today) {
        document.getElementById('nudge-copy').textContent =
          `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upgrade to keep your focus.`;
        nudgeBanner.classList.remove('hidden');
      }
    });
  } else {
    nudgeBanner.classList.add('hidden');
  }

  showPanel('trial');
}

function renderPro(email) {
  document.getElementById('pro-email').textContent = email;
  showPanel('pro');
}

async function renderExpired(email) {
  const stats = await fetchStats(email);
  const statsEl = document.getElementById('expired-stats');

  if (stats && stats.watchTime) {
    const minutes = stats.watchTime.thisWeekMinutes || 0;
    const hours = Math.round((minutes / 60) * 10) / 10;
    const focusPct = stats.focusScore7Day != null ? stats.focusScore7Day : null;

    if (focusPct != null) {
      statsEl.textContent =
        `You watched ${hours}h this week. FocusTube helped you stay focused for ${focusPct}% of that time.`;
    } else {
      statsEl.textContent = `You watched ${hours}h this week.`;
    }
  } else {
    statsEl.textContent = 'Upgrade to continue tracking your focus habits.';
  }

  showPanel('expired');
}

// ─── Main init ────────────────────────────────────────────────────────────────

async function init() {
  showPanel('loading');

  try {
    const result = await chrome.storage.local.get([
      'ft_user_email',
      'ft_data_owner_email',
      'ft_plan',
      'ft_trial_expires_at',
    ]);

    const email = result.ft_user_email || result.ft_data_owner_email;

    if (!email) {
      renderLoggedOut();
      return;
    }

    // Attempt backend verification
    let planData;
    try {
      planData = await verifyEmail(email);
    } catch {
      // Network unavailable — fall back to cached plan
      const cachedPlan = (result.ft_plan || 'free').toLowerCase();
      const cachedDaysLeft = calculateTrialDaysLeft(result.ft_trial_expires_at);
      if (cachedPlan === 'pro') {
        renderPro(email);
      } else if (cachedPlan === 'trial' && cachedDaysLeft > 0) {
        renderTrial(email, cachedDaysLeft);
      } else {
        await renderExpired(email);
      }
      return;
    }

    // Backend says user doesn't exist — clear stale storage
    if (!planData || planData.exists === false) {
      await chrome.storage.local.remove([
        'ft_user_email', 'ft_data_owner_email', 'ft_plan', 'ft_trial_expires_at',
      ]);
      renderLoggedOut();
      return;
    }

    // Persist fresh plan data
    const plan = (planData.plan || 'free').toLowerCase();
    const expiresAt = planData.trial_expires_at || result.ft_trial_expires_at || null;
    const daysLeft = calculateTrialDaysLeft(expiresAt);
    const canRecord = planData.can_record !== false;

    await chrome.storage.local.set({
      ft_plan: plan,
      ft_trial_expires_at: expiresAt,
    });

    // Route to correct state
    if (plan === 'pro') {
      renderPro(email);
    } else if (plan === 'trial' && canRecord && daysLeft > 0) {
      renderTrial(email, daysLeft);
    } else {
      await renderExpired(email);
    }

  } catch (err) {
    console.error('[POPUP] Init error:', err);
    renderLoggedOut();
  }
}

// ─── Button listeners ─────────────────────────────────────────────────────────

// Logged-out
document.getElementById('btn-signup').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL_VAL}/signup` });
  window.close();
});

document.getElementById('btn-signin').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL_VAL}/login?return=extension` });
  window.close();
});

// Trial
document.getElementById('btn-trial-upgrade').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL_VAL}/pricing` });
  window.close();
});

document.getElementById('btn-trial-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL_VAL}/app/dashboard` });
  window.close();
});

document.getElementById('btn-trial-settings').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL_VAL}/app/settings` });
  window.close();
});

// Nudge
document.getElementById('btn-nudge-upgrade').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL_VAL}/pricing` });
  window.close();
});

document.getElementById('btn-nudge-dismiss').addEventListener('click', () => {
  chrome.storage.local.set({ ft_trial_nudge_dismissed_date: new Date().toDateString() });
  document.getElementById('upgrade-nudge').classList.add('hidden');
});

// Pro
document.getElementById('btn-pro-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL_VAL}/app/dashboard` });
  window.close();
});

document.getElementById('btn-pro-settings').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL_VAL}/app/settings` });
  window.close();
});

// Expired
document.getElementById('btn-expired-upgrade').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL_VAL}/pricing` });
  window.close();
});

document.getElementById('btn-expired-uninstall').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions' });
  window.close();
});

// ─── Storage listener ─────────────────────────────────────────────────────────
// Re-init if email or plan changes (e.g. user logs in from website tab)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.ft_user_email || changes.ft_plan || changes.ft_data_owner_email)) {
    init().catch(console.error);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
init().catch(console.error);
