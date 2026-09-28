/**
 * Shared API access for hooks. Components never call fetch directly.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
    response = await fetch(`${API_URL}${path}`, options);
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
