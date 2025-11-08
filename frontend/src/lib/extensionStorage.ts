// lib/extensionStorage.ts
// Utility to store email in chrome.storage.local for extension sync
// Uses extension messaging API to communicate with extension

/**
 * Store user email in chrome.storage.local for extension to read
 * This allows the extension to automatically detect logged-in users
 * Uses chrome.runtime.sendMessage to communicate with extension
 */
export async function storeEmailForExtension(email: string): Promise<boolean> {
  try {
    // Check if chrome.runtime exists (Chrome browser)
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        // Send message to extension to store email
        // Don't check chrome.runtime.id - just try sending the message
        const response = await chrome.runtime.sendMessage({
          type: "FT_STORE_EMAIL_FROM_WEBSITE",
          email: email.trim()
        });
        
        if (response && response.ok) {
          console.log('✅ Email stored in chrome.storage for extension:', email);
          return true;
        } else {
          console.warn('⚠️ Extension returned error:', response?.error);
          return false;
        }
      } catch (error: any) {
        // Extension might not be installed or not responding
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('Extension context invalidated') || 
            errorMsg.includes('Could not establish connection') ||
            errorMsg.includes('Receiving end does not exist') ||
            errorMsg.includes('message port closed')) {
          console.log('ℹ️ Extension not installed or not responding - email will be stored when extension is installed');
          return false;
        }
        // Log unexpected errors
        console.error('Unexpected error sending message to extension:', error);
        return false;
      }
    } else {
      // Not in Chrome browser
      console.log('ℹ️ Not in Chrome browser - email will be stored when extension is installed');
      return false;
    }
  } catch (error) {
    console.error('Error storing email in chrome.storage:', error);
    return false;
  }
}

/**
 * Remove email from chrome.storage.local (on logout)
 * Uses chrome.runtime.sendMessage to communicate with extension
 */
export async function removeEmailFromExtension(): Promise<boolean> {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "FT_REMOVE_EMAIL_FROM_WEBSITE"
        });
        
        if (response && response.ok) {
          console.log('✅ Email removed from chrome.storage');
          return true;
        }
        return false;
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('Extension context invalidated') || 
            errorMsg.includes('Could not establish connection') ||
            errorMsg.includes('Receiving end does not exist') ||
            errorMsg.includes('message port closed')) {
          console.log('ℹ️ Extension not installed or not responding');
          return false;
        }
        console.error('Unexpected error sending message to extension:', error);
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error('Error removing email from chrome.storage:', error);
    return false;
  }
}

