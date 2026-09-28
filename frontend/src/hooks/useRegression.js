import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

/**
 * Runs the regression suite against a chosen prompt version.
 *
 * The API response (`data`) is `{prompt, providers, summary: {total, passed,
 * failed, scored, coverage, average_score, scored_average_score}, warnings,
 * results: [...]}` - see `services/regression/runner.py`. Scores are 0-100.
 */
export function useRegression() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prompts, setPrompts] = useState([]);

  const loadPrompts = useCallback(async () => {
    try {
      setPrompts(await apiRequest('/api/prompts/'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  /** @param {number|null} promptId - null runs the active prompt. */
  const runSuite = async (promptId = null) => {
    setLoading(true);
    setError(null);
    try {
      const query = promptId ? `?prompt_id=${encodeURIComponent(promptId)}` : '';
      const response = await apiRequest(`/api/regression/run${query}`, { method: 'POST' });
      if (response.success) {
        setReport(response.data);
      } else {
        setError(response.error || 'Suite failed to execute.');
      }
    } catch (err) {
      setError(err.message || 'Failed to trigger regression suite.');
    } finally {
      setLoading(false);
    }
  };

  return { report, loading, error, runSuite, prompts };
}
