/**
 * Bring-Your-Own-Key (BYOK) Context Provider.
 * 
 * Manages client-side session state for personal LLM API keys (Google Gemini & OpenAI).
 * Strictly persists keys in browser `sessionStorage` (ephemeral across tab lifecycles)
 * and guarantees zero persistence to disk or backend databases.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

const BYOKContext = createContext(null);

const STORAGE_KEYS = {
  GEMINI: 'bs_byok_gemini',
  OPENAI: 'bs_byok_openai',
};

/**
 * BYOKProvider Component
 * 
 * Provides global context for managing personal LLM credentials:
 * - Reads/writes to browser `sessionStorage`.
 * - Computes the effective active engine ('gemini', 'openai', or 'mock').
 * - Coordinates the key verification modal.
 * 
 * @component
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export function BYOKProvider({ children }) {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState(null);

  // Restore keys from sessionStorage on mount
  useEffect(() => {
    try {
      const savedGemini = sessionStorage.getItem(STORAGE_KEYS.GEMINI) || '';
      const savedOpenAI = sessionStorage.getItem(STORAGE_KEYS.OPENAI) || '';
      if (savedGemini) setGeminiKey(savedGemini);
      if (savedOpenAI) setOpenaiKey(savedOpenAI);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  /**
   * Computes the current effective extraction mode:
   * 'gemini' | 'openai' | 'mock'
   */
  const activeEngine = geminiKey.trim()
    ? 'gemini'
    : openaiKey.trim()
    ? 'openai'
    : 'mock';

  /**
   * Saves personal keys to state and browser sessionStorage.
   * @param {{ newGemini?: string, newOpenai?: string }} keys
   */
  const saveKeys = useCallback(({ newGemini, newOpenai }) => {
    const cleanGemini = (newGemini !== undefined ? newGemini : geminiKey).trim();
    const cleanOpenai = (newOpenai !== undefined ? newOpenai : openaiKey).trim();

    setGeminiKey(cleanGemini);
    setOpenaiKey(cleanOpenai);

    try {
      if (cleanGemini) {
        sessionStorage.setItem(STORAGE_KEYS.GEMINI, cleanGemini);
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.GEMINI);
      }

      if (cleanOpenai) {
        sessionStorage.setItem(STORAGE_KEYS.OPENAI, cleanOpenai);
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.OPENAI);
      }
    } catch (err) {
      console.warn('Failed to save BYOK keys to sessionStorage:', err);
    }
  }, [geminiKey, openaiKey]);

  /**
   * Clears all stored keys and returns the engine to Mock Mode.
   */
  const clearKeys = useCallback(() => {
    setGeminiKey('');
    setOpenaiKey('');
    setVerificationFeedback(null);
    try {
      sessionStorage.removeItem(STORAGE_KEYS.GEMINI);
      sessionStorage.removeItem(STORAGE_KEYS.OPENAI);
    } catch (err) {
      console.warn('Failed to clear sessionStorage BYOK keys:', err);
    }
  }, []);

  /**
   * Verifies an API key against the backend validation endpoint.
   * @param {'gemini'|'openai'} provider
   * @param {string} apiKey
   * @returns {Promise<{ valid: boolean, message: string }>}
   */
  const verifyKey = useCallback(async (provider, apiKey) => {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('נא להזין מפתח API לבדיקה');
    }
    setIsVerifying(true);
    setVerificationFeedback(null);
    try {
      const res = await apiRequest('/api/llm/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: apiKey.trim() }),
      });
      const feedback = { valid: true, message: res.message || 'המפתח אומת בהצלחה!' };
      setVerificationFeedback(feedback);
      return feedback;
    } catch (err) {
      const feedback = { valid: false, message: err.message || 'אימות המפתח נכשל' };
      setVerificationFeedback(feedback);
      throw err;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const openModal = useCallback(() => {
    setVerificationFeedback(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const value = {
    geminiKey,
    openaiKey,
    activeEngine,
    hasPersonalKey: Boolean(geminiKey || openaiKey),
    isModalOpen,
    isVerifying,
    verificationFeedback,
    openModal,
    closeModal,
    saveKeys,
    clearKeys,
    verifyKey,
  };

  return <BYOKContext.Provider value={value}>{children}</BYOKContext.Provider>;
}

/**
 * Custom hook to consume BYOK Context.
 * @returns {object} BYOK state and controller functions.
 */
export function useBYOK() {
  const context = useContext(BYOKContext);
  if (!context) {
    throw new Error('useBYOK must be used within a BYOKProvider');
  }
  return context;
}
