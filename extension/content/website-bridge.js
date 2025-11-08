// content/website-bridge.js
// Bridge between website and extension for messaging
// This content script runs on the FocusTube website and allows the page to communicate with the extension

// Listen for messages from the webpage
window.addEventListener('message', async (event) => {
  // Only accept messages from same origin (security)
  if (event.origin !== window.location.origin) {
    return;
  }

  // Only handle FocusTube messages
  if (event.data && event.data.type && event.data.type.startsWith('FT_')) {
    try {
      // Forward message to background script
      const response = await chrome.runtime.sendMessage(event.data);
      
      // Send response back to webpage
      window.postMessage({
        type: 'FT_RESPONSE',
        requestId: event.data.requestId,
        response: response
      }, window.location.origin);
    } catch (error) {
      // Send error back to webpage
      window.postMessage({
        type: 'FT_RESPONSE',
        requestId: event.data.requestId,
        response: { 
          ok: false, 
          error: error.message || String(error) 
        }
      }, window.location.origin);
    }
  }
});

// Log that bridge is ready (for debugging)
console.log('[FocusTube Bridge] Content script loaded and ready');

