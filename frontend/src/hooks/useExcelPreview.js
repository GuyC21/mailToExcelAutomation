import { useCallback, useEffect, useState } from 'react';
import { apiRequest, downloadAuthenticatedFile } from '../api/client';

/**
 * Hook: useExcelPreview
 *
 * Fetches and manages a live preview of the target master Excel file and exposes
 * an authenticated download action that avoids putting JWTs in query strings.
 *
 * @param {number} [limit=8] - Maximum number of recent rows to retrieve.
 * @returns {{
 *   preview: object|null,
 *   isLoading: boolean,
 *   error: string|null,
 *   refresh: () => Promise<void>,
 *   downloadExcel: () => Promise<void>,
 * }}
 */
export function useExcelPreview(limit = 8) {
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPreview = useCallback((signal) => apiRequest(`/api/excel/preview?limit=${limit}`, { signal }), [limit]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const data = await fetchPreview(controller.signal);
        if (!controller.signal.aborted) {
          setPreview(data);
          setError(null);
        }
      } catch (err) {
        if (err?.name !== 'AbortError' && !controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [fetchPreview]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setPreview(await fetchPreview());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPreview]);

  const downloadExcel = useCallback(
    () => downloadAuthenticatedFile('/api/excel/download', 'BillingStream_Master.xlsx'),
    [],
  );

  return { preview, isLoading, error, refresh, downloadExcel };
}
