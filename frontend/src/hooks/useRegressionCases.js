import { useCallback, useState } from 'react';
import { apiRequest, API_URL } from '../api/client';

/**
 * Turns free text into the same safe, ASCII-only case name the backend
 * will produce anyway (``services.regression.labeling.sanitise_case_name``).
 * Doing it client-side too is purely a UX nicety – it lets the "auto-fill
 * from file name" affordance show the labeler what name will actually be
 * saved, before they submit.
 * @param {string} value
 * @returns {string}
 */
export function slugifyCaseName(value) {
  return (value || '')
    .replace(/[^a-zA-Z0-9\-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Hook: useRegressionCases
 *
 * Encapsulates all API access for the תיוג (labeling) page: listing,
 * loading, saving and deleting hand-labeled ground-truth cases in
 * `data/regression_suite/`. Kept separate from `useRegression` (which only
 * triggers automated suite *runs*) since the two have distinct
 * responsibilities – authoring the suite vs. executing it.
 *
 * @returns {{
 *   cases: object[],               // RegressionCaseSummary[] currently in the suite
 *   isLoading: boolean,
 *   error: string|null,
 *   refresh: () => Promise<void>,
 *   loadCase: (name: string) => Promise<object>,
 *   saveCase: (args: {caseName: string, file: File|null, expected: object}) => Promise<object>,
 *   deleteCase: (name: string) => Promise<void>,
 *   documentUrl: (name: string) => string,
 * }}
 */
export function useRegressionCases() {
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/regression/cases');
      setCases(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCase = useCallback((name) => apiRequest(`/api/regression/cases/${encodeURIComponent(name)}`), []);

  /**
   * Saves (creates or updates) one labeled case.
   * @param {{caseName: string, file: File|null, expected: object}} args -
   *   `file` may be null when re-labeling an existing case without replacing its document.
   * @returns {Promise<object>} RegressionCaseSaveResult (`{case, warnings}`)
   */
  const saveCase = useCallback(async ({ caseName, file, expected }) => {
    const formData = new FormData();
    formData.append('case_name', caseName);
    formData.append('expected_json', JSON.stringify(expected));
    if (file) formData.append('file', file);
    return apiRequest('/api/regression/cases', { method: 'POST', body: formData });
  }, []);

  const deleteCase = useCallback(
    (name) => apiRequest(`/api/regression/cases/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    [],
  );

  /** @returns {string} URL to stream a case's source document for preview. */
  const documentUrl = useCallback((name) => `${API_URL}/api/regression/cases/${encodeURIComponent(name)}/document`, []);

  return { cases, isLoading, error, refresh, loadCase, saveCase, deleteCase, documentUrl };
}
