/**
 * Shared API access layer for frontend hooks and components.
 * 
 * Injects authenticated Supabase Bearer JWT tokens into HTTP headers,
 * provides tokenized URL builders for browser downloads/previews,
 * and standardizes error handling with user-friendly Hebrew error messages.
 */
import { supabase } from './supabase';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Optional legacy Backoffice key (supported for backward-compatibility with automated scripts).
 */
const API_KEY = import.meta.env.VITE_API_KEY || '';

/** In-memory cache of current access token for synchronous header assembly */
let _cachedToken = null;

/**
 * Sets the active JWT token in memory for outgoing API requests.
 * @param {string|null} token
 */
export function setAuthToken(token) {
  _cachedToken = token;
}

/**
 * Retrieves the currently active JWT token.
 * Falls back to extracting from the Supabase session in localStorage if memory cache is unset.
 * @returns {string|null}
 */
export function getAuthToken() {
  if (_cachedToken) return _cachedToken;
  try {
    // Read Supabase auth session from localStorage if available
    const keys = Object.keys(localStorage);
    const sbKey = keys.find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (sbKey) {
      const data = JSON.parse(localStorage.getItem(sbKey) || '{}');
      if (data?.access_token) {
        _cachedToken = data.access_token;
        return _cachedToken;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

/**
 * Headers every API call should carry (Bearer JWT + optional legacy API key).
 * @param {HeadersInit} [headers]
 * @returns {Record<string, string>}
 */
export function authHeaders(headers = {}) {
  const merged = { ...(headers || {}) };
  const token = getAuthToken();

  if (token) {
    merged['Authorization'] = `Bearer ${token}`;
  }
  if (API_KEY) {
    merged['X-API-Key'] = API_KEY;
  }
  return merged;
}

/**
 * Absolute URL for links that cannot send headers (downloads, <iframe>/<img> previews).
 * Appends the token as a query parameter (?token=...) to authenticate the request.
 * @param {string} path - API path, e.g. "/api/excel/download".
 * @returns {string}
 */
export function apiUrl(path) {
  const url = `${API_URL}${path}`;
  const token = getAuthToken();
  const params = [];

  if (token) params.push(`token=${encodeURIComponent(token)}`);
  if (API_KEY) params.push(`api_key=${encodeURIComponent(API_KEY)}`);

  if (!params.length) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${params.join('&')}`;
}

/**
 * Performs an API request and returns parsed JSON.
 * Throws a descriptive Hebrew Error carrying the server's `detail` message upon failure.
 * @param {string} path - API path, e.g. "/api/excel/preview".
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: authHeaders(options.headers),
    });
  } catch {
    throw new Error('אין תקשורת עם השרת. ודא שה-Backend פועל.');
  }

  // Global handler for token expiration on protected business endpoints
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new CustomEvent('billingstream:auth_expired'));
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body.detail === 'string' ? body.detail : 'הבקשה נכשלה';
    throw new Error(detail);
  }
  return body;
}
