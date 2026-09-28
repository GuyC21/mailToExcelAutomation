import { useState } from 'react';
import { apiRequest } from '../api/client';

export function useRegression() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSuite = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest('/api/regression/run', { method: 'POST' });
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

  return { report, loading, error, runSuite };
}
