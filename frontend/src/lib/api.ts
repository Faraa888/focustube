// lib/api.ts
// Centralized API configuration - all backend URLs use environment variables

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_URL) {
  console.error('VITE_BACKEND_URL is not defined in environment variables');
}

/**
 * Get the backend API base URL from environment variables
 * Never hardcode URLs - always use this function
 */
export function getBackendUrl(): string {
  return BACKEND_URL || '';
}

/**
 * Helper to construct full API endpoint URLs
 */
export function getApiUrl(endpoint: string): string {
  const base = getBackendUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}
