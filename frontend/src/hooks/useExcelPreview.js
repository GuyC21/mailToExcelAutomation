import { useCallback, useEffect, useState } from 'react';
import { API_URL, apiRequest } from '../api/client';

/**
 * Hook: useExcelPreview
 * 
 * Fetches and manages a live preview of the target Excel file where extraction 
 * results are appended. This allows the sandbox to verify that the end-to-end 
 * process actually wrote the expected data to the "database" (Excel).
 * 
 * @param {number} [limit=8] - Maximum number of recent rows to retrieve from the Excel file
 * @returns {{
 *   preview: object|null,  // The parsed Excel data including rows and statistics
 *   isLoading: boolean,    // True on initial load or during refresh
 *   error: string|null,    // Error message if the preview fetch fails
 *   refresh: () => Promise<void>, // Function to manually trigger a re-fetch of the Excel data
 *   downloadUrl: string    // Direct URL for the user to download the actual Excel file
 * }}
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
