import { useCallback, useEffect, useState } from 'react';
import { API_URL, apiRequest } from '../api/client';

/**
 * Live view of the Excel source of truth (latest rows + status counts).
 * @param {number} [limit=8]
 * @returns {{preview: object|null, isLoading: boolean, error: string|null,
 *   refresh: Function, downloadUrl: string}}
 */
export function useExcelPreview(limit = 8) {
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setPreview(await apiRequest(`/api/excel/preview?limit=${limit}`));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    return load();
  }, [load]);

  return { preview, isLoading, error, refresh, downloadUrl: `${API_URL}/api/excel/download` };
}
