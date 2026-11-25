/**
 * Bring-Your-Own-Key (BYOK) Context Provider.
 *
 * Manages client-side session state for personal LLM API keys (Google Gemini & OpenAI).
 * Strictly persists keys in browser `sessionStorage` with zero server disk persistence.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { apiRequest } from '../api/client';
import { BYOKContext } from './contexts';
import { clearStoredKeys, persistStoredKeys, readStoredKeys } from '../utils/byokStorage';

/**
 * Provides global personal LLM key state, engine selection, and verification modal controls.
 * @component
 * @param {{ children: React.ReactNode }} props - Child elements requiring BYOK state.
 * @returns {JSX.Element}
 */
export function BYOKProvider({ children }) {
  const [geminiKey, setGeminiKey] = useState(() => readStoredKeys().gemini);
  const [openaiKey, setOpenaiKey] = useState(() => readStoredKeys().openai);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState(null);

  const activeEngine = geminiKey.trim()
    ? 'gemini'
    : openaiKey.trim()
      ? 'openai'
      : 'mock';

  const saveKeys = useCallback(({ newGemini, newOpenai }) => {
    const cleanGemini = (newGemini !== undefined ? newGemini : geminiKey).trim();
    const cleanOpenai = (newOpenai !== undefined ? newOpenai : openaiKey).trim();
    setGeminiKey(cleanGemini);
    setOpenaiKey(cleanOpenai);
    persistStoredKeys(cleanGemini, cleanOpenai);
  }, [geminiKey, openaiKey]);

  const clearKeys = useCallback(() => {
    setGeminiKey('');
    setOpenaiKey('');
    setVerificationFeedback(null);
    clearStoredKeys();
  }, []);

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

  const value = useMemo(() => ({
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
  }), [
    geminiKey,
    openaiKey,
    activeEngine,
    isModalOpen,
    isVerifying,
    verificationFeedback,
    openModal,
    closeModal,
    saveKeys,
    clearKeys,
    verifyKey,
  ]);

  return <BYOKContext.Provider value={value}>{children}</BYOKContext.Provider>;
}
