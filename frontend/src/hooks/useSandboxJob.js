import { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../api/client';

/**
 * Hook: useSandboxJob
 *
 * Provides resilient in-flight job tracking for the Sandbox page.
 * On mount, queries the backend for any PROCESSING (or recently completed) job
 * belonging to the current user. Polls multi-attachment emails until `all_completed`
 * is true so partial attachments never cut off tracking early.
 *
 * @returns {{
 *   isTracking: boolean,
 *   trackedResults: object[],
 *   trackedEmail: object|null,
 *   trackedChannel: string|null,
 *   checkActiveJob: () => Promise<void>,
 * }}
 */
export function useSandboxJob() {
  const [isTracking, setIsTracking] = useState(false);
  const [trackedResults, setTrackedResults] = useState([]);
  const [trackedEmail, setTrackedEmail] = useState(null);
  const [trackedChannel, setTrackedChannel] = useState(null);
  const intervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const applyJobOutcome = useCallback((job) => {
    const list = Array.isArray(job.all_results) && job.all_results.length > 0 ? job.all_results : [job];
    setTrackedResults(list);
    setTrackedChannel(job.channel || null);
    setTrackedEmail(job.email || null);
  }, []);

  const startPolling = useCallback((documentId) => {
    stopPolling();
    setIsTracking(true);

    intervalRef.current = setInterval(async () => {
      try {
        const job = await apiRequest(`/api/sandbox/job-result/${documentId}`);
        if (job.all_completed) {
          stopPolling();
          applyJobOutcome(job);
          setIsTracking(false);
        }
      } catch {
        // Silently retry on transient errors; the interval keeps firing
      }
    }, 1500);
  }, [stopPolling, applyJobOutcome]);

  const checkActiveJob = useCallback(async () => {
    try {
      const response = await apiRequest('/api/sandbox/active-job');
      if (response.document_id) {
        if (response.channel) {
          setTrackedChannel(response.channel);
        }
        if (response.active) {
          startPolling(response.document_id);
        } else {
          const job = await apiRequest(`/api/sandbox/job-result/${response.document_id}`);
          applyJobOutcome(job);
        }
      }
    } catch {
      // Degrade gracefully when unreachable
    }
  }, [startPolling, applyJobOutcome]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiRequest('/api/sandbox/active-job');
        if (!active || !response.document_id) return;
        if (response.channel) setTrackedChannel(response.channel);
        if (response.active) {
          startPolling(response.document_id);
        } else {
          const job = await apiRequest(`/api/sandbox/job-result/${response.document_id}`);
          if (active) applyJobOutcome(job);
        }
      } catch {
        // Degrade gracefully when unreachable
      }
    })();

    return () => {
      active = false;
      stopPolling();
    };
  }, [startPolling, applyJobOutcome, stopPolling]);

  return { isTracking, trackedResults, trackedEmail, trackedChannel, checkActiveJob };
}
