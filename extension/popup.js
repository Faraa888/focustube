// popup.js
// Handles extension popup UI and authentication

// URLs from environment variables (injected at build time)
// DO NOT HARDCODE - these are replaced during build
// Fallback to localhost for development testing
const SERVER_URL = typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : 'http://localhost:3000';
const FRONTEND_URL = typeof FRONTEND_URL_VAR !== 'undefined' ? FRONTEND_URL_VAR : 'http://localhost:8080';

// DOM elements
const onboarding = document.getElementById("onboarding");
const loginForm = document.getElementById("loginForm");
const statusContainer = document.getElementById("statusContainer");
const headerSubtitle = document.getElementById("headerSubtitle");
const emailInput = document.getElementById("email");
const loginBtn = document.getElementById("loginBtn");
const manageAccountBtn = document.getElementById("manageAccountBtn");
const signupBtn = document.getElementById("signupBtn");
const signinBtn = document.getElementById("signinBtn");
const continueFreeBtn = document.getElementById("continueFreeBtn");
const backToOnboardingBtn = document.getElementById("backToOnboardingBtn");
const messageDiv = document.getElementById("message");
const statusIcon = document.getElementById("statusIcon");
const statusEmail = document.getElementById("statusEmail");
const statusPlan = document.getElementById("statusPlan");
const trialBanner = document.getElementById("trialBanner");
const trialBannerTitle = document.getElementById("trialBannerTitle");
const trialBannerSubtitle = document.getElementById("trialBannerSubtitle");
const trialUpgradeBtn = document.getElementById("trialUpgradeBtn");
const upgradeMessage = document.getElementById("upgradeMessage");
const upgradeBtn = document.getElementById("upgradeBtn");
const refreshPlanBtn = document.getElementById("refreshPlanBtn");

if (trialUpgradeBtn) {
  trialUpgradeBtn.addEventListener("click", () => {
    try {
      window.open(`${FRONTEND_URL}/pricing`, "_blank", "noopener");
    } catch (error) {
      console.warn("⚠️ [POPUP] Failed to open pricing page:", error);
    }
  });
}

if (upgradeBtn) {
  upgradeBtn.addEventListener("click", () => {
    try {
      window.open(`${FRONTEND_URL}/pricing`, "_blank", "noopener");
    } catch (error) {
      console.warn("⚠️ [POPUP] Failed to open pricing page:", error);
    }
  });
}

if (refreshPlanBtn) {
  refreshPlanBtn.addEventListener("click", async () => {
    try {
      refreshPlanBtn.disabled = true;
      refreshPlanBtn.textContent = "Refreshing...";
      // Force sync plan from server
      chrome.runtime.sendMessage({
        type: "FT_SYNC_PLAN",
        force: true,
      }).catch(() => {
        // Background might not be ready, that's okay
      });
      // Reload after a short delay
      setTimeout(() => {
        loadCurrentEmail().catch(console.error);
        refreshPlanBtn.disabled = false;
        refreshPlanBtn.textContent = "Refresh Plan";
      }, 1000);
    } catch (error) {
      console.error("Error refreshing plan:", error);
      refreshPlanBtn.disabled = false;
      refreshPlanBtn.textContent = "Refresh Plan";
    }
  });
}

// Show message
function showMessage(text, type = "info") {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.classList.remove("hidden");
  
  // Auto-hide after 5 seconds for success/info
  if (type === "success" || type === "info") {
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }
}

// Hide message
function hideMessage() {
  messageDiv.classList.add("hidden");
}

// Show onboarding UI
function showOnboarding() {
  onboarding.classList.remove("hidden");
  loginForm.classList.add("hidden");
  statusContainer.classList.add("hidden");
  headerSubtitle.textContent = "Get started";
  renderTrialBanner(null);
}

// Show login form
function showLoginForm() {
  onboarding.classList.add("hidden");
  loginForm.classList.remove("hidden");
  statusContainer.classList.add("hidden");
  headerSubtitle.textContent = "Sign in";
  emailInput.focus();
  renderTrialBanner(null);
}

// Show status (logged in)
function showStatus() {
  onboarding.classList.add("hidden");
  loginForm.classList.add("hidden");
  statusContainer.classList.remove("hidden");
  headerSubtitle.textContent = "Account";
}

