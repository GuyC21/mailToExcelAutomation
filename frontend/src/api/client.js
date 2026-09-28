/**
 * Shared API access for hooks. Components never call fetch directly.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Optional Backoffice key (must match the backend's BACKOFFICE_API_KEY).
 * Empty in the default local setup, in which case nothing is sent.
 * Note: a key baked into a browser bundle is visible to anyone who can load
 * the UI - it keeps strangers on the network out, it is not per-user auth.
 */
const API_KEY = import.meta.env.VITE_API_KEY || '';

/**
 * Headers every API call should carry (merged over any caller headers).
 * @param {HeadersInit} [headers]
 * @returns {Record<string, string>}
 */
export function authHeaders(headers = {}) {
  const merged = { ...(headers || {}) };
  if (API_KEY) merged['X-API-Key'] = API_KEY;
  return merged;
}

/**
 * Absolute URL for links that cannot send headers (downloads, <iframe>/<img>
 * previews). Appends the key as `api_key` when one is configured.
 * @param {string} path - API path, e.g. "/api/excel/download".
 * @returns {string}
 */
export function apiUrl(path) {
  const url = `${API_URL}${path}`;
  if (!API_KEY) return url;
  return `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(API_KEY)}`;
}

/**
 * Performs a request and returns parsed JSON, throwing a Hebrew-friendly Error
 * that carries the server's `detail` message when the call fails.
 * @param {string} path - API path, e.g. "/api/excel/preview".
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers: authHeaders(options.headers) });
  } catch {
    throw new Error('אין תקשורת עם השרת. ודא שה-Backend פועל.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body.detail === 'string' ? body.detail : 'הבקשה נכשלה';
    throw new Error(detail);
  }
  return body;
}
