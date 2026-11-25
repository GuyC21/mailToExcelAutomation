import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

/**
 * Runs the regression suite against a chosen prompt version, and manages its
 * persisted Run History / A-B Comparison.
 *
 * @returns {{
 *   report: object|null,
 *   loading: boolean,
 *   error: string|null,
 *   runSuite: (promptId?: number|null) => Promise<void>,
 *   prompts: object[],
 *   history: object[],
 *   historyLoading: boolean,
 *   historyError: string|null,
 *   loadHistory: () => Promise<void>,
 *   deleteRun: (runId: number) => Promise<void>,
 *   comparison: object|null,
 *   compareLoading: boolean,
 *   compareError: string|null,
 *   compareRuns: (runAId: number, runBId: number) => Promise<void>,
 *   clearComparison: () => void,
 * }}
 */
export function useRegression() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prompts, setPrompts] = useState([]);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await apiRequest('/api/regression/runs');
      setHistory(response.runs || []);
    } catch (err) {
      setHistoryError(err.message || 'שגיאה בטעינת היסטוריית ההרצות');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [promptList, runsRes] = await Promise.all([
          apiRequest('/api/prompts/'),
          apiRequest('/api/regression/runs'),
        ]);
        if (!active) return;
        setPrompts(Array.isArray(promptList) ? promptList : []);
        setHistory(runsRes.runs || []);
        setHistoryError(null);
      } catch (err) {
        if (active) setHistoryError(err.message || 'שגיאה בטעינת נתוני הרגרסיה');
      } finally {
        if (active) setHistoryLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const runSuite = useCallback(async (promptId = null) => {
    setLoading(true);
    setError(null);
    try {
      const query = promptId ? `?prompt_id=${encodeURIComponent(promptId)}` : '';
      const response = await apiRequest(`/api/regression/run${query}`, { method: 'POST' });
      if (response.success) {
        setReport(response.data);
        loadHistory();
      } else {
        setError(response.error || 'הרצת חבילת הרגרסיה נכשלה');
      }
    } catch (err) {
      setError(err.message || 'שגיאה בהפעלת בדיקות הרגרסיה');
    } finally {
      setLoading(false);
    }
  }, [loadHistory]);

  const deleteRun = useCallback(async (runId) => {
    await apiRequest(`/api/regression/runs/${runId}`, { method: 'DELETE' });
    setHistory((current) => current.filter((run) => run.id !== runId));
    setComparison((current) => (current && [current.run_a.id, current.run_b.id].includes(runId) ? null : current));
  }, []);

  const compareRuns = useCallback(async (runAId, runBId) => {
    setCompareLoading(true);
    setCompareError(null);
    try {
      setComparison(await apiRequest(`/api/regression/runs/compare?run_a=${runAId}&run_b=${runBId}`));
    } catch (err) {
      setComparison(null);
      setCompareError(err.message || 'שגיאה בהשוואת ההרצות');
    } finally {
      setCompareLoading(false);
    }
  }, []);

  const clearComparison = useCallback(() => {
    setComparison(null);
    setCompareError(null);
  }, []);

  return {
    report,
    loading,
    error,
    runSuite,
    prompts,
    history,
    historyLoading,
    historyError,
    loadHistory,
    deleteRun,
    comparison,
    compareLoading,
    compareError,
    compareRuns,
    clearComparison,
  };
}
