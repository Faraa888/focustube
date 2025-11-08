// lib/extensionStorage.ts
// Utility to store email in chrome.storage.local for extension sync
// Only works when running in a context where chrome.storage is available

/**
 * Store user email in chrome.storage.local for extension to read
 * This allows the extension to automatically detect logged-in users
 */
export async function storeEmailForExtension(email: string): Promise<boolean> {
  try {
    // Check if chrome.storage is available (only in extension context or when extension is installed)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ ft_user_email: email });
      console.log('Email stored in chrome.storage for extension:', email);
      return true;
    } else {
      // Not in extension context - that's okay, just log
      console.log('chrome.storage not available (not in extension context)');
      return false;
    }
  } catch (error) {
    console.error('Error storing email in chrome.storage:', error);
    return false;
  }
}

/**
 * Remove email from chrome.storage.local (on logout)
 */
export async function removeEmailFromExtension(): Promise<boolean> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(['ft_user_email']);
      console.log('Email removed from chrome.storage');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error removing email from chrome.storage:', error);
    return false;
  }
}

