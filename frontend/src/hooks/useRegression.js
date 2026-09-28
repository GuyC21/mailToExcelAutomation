import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

/**
 * Runs the regression suite against a chosen prompt version, and manages its
 * persisted Run History / A-B Comparison.
 *
 * Every `POST /run` is saved server-side as a `RegressionRun` row (see
 * `backend/models/regression.py`), so the report (`data`) now also carries
 * `id`/`created_at` - see `services/regression/runner.py` for the rest of
 * its shape: `{prompt, providers, summary, warnings, results}`, scores 0-100.
 */
export function useRegression() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prompts, setPrompts] = useState([]);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);

  const loadPrompts = useCallback(async () => {
    try {
      setPrompts(await apiRequest('/api/prompts/'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await apiRequest('/api/regression/runs');
      setHistory(response.runs || []);
    } catch (err) {
      setHistoryError(err.message || 'Failed to load run history.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadPrompts(); loadHistory(); }, [loadPrompts, loadHistory]);

  /** @param {number|null} promptId - null runs the active prompt. */
  const runSuite = async (promptId = null) => {
    setLoading(true);
    setError(null);
    try {
      const query = promptId ? `?prompt_id=${encodeURIComponent(promptId)}` : '';
      const response = await apiRequest(`/api/regression/run${query}`, { method: 'POST' });
      if (response.success) {
        setReport(response.data);
        loadHistory();
      } else {
        setError(response.error || 'Suite failed to execute.');
      }
    } catch (err) {
      setError(err.message || 'Failed to trigger regression suite.');
    } finally {
      setLoading(false);
    }
  };

  const deleteRun = async (runId) => {
    await apiRequest(`/api/regression/runs/${runId}`, { method: 'DELETE' });
    setHistory((current) => current.filter((run) => run.id !== runId));
    setComparison((current) => (current && [current.run_a.id, current.run_b.id].includes(runId) ? null : current));
  };

  /** @param {number} runAId - baseline (e.g. Prompt A). @param {number} runBId - candidate (e.g. Prompt B). */
  const compareRuns = async (runAId, runBId) => {
    setCompareLoading(true);
    setCompareError(null);
    try {
      setComparison(await apiRequest(`/api/regression/runs/compare?run_a=${runAId}&run_b=${runBId}`));
    } catch (err) {
      setComparison(null);
      setCompareError(err.message || 'Failed to compare runs.');
    } finally {
      setCompareLoading(false);
    }
  };

  const clearComparison = () => { setComparison(null); setCompareError(null); };

  return {
    report, loading, error, runSuite, prompts,
    history, historyLoading, historyError, loadHistory, deleteRun,
    comparison, compareLoading, compareError, compareRuns, clearComparison,
  };
}