function calculateTrialDaysLeft(trialExpiresAt) {
  if (!trialExpiresAt) return 0;
  const expires = new Date(trialExpiresAt);
  if (Number.isNaN(expires.getTime())) return 0;

  const now = new Date();
  const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysLeft);
}

async function verifyBootstrapSession(email) {
  try {
    const response = await fetch(`${SERVER_URL}/extension/bootstrap?email=${encodeURIComponent(email)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      return { valid: false, reason: "unauthorized" };
    }

    if (!response.ok) {
      throw new Error(`Bootstrap check failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data || data.exists === false || data.user === null) {
      return { valid: false, reason: "no_user" };
    }

    return { valid: true, data };
  } catch (error) {
    console.warn("⚠️ [POPUP] Bootstrap session validation failed:", error);
    return { valid: null, reason: "network_error" };
  }
}

function renderTrialBanner(plan, daysLeft) {
  if (!trialBanner) return;

  const normalizedPlan = (plan || "").toLowerCase();
  if (normalizedPlan !== "trial") {
    trialBanner.classList.add("hidden");
    return;
  }

  const numericDays = Number(daysLeft);
  const hasValidDays = Number.isFinite(numericDays) && numericDays >= 0;

  if (trialBannerTitle) {
    trialBannerTitle.textContent = hasValidDays
      ? `Pro trial: ${numericDays} day(s) left`
      : "Pro trial active";
  }

  if (trialBannerSubtitle) {
    trialBannerSubtitle.textContent = "Keep AI filtering, channel blocking and insights by upgrading.";
  }

  trialBanner.classList.remove("hidden");
}

