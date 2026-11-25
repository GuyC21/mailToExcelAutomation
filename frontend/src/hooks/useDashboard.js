import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

/**
 * Dashboard statistics hook with race-safe cancellation across scope switches.
 * @param {'operational'|'all'} [scope='operational'] - Data scope to request.
 * @returns {{ stats: object|null, loading: boolean, error: string|null, refresh: () => Promise<void> }}
 */
export function useDashboard(scope = 'operational') {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async (signal) => {
    const response = await apiRequest(`/api/dashboard/stats?scope=${encodeURIComponent(scope)}`, { signal });
    return response;
  }, [scope]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await loadStats(controller.signal);
        if (!controller.signal.aborted) {
          setStats(response);
          setError(null);
        }
      } catch (err) {
        if (err?.name !== 'AbortError' && !controller.signal.aborted) {
          setError(err.message || 'שגיאה בטעינת נתוני הדאשבורד');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [loadStats]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await loadStats();
      setStats(response);
    } catch (err) {
      setError(err.message || 'שגיאה בטעינת נתוני הדאשבורד');
    } finally {
      setLoading(false);
    }
  }, [loadStats]);

  return { stats, loading, error, refresh };
}
