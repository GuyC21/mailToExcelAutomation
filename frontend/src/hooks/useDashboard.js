import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

/**
 * Dashboard statistics.
 * @param {'operational'|'all'} scope - operational = emailed documents read by
 *   a real AI provider; all = also sandbox uploads and mock extractions.
 */
export function useDashboard(scope = 'operational') {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest(`/api/dashboard/stats?scope=${encodeURIComponent(scope)}`);
      setStats(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}