// Load current email from storage
async function loadCurrentEmail() {
  try {
    console.log("🔍 [POPUP] Checking for email in chrome.storage...");
    let result = await chrome.storage.local.get([
      "ft_user_email",
      "ft_plan",
      "ft_data_owner_email",
      "ft_trial_expires_at",
      "ft_days_left",
      "ft_extension_settings"
    ]);
    
    const email = result.ft_user_email;
    const plan = result.ft_plan || "free";
    const daysLeft = result.ft_days_left;
    const trialExpiresAt = result.ft_trial_expires_at;
    const settings = result.ft_extension_settings || {};
    
    console.log("📧 [POPUP] Email found:", email);
    console.log("📋 [POPUP] Plan:", plan);
    console.log("⏰ [POPUP] Days left:", daysLeft);
    console.log("⚙️ [POPUP] Settings:", settings);
    
    // CRITICAL: Verify user session with backend on every popup open
    // This ensures extension and website are always in sync
    if (email) {
      console.log("🔐 [POPUP] Verifying session with backend...");
      const verification = await verifyBootstrapSession(email);
      
      if (!verification.valid) {
        console.warn("⚠️ [POPUP] Session invalid - user signed out on website");
        // Clear local data and show onboarding
        await chrome.storage.local.remove([
          "ft_user_email",
          "ft_plan", 
          "ft_days_left",
          "ft_trial_expires_at",
          "ft_data_owner_email"
        ]);
        showOnboarding();
        return;
      }
      console.log("✅ [POPUP] Session verified");
    }
    
    const ownerEmail = result.ft_data_owner_email;
    // Popup-open gate: owner email controls logged-in state.
    if (!ownerEmail) {
      showOnboarding();
      return null;
    }

    // Validate owner session on popup open when owner email exists.
    if (ownerEmail && ownerEmail.trim() !== "") {
      const bootstrapSession = await verifyBootstrapSession(ownerEmail);
      if (bootstrapSession.valid === false) {
        await chrome.storage.local.remove(["ft_data_owner_email", "ft_plan"]);
        showOnboarding();
        return null;
      }

      if (bootstrapSession.valid === true && bootstrapSession.data?.trial_expires_at) {
        await chrome.storage.local.set({ ft_trial_expires_at: bootstrapSession.data.trial_expires_at });
        result = {
          ...result,
          ft_trial_expires_at: bootstrapSession.data.trial_expires_at,
        };
      }
    }
    
    console.log("🔍 [POPUP] Storage result:", { 
      hasEmail: !!email, 
      email: email ? email.substring(0, 10) + "..." : null,
      plan 
    });
    
    if (email && email.trim() !== "") {
      console.log("✅ [POPUP] Email found in storage, verifying with backend...");
      // Email exists - verify with backend to get latest plan
      try {
        const planData = await verifyEmail(email);
        
        console.log("🔍 [POPUP] Backend verification result:", { 
          exists: planData?.exists, 
          plan: planData?.plan 
        });
        
        if (planData && planData.exists !== false) {
          // User exists in database - show logged-in status
          console.log("✅ [POPUP] User verified, showing status screen");
          const currentPlan = planData.plan || plan;
          const trialExpiresAt = planData.trial_expires_at || result.ft_trial_expires_at || null;
          const calculatedDaysLeft = calculateTrialDaysLeft(trialExpiresAt);
          const daysLeft = currentPlan.toLowerCase() === "trial"
            ? (
                calculatedDaysLeft ??
                (typeof planData.days_left === "number"
                  ? planData.days_left
                  : (result.ft_days_left ?? null))
              )
            : null;
          const canRecord = planData.can_record !== undefined ? planData.can_record : true;
          
          statusEmail.textContent = email;
          statusPlan.textContent = `Plan: ${currentPlan.toUpperCase()}`;
          statusIcon.className = "status-icon connected";
          statusIcon.textContent = "✓";
          showStatus();
          renderTrialBanner(currentPlan, daysLeft);
          
          // Show upgrade message if user can't record (free or expired trial)
          if (upgradeMessage) {
            if (!canRecord) {
              upgradeMessage.classList.remove("hidden");
            } else {
              upgradeMessage.classList.add("hidden");
            }
          }
          
          // Update stored days left and can_record if backend returned values
          const updates = {};
          if (typeof planData.days_left === "number") {
            updates.ft_days_left = planData.days_left;
          } else if (typeof daysLeft === "number") {
            updates.ft_days_left = daysLeft;
          }
          if (planData.can_record !== undefined) {
            updates.ft_can_record = planData.can_record;
          }
          if (planData.trial_expires_at) {
            updates.ft_trial_expires_at = planData.trial_expires_at;
          }
          if (Object.keys(updates).length > 0) {
            await chrome.storage.local.set(updates);
          }
          
          // Update plan in storage if it changed
          if (planData.plan && planData.plan !== plan) {
            await chrome.storage.local.set({ ft_plan: planData.plan.toLowerCase() });
          }
          
          return email;
        } else {
          // Email in storage but not in database - clear and show onboarding
          console.warn("⚠️ [POPUP] Email in storage but not in database, clearing...");
          await chrome.storage.local.remove(["ft_user_email", "ft_plan"]);
          showOnboarding();
          return null;
        }
      } catch (error) {
        // Network error - show cached status
        console.warn("⚠️ [POPUP] Failed to verify email, showing cached status:", error);
        statusEmail.textContent = email;
        statusPlan.textContent = `Plan: ${plan.toUpperCase()}`;
        statusIcon.className = "status-icon connected";
        statusIcon.textContent = "✓";
        showStatus();
        const fallbackDaysLeft = plan.toLowerCase() === "trial"
          ? (
              calculateTrialDaysLeft(result.ft_trial_expires_at) ??
              (result.ft_days_left ?? null)
            )
          : null;
        renderTrialBanner(plan, fallbackDaysLeft);
        return email;
      }
    }
    
    // User not logged in - show onboarding
    console.log("ℹ️ [POPUP] No email in storage, showing onboarding");
    showOnboarding();
    return null;
  } catch (error) {
    console.error("🔴 [POPUP] Error loading email:", error);
    showOnboarding();
    return null;
  }
}

