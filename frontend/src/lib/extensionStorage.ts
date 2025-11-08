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
    // Check if chrome.runtime is available (extension is installed)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      try {
        // Send message to extension to store email
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
        if (error.message?.includes('Extension context invalidated') || 
            error.message?.includes('Could not establish connection') ||
            error.message?.includes('Receiving end does not exist')) {
          console.log('ℹ️ Extension not installed or not responding - email will be stored when extension is installed');
          return false;
        }
        throw error;
      }
    } else {
      // Extension not installed - that's okay
      console.log('ℹ️ Extension not installed - email will be stored when extension is installed');
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
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
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
        if (error.message?.includes('Extension context invalidated') || 
            error.message?.includes('Could not establish connection') ||
            error.message?.includes('Receiving end does not exist')) {
          console.log('ℹ️ Extension not installed or not responding');
          return false;
        }
        throw error;
      }
    }
    return false;
  } catch (error) {
    console.error('Error removing email from chrome.storage:', error);
    return false;
  }
}

