// lib/config.js
// Configuration for FocusTube extension
// Handles server URL detection and other configurable settings

/**
 * Get server URL based on environment
 * Auto-detects development vs production
 * @returns {string} Server URL
 */
export function getServerUrl() {
  // Production backend URL
  return 'https://focustube-backend-4xah.onrender.com';
}

/**
 * Get server URL for background script context
 * Background scripts don't have window.location, so we use a different approach
 * @returns {string} Server URL
 */
export function getServerUrlForBackground() {
  // Production backend URL
  return 'https://focustube-backend-4xah.onrender.com';
}