// Verify email with backend
async function verifyEmail(email) {
  try {
    const response = await fetch(`${SERVER_URL}/license/verify?email=${encodeURIComponent(email)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    // Backend now returns { exists: true/false, plan, ... }
    return data;
  } catch (error) {
    console.error("Error verifying email:", error);
    throw error;
  }
}

// Save email and sync plan
async function saveEmailAndSync(email) {
  try {
    // Save email
    await chrome.storage.local.set({ ft_user_email: email.trim() });
    
    // Sync plan from server
    const planData = await verifyEmail(email);
    
    if (planData && planData.exists !== false && planData.plan) {
      // Save plan
      await chrome.storage.local.set({ 
        ft_data_owner_email: email.trim(),
        ft_plan: planData.plan.toLowerCase(),
        ft_days_left: planData.days_left || null,
        ft_trial_expires_at: planData.trial_expires_at || null,
      });
      
      // Trigger background sync
      chrome.runtime.sendMessage({
        type: "FT_SYNC_PLAN",
        email: email.trim(),
      }).catch(() => {
        // Background might not be ready, that's okay
      });
      
      return planData;
    }
    
    return null;
  } catch (error) {
    console.error("Error saving email:", error);
    throw error;
  }
}

// Handle login
async function handleLogin() {
  const email = emailInput.value.trim();
  
  if (!email) {
    showMessage("Please enter your email address", "error");
    return;
  }

  // Basic email validation
  if (!email.includes("@") || !email.includes(".")) {
    showMessage("Please enter a valid email address", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Connecting...";
  hideMessage();

  try {
    // Verify email exists in backend
    const planData = await verifyEmail(email);
    
    if (!planData || planData.exists === false) {
      throw new Error("Email not found in database. Please sign up first.");
    }
    
    // Save email and sync plan
    await saveEmailAndSync(email);
    
    // Show success
    showMessage(`Connected! Welcome, ${email}`, "success");
    
    // Update UI
    await loadCurrentEmail();
    
  } catch (error) {
    console.error("Login error:", error);
    
    // Check if it's a network error
    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      showMessage("Cannot connect to server. Please check your internet connection.", "error");
    } else {
      showMessage(error.message || "Email not found. Please sign up first.", "error");
    }
    
    loginBtn.disabled = false;
    loginBtn.textContent = "Connect Account";
  }
}

// Handle manage account - opens website settings
function handleManageAccount() {
  try {
    console.log("🔗 [POPUP] Opening settings page...");
    chrome.tabs.create({ url: `${FRONTEND_URL}/app/settings` });
    window.close();
  } catch (error) {
    console.error("Error opening settings:", error);
    showMessage("Error opening website. Please visit the website to manage your account.", "error");
  }
}

// Handle sign up button
function handleSignup() {
  chrome.tabs.create({ url: `${FRONTEND_URL}/signup` });
  window.close();
}

// Handle sign in button
function handleSignIn() {
  chrome.tabs.create({ url: `${FRONTEND_URL}/login?return=extension` });
  window.close();
}

// Handle continue with free
function handleContinueFree() {
  // Extension already defaults to free plan, just close popup
  window.close();
}

// Set signup link href dynamically
const signupLink = document.getElementById("signupLink");
if (signupLink) {
  signupLink.href = `${FRONTEND_URL}/signup`;
}

// Event listeners (with null checks for safety)
if (loginBtn) loginBtn.addEventListener("click", handleLogin);
if (signupBtn) signupBtn.addEventListener("click", handleSignup);
if (signinBtn) signinBtn.addEventListener("click", handleSignIn);
if (continueFreeBtn) continueFreeBtn.addEventListener("click", handleContinueFree);
if (backToOnboardingBtn) {
  backToOnboardingBtn.addEventListener("click", () => {
    if (emailInput) emailInput.value = "";
    hideMessage();
    showOnboarding();
  });
}
if (emailInput) {
  emailInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  });
}
if (manageAccountBtn) manageAccountBtn.addEventListener("click", handleManageAccount);

// Load current state on popup open
loadCurrentEmail().catch(console.error);

// Listen for user state changes from background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "FT_USER_STATE_CHANGED") {
    console.log("🔄 [POPUP] User state changed - auto-refreshing popup");
    // Reload popup state to show new user/plan
    loadCurrentEmail().catch(console.error);
  }
});

// Sync plan from server on popup open (quick check)
chrome.runtime.sendMessage({ type: "FT_SYNC_PLAN" }).catch((err) => {
  console.warn("⚠️ [POPUP] Failed to trigger plan sync:", err);
});

// Listen for storage changes (when frontend stores email)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Email was added/changed - reload to show logged-in status
    if (changes.ft_user_email) {
      console.log("🔄 [POPUP] Email changed, reloading...");
      loadCurrentEmail().catch(console.error);
    }
    
    // Plan or days_left changed - update banner and status
    if (changes.ft_plan || changes.ft_days_left) {
      console.log("🔄 [POPUP] Plan changed, reloading...");
      loadCurrentEmail().catch(console.error);
    }
    
    // Extension settings changed - reload to show updated status
    if (changes.ft_extension_settings) {
      console.log("🔄 [POPUP] Settings changed, reloading...");
      loadCurrentEmail().catch(console.error);
    }
  }
});