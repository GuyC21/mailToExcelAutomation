/**
 * Ephemeral browser sessionStorage helpers for Bring-Your-Own-Key (BYOK) credentials.
 * Keys live strictly in the current tab's sessionStorage and are never written to disk.
 */

export const BYOK_STORAGE_KEYS = {
  GEMINI: 'bs_byok_gemini',
  OPENAI: 'bs_byok_openai',
};

/**
 * Reads stored BYOK credentials safely from sessionStorage.
 * @returns {{ gemini: string, openai: string }} Saved API keys (empty string when unset).
 */
export function readStoredKeys() {
  try {
    return {
      gemini: sessionStorage.getItem(BYOK_STORAGE_KEYS.GEMINI) || '',
      openai: sessionStorage.getItem(BYOK_STORAGE_KEYS.OPENAI) || '',
    };
  } catch {
    return { gemini: '', openai: '' };
  }
}

/**
 * Persists or clears sanitized BYOK keys in browser sessionStorage.
 * @param {string} gemini - Sanitized Gemini API key.
 * @param {string} openai - Sanitized OpenAI API key.
 */
export function persistStoredKeys(gemini, openai) {
  try {
    if (gemini) sessionStorage.setItem(BYOK_STORAGE_KEYS.GEMINI, gemini);
    else sessionStorage.removeItem(BYOK_STORAGE_KEYS.GEMINI);

    if (openai) sessionStorage.setItem(BYOK_STORAGE_KEYS.OPENAI, openai);
    else sessionStorage.removeItem(BYOK_STORAGE_KEYS.OPENAI);
  } catch (err) {
    console.warn('Failed to save BYOK keys to sessionStorage:', err);
  }
}

/**
 * Clears all ephemeral BYOK keys from browser sessionStorage.
 */
export function clearStoredKeys() {
  try {
    sessionStorage.removeItem(BYOK_STORAGE_KEYS.GEMINI);
    sessionStorage.removeItem(BYOK_STORAGE_KEYS.OPENAI);
  } catch (err) {
    console.warn('Failed to clear sessionStorage BYOK keys:', err);
  }
}
