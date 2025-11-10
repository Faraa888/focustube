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
const logoutBtn = document.getElementById("logoutBtn");
const signupBtn = document.getElementById("signupBtn");
const signinBtn = document.getElementById("signinBtn");
const continueFreeBtn = document.getElementById("continueFreeBtn");
const backToOnboardingBtn = document.getElementById("backToOnboardingBtn");
const messageDiv = document.getElementById("message");
const statusIcon = document.getElementById("statusIcon");
const statusEmail = document.getElementById("statusEmail");
const statusPlan = document.getElementById("statusPlan");

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
}

// Show login form
function showLoginForm() {
  onboarding.classList.add("hidden");
  loginForm.classList.remove("hidden");
  statusContainer.classList.add("hidden");
  headerSubtitle.textContent = "Sign in";
  emailInput.focus();
}

// Show status (logged in)
function showStatus() {
  onboarding.classList.add("hidden");
  loginForm.classList.add("hidden");
  statusContainer.classList.remove("hidden");
  headerSubtitle.textContent = "Account";
}

// Load current email from storage
async function loadCurrentEmail() {
  try {
    console.log("🔍 [POPUP] Checking for email in chrome.storage...");
    const result = await chrome.storage.local.get(["ft_user_email", "ft_plan"]);
    const email = result.ft_user_email;
    const plan = result.ft_plan || "free";
    
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
          statusEmail.textContent = email;
          statusPlan.textContent = `Plan: ${currentPlan.toUpperCase()}`;
          statusIcon.className = "status-icon connected";
          statusIcon.textContent = "✓";
          showStatus();
          
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

// Handle logout
async function handleLogout() {
  try {
    console.log("🔓 [POPUP] Logging out...");
    
    // Clear all extension storage (including blocked channels and other user data)
    await chrome.storage.local.remove([
      "ft_user_email", 
      "ft_plan", 
      "ft_days_left", 
      "ft_trial_expires_at",
      "ft_blocked_channels",
      "ft_watch_history",
      "ft_channel_spiral_count",
      "ft_extension_settings",
      "ft_user_goals",
      "ft_user_anti_goals"
    ]);
    
    console.log("✅ [POPUP] Extension storage cleared");
    
    // Notify all FocusTube website tabs to sign out
    try {
      const tabs = await chrome.tabs.query({});
      const frontendUrl = FRONTEND_URL || 'https://focustube-beta.vercel.app';
      
      for (const tab of tabs) {
        if (tab.url && (tab.url.startsWith(frontendUrl) || tab.url.startsWith('http://localhost:808'))) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'FT_LOGOUT_FROM_EXTENSION'
            });
            console.log(`✅ [POPUP] Sent logout message to tab: ${tab.url}`);
          } catch (e) {
            // Tab might not have content script, ignore silently
            console.log(`ℹ️ [POPUP] Could not send message to tab ${tab.id}: ${e.message}`);
          }
        }
      }
    } catch (error) {
      // If we can't query tabs or send messages, continue anyway
      console.warn("⚠️ [POPUP] Could not notify website tabs:", error);
    }
    
    showMessage("Disconnected successfully", "info");
    
    // Clear email input
    if (emailInput) emailInput.value = "";
    
    // Reload to show onboarding screen
    await loadCurrentEmail();
  } catch (error) {
    console.error("🔴 [POPUP] Logout error:", error);
    showMessage("Error disconnecting. Please try again.", "error");
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
if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

// Load current state on popup open
loadCurrentEmail().catch(console.error);

// Listen for storage changes (when frontend stores email)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.ft_user_email) {
    // Email was added/changed - reload to show logged-in status
    loadCurrentEmail().catch(console.error);
  }
});
