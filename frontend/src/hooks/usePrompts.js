import { useState, useCallback } from 'react';
import { apiRequest } from '../api/client';

/**
 * Custom React Hook: usePrompts
 *
 * Encapsulates CRUD, activation, AI enhancement, and technical-envelope
 * inspection for prompt versions via the centralized `apiRequest` client.
 *
 * @returns {{
 *   prompts: object[],
 *   loading: boolean,
 *   error: string|null,
 *   fetchPrompts: () => Promise<void>,
 *   createPrompt: (payload: {name: string, content: string, version_notes?: string, is_active?: boolean}) => Promise<{success: boolean, data?: object, error?: string}>,
 *   activatePrompt: (id: number) => Promise<{success: boolean, error?: string}>,
 *   deletePrompt: (id: number) => Promise<{success: boolean, error?: string}>,
 *   getTechnicalPrompt: (id: number) => Promise<{success: boolean, content?: string, error?: string}>,
 *   enhancePrompt: (text: string) => Promise<{success: boolean, text?: string, error?: string}>,
 * }}
 */
export function usePrompts() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPrompts = useCallback(async () => {
    try {
      const data = await apiRequest('/api/prompts/');
      setPrompts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'שגיאה בטעינת הפרומפטים');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPrompt = useCallback(async (payload) => {
    try {
      const created = await apiRequest('/api/prompts/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchPrompts();
      return { success: true, data: created };
    } catch (err) {
      return { success: false, error: err.message || 'שגיאה בשמירת הפרומפט' };
    }
  }, [fetchPrompts]);

  const activatePrompt = useCallback(async (id) => {
    try {
      await apiRequest(`/api/prompts/${id}/activate`, { method: 'POST' });
      await fetchPrompts();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'שגיאה בהפעלת הפרומפט' };
    }
  }, [fetchPrompts]);

  const deletePrompt = useCallback(async (id) => {
    try {
      await apiRequest(`/api/prompts/${id}`, { method: 'DELETE' });
      await fetchPrompts();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'שגיאה במחיקת הפרומפט' };
    }
  }, [fetchPrompts]);

  const getTechnicalPrompt = useCallback(async (id) => {
    try {
      const data = await apiRequest(`/api/prompts/${id}/technical`);
      return { success: true, content: data.technical_prompt };
    } catch (err) {
      return { success: false, error: err.message || 'שגיאה בטעינת הפרומפט הטכני' };
    }
  }, []);

  const enhancePrompt = useCallback(async (text) => {
    try {
      const data = await apiRequest('/api/prompts/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      return { success: true, text: data.enhanced_text };
    } catch (err) {
      return { success: false, error: err.message || 'שגיאה בשיפור הפרומפט' };
    }
  }, []);

  return {
    prompts,
    loading,
    error,
    fetchPrompts,
    createPrompt,
    activatePrompt,
    deletePrompt,
    getTechnicalPrompt,
    enhancePrompt,
  };
}
