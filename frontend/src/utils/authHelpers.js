/**
 * Authentication error translation and profile synchronization helpers.
 */
import { apiRequest, setAuthToken } from '../api/client';

/**
 * Translates raw Supabase GoTrue English errors into clear Hebrew notices.
 * @param {Error|{message?: string}} error - Error returned by Supabase Auth.
 * @param {string} [fallback='אירעה שגיאה באימות המשתמש'] - Default Hebrew fallback message.
 * @returns {string} Localized, safe user-facing error message.
 */
export function translateAuthError(error, fallback = 'אירעה שגיאה באימות המשתמש') {
  const msg = error?.message || '';
  if (msg.includes('Invalid login credentials')) {
    return 'שם משתמש או סיסמה שגויים';
  }
  if (msg.includes('User already registered')) {
    return 'כתובת אימייל זו כבר רשומה במערכת';
  }
  if (msg.includes('Email not confirmed')) {
    return 'כתובת האימייל טרם אומתה. בדוק את תיבת הדואר שלך.';
  }
  if (msg.includes('Password should be at least')) {
    return 'הסיסמה אינה עומדת בדרישות האבטחה המינימליות';
  }
  if (msg.toLowerCase().includes('rate limit') || msg.includes('429')) {
    return 'בוצעו ניסיונות רבים מדי. המתן מספר דקות ונסה שנית.';
  }
  return fallback;
}

/**
 * Synchronizes a newly registered user's display name with the backend database.
 * @param {string} accessToken - Newly issued Supabase JWT token.
 * @param {string} fullName - User's full display name.
 * @returns {Promise<object|null>} Synchronized UserProfile or null on transient failure.
 */
export async function syncRegisteredProfile(accessToken, fullName) {
  setAuthToken(accessToken);
  try {
    return await apiRequest('/api/auth/sync-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName.trim() }),
    });
  } catch (err) {
    console.warn('Profile sync warning:', err);
    return null;
  }
}

/**
 * Fetches the authenticated user's profile and approval status from the backend.
 * @param {string} accessToken - Active Supabase JWT access token.
 * @returns {Promise<object|null>} UserProfile payload or null when unauthenticated/failing.
 */
export async function fetchCurrentUserProfile(accessToken) {
  if (!accessToken) return null;
  setAuthToken(accessToken);
  try {
    return await apiRequest('/api/auth/me');
  } catch (err) {
    console.warn('Failed to fetch user profile:', err.message);
    return null;
  }
}

/**
 * Throws a localized fail-closed error when Supabase client config is absent.
 * @param {boolean} configured - Result of `isSupabaseConfigured`.
 */
export function assertSupabaseConfigured(configured) {
  if (!configured) {
    throw new Error('שירות האימות (Supabase) אינו מוגדר בסביבה זו. יש להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.');
  }
}
