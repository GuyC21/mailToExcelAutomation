import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function usePrompts() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/prompts/`);
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const activatePrompt = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/prompts/${id}/activate`, { method: 'POST' });
      if (res.ok) {
        fetchPrompts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deletePrompt = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/prompts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPrompts();
        return { success: true };
      } else {
        const err = await res.json();
        return { success: false, error: err.detail || "שגיאה במחיקת הפרומפט" };
      }
    } catch (e) {
      console.error(e);
      return { success: false, error: "שגיאת תקשורת" };
    }
  };

  const getTechnicalPrompt = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/prompts/${id}/technical`);
      if (res.ok) {
        const data = await res.json();
        return { success: true, content: data.technical_prompt };
      }
      return { success: false, error: "שגיאה בטעינת הפרומפט הטכני" };
    } catch (e) {
      console.error(e);
      return { success: false, error: "שגיאת רשת בטעינת הפרומפט הטכני" };
    }
  };

  return {
    prompts,
    loading,
    fetchPrompts,
    activatePrompt,
    deletePrompt,
    getTechnicalPrompt
  };
}
