/**
 * Shared API access layer for frontend hooks and components.
 *
 * Injects authenticated Supabase Bearer JWT tokens into HTTP headers,
 * handles authenticated Blob downloads/previews without exposing tokens in URLs,
 * and standardizes error handling with user-friendly Hebrew error messages.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Optional legacy Backoffice key (for backward compatibility with automated scripts). */
const API_KEY = import.meta.env.VITE_API_KEY || '';
let _cachedToken = null;

/**
 * Sets the active JWT token in memory for outgoing API requests.
 * @param {string|null} token - Active Supabase access token, or null on signout.
 */
export function setAuthToken(token) {
  _cachedToken = token;
}

/**
 * Retrieves the active JWT token, checking memory cache before Supabase localStorage.
 * @returns {string|null} Active JWT string or null if unauthenticated.
 */
export function getAuthToken() {
  if (_cachedToken) return _cachedToken;
  try {
    const sbKey = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
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
 * Builds HTTP headers carrying auth credentials and ephemeral BYOK keys.
 * @param {HeadersInit} [headers] - Optional caller-supplied headers to merge.
 * @returns {Record<string, string>} Merged headers dictionary.
 */
export function authHeaders(headers = {}) {
  const merged = { ...(headers || {}) };
  const token = getAuthToken();
  if (token) merged['Authorization'] = `Bearer ${token}`;
  if (API_KEY) merged['X-API-Key'] = API_KEY;
  try {
    const geminiKey = sessionStorage.getItem('bs_byok_gemini');
    const openaiKey = sessionStorage.getItem('bs_byok_openai');
    if (geminiKey) merged['X-Gemini-API-Key'] = geminiKey.trim();
    if (openaiKey) merged['X-OpenAI-API-Key'] = openaiKey.trim();
  } catch {
    // Ignore sessionStorage access errors
  }
  return merged;
}

/**
 * Performs an authenticated fetch and raises a localized error on non-2xx responses.
 * @param {string} path - Relative API path or full URL.
 * @param {RequestInit} [options] - Fetch configuration options.
 * @returns {Promise<Response>} Validated successful Response.
 */
async function performFetch(path, options = {}) {
  const target = path.startsWith('http://') || path.startsWith('https://') ? path : `${API_URL}${path}`;
  let response;
  try {
    response = await fetch(target, { ...options, headers: authHeaders(options.headers) });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error('אין תקשורת עם השרת. ודא שה-Backend פועל.');
  }
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new CustomEvent('billingstream:auth_expired'));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'הבקשה נכשלה');
  }
  return response;
}

/**
 * Performs an API request and returns parsed JSON.
 * @param {string} path - API path, e.g. "/api/excel/preview".
 * @param {RequestInit} [options] - Optional fetch options.
 * @returns {Promise<any>} Parsed JSON payload.
 */
export async function apiRequest(path, options = {}) {
  const response = await performFetch(path, options);
  return response.json().catch(() => ({}));
}

/**
 * Fetches a protected binary asset (PDF, image, spreadsheet) using Authorization headers
 * instead of exposing Bearer JWT tokens in query strings.
 * @param {string} path - Relative API path or full URL.
 * @param {AbortSignal} [signal] - Optional abort signal for lifecycle cleanup.
 * @returns {Promise<Blob>} Fetched binary Blob with server Content-Type preserved.
 */
export async function fetchAuthenticatedBlob(path, signal) {
  const response = await performFetch(path, { method: 'GET', signal });
  return response.blob();
}

/**
 * Downloads a protected file via authenticated Blob fetch and triggers browser save.
 * Immediately cleans up temporary anchor tags and revokes object URLs to prevent leaks.
 * @param {string} path - API path for the download endpoint.
 * @param {string} fallbackFilename - Default filename if Content-Disposition omits one.
 * @returns {Promise<void>}
 */
export async function downloadAuthenticatedFile(path, fallbackFilename) {
  const response = await performFetch(path, { method: 'GET' });
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
