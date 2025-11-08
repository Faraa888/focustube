// lib/extensionStorage.ts
// Utility to store email in chrome.storage.local for extension sync
// Uses postMessage to communicate with extension content script bridge

/**
 * Send message to extension via content script bridge
 */
function sendMessageToExtension(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = `ft_${Date.now()}_${Math.random()}`;
    const timeout = setTimeout(() => {
      reject(new Error('Extension not responding'));
    }, 5000);

    const handler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FT_RESPONSE' && event.data.requestId === requestId) {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve(event.data.response);
      }
    };

    window.addEventListener('message', handler);
    window.postMessage({ ...message, requestId }, window.location.origin);
  });
}

/**
 * Store user email in chrome.storage.local for extension to read
 * This allows the extension to automatically detect logged-in users
 * Uses postMessage to communicate with extension content script
 */
export async function storeEmailForExtension(email: string): Promise<boolean> {
  try {
    try {
      const response = await sendMessageToExtension({
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
      const errorMsg = error.message || String(error);
      if (errorMsg.includes('Extension not responding') || 
          errorMsg.includes('Extension context invalidated')) {
        console.log('ℹ️ Extension not installed or not responding - email will be stored when extension is installed');
        return false;
      }
      console.error('Unexpected error sending message to extension:', error);
      return false;
    }
  } catch (error) {
    console.error('Error storing email in chrome.storage:', error);
    return false;
  }
}

/**
 * Remove email from chrome.storage.local (on logout)
 * Uses postMessage to communicate with extension content script
 */
export async function removeEmailFromExtension(): Promise<boolean> {
  try {
    try {
      const response = await sendMessageToExtension({
        type: "FT_REMOVE_EMAIL_FROM_WEBSITE"
      });
      
      if (response && response.ok) {
        console.log('✅ Email removed from chrome.storage');
        return true;
      }
      return false;
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      if (errorMsg.includes('Extension not responding') || 
          errorMsg.includes('Extension context invalidated')) {
        return false;
      }
      console.error('Unexpected error sending message to extension:', error);
      return false;
    }
  } catch (error) {
    console.error('Error removing email from chrome.storage:', error);
    return false;
  }
}
