// lib/config.js
// Configuration for FocusTube extension
// Handles server URL detection and other configurable settings

/**
 * Get server URL based on environment
 * Auto-detects development vs production
 * @returns {string} Server URL
 */
export function getServerUrl() {
  // Backend URL from environment variable (injected at build time)
  // DO NOT HARDCODE - use BACKEND_URL env var
  // Fallback to localhost for development testing
  return typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : 'http://localhost:3000';
}

/**
 * Get server URL for background script context
 * Background scripts don't have window.location, so we use a different approach
 * @returns {string} Server URL
 */
export function getServerUrlForBackground() {
  // Backend URL from environment variable (injected at build time)
  // DO NOT HARDCODE - use BACKEND_URL env var
  // Fallback to localhost for development testing
  return typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : 'http://localhost:3000';
}

