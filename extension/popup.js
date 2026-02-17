// popup.js
// Handles extension popup UI and authentication

const SERVER_URL = "https://focustube-backend-4xah.onrender.com";
const FRONTEND_URL = "https://focustube-beta.vercel.app";

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

const TRIAL_TOTAL_DAYS = 30;

function calculateTrialDaysLeft(trialStartedAt) {
  if (!trialStartedAt) return null;
  const startedAt = new Date(trialStartedAt);
  if (Number.isNaN(startedAt.getTime())) return null;

  const now = new Date();
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  return Math.max(0, TRIAL_TOTAL_DAYS - elapsedDays);
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
      "ft_trial_started_at",
      "ft_days_left",
    ]);
    const ownerEmail = result.ft_data_owner_email;
    const plan = result.ft_plan;
    const email = result.ft_user_email || ownerEmail;

    // Popup-open gate: logged-in state requires BOTH owner email and plan.
    if (!ownerEmail || !plan) {
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

      if (bootstrapSession.valid === true && bootstrapSession.data?.trial_started_at) {
        await chrome.storage.local.set({ ft_trial_started_at: bootstrapSession.data.trial_started_at });
        result = {
          ...result,
          ft_trial_started_at: bootstrapSession.data.trial_started_at,
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
          const trialStartedAt = planData.trial_started_at || result.ft_trial_started_at || null;
          const calculatedDaysLeft = calculateTrialDaysLeft(trialStartedAt);
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
          if (planData.trial_started_at) {
            updates.ft_trial_started_at = planData.trial_started_at;
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
              calculateTrialDaysLeft(result.ft_trial_started_at) ??
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
        ft_trial_started_at: planData.trial_started_at || null,
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