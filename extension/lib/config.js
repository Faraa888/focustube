// lib/config.js
// Configuration for FocusTube extension
// Handles server URL detection and other configurable settings

/**
 * Get server URL based on environment
 * Auto-detects development vs production
 * @returns {string} Server URL
 */
export function getServerUrl() {
  // Check if we're in a browser context (extension)
  if (typeof window !== 'undefined' && window.location) {
    // Check if running on localhost (development)
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
      return 'http://localhost:3000';
    }
    
    // Production: Check for Lovable Cloud or other production domains
    // You can add your production URL here or use environment detection
    // For now, default to localhost if not on YouTube (content script)
    // This will be updated when deployed to Lovable Cloud
    if (hostname.includes('youtube.com')) {
      // On YouTube - check if we have a stored production URL
      // For now, default to localhost (will be updated via manifest or env)
      return 'http://localhost:3000';
    }
  }
  
  // Default fallback: development server
  return 'http://localhost:3000';
}

/**
 * Get server URL for background script context
 * Background scripts don't have window.location, so we use a different approach
 * @returns {string} Server URL
 */
export function getServerUrlForBackground() {
  // Background scripts can check chrome.storage for a configured URL
  // For now, default to localhost
  // TODO: Add ability to configure via extension options or manifest
  return 'http://localhost:3000';
}

