import { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../api/client';

/**
 * Hook: useSandboxJob
 *
 * Provides resilient in-flight job tracking for the Sandbox page.
 * On mount, queries the backend for any PROCESSING job belonging to the
 * current user.  If found, starts polling the job status every 1.5 seconds
 * until it completes (or fails), then exposes the finished result for the
 * Sandbox UI to render.
 *
 * This solves the "browser refresh loses spinner" problem: because the
 * PROCESSING record lives in the database, a refresh re-discovers it.
 *
 * @returns {{
 *   isTracking: boolean,            // True while a backend job is PROCESSING
 *   trackedResult: object|null,     // The completed job's extraction result
 *   trackedEmail: object|null,      // The email metadata if the job was email-based
 *   checkActiveJob: () => Promise,  // Re-check for active jobs (call after starting a new one)
 * }}
 */
export function useSandboxJob() {
  const [isTracking, setIsTracking] = useState(false);
  const [trackedResults, setTrackedResults] = useState([]);
  const [trackedEmail, setTrackedEmail] = useState(null);
  const intervalRef = useRef(null);

  /** Clears any active polling interval. */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Applies the fetched job outcome to hook state.
   */
  const applyJobOutcome = useCallback((job) => {
    const list = Array.isArray(job.all_results) && job.all_results.length > 0
      ? job.all_results
      : [job];
    setTrackedResults(list);
    if (job.email) {
      setTrackedEmail(job.email);
    }
  }, []);

  /**
   * Polls a specific document's status until it leaves PROCESSING.
   * @param {number} documentId - The document_ingestion PK to poll.
   */
  const startPolling = useCallback((documentId) => {
    stopPolling();
    setIsTracking(true);

    intervalRef.current = setInterval(async () => {
      try {
        const job = await apiRequest(`/api/sandbox/job-result/${documentId}`);
        if (job.all_completed || job.status !== 'PROCESSING') {
          stopPolling();
          applyJobOutcome(job);
          setIsTracking(false);
        }
      } catch {
        // Silently retry on transient errors; the interval keeps firing
      }
    }, 1500);
  }, [stopPolling, applyJobOutcome]);

  /**
   * Queries the backend for a PROCESSING (or recently completed) job owned by the current user.
   * Called on mount and can be re-called after initiating a new upload/email.
   */
  const checkActiveJob = useCallback(async () => {
    try {
      const response = await apiRequest('/api/sandbox/active-job');
      if (response.document_id) {
        if (response.active) {
          startPolling(response.document_id);
        } else {
          // Job already finished: restore full results immediately
          const job = await apiRequest(`/api/sandbox/job-result/${response.document_id}`);
          applyJobOutcome(job);
        }
      }
    } catch {
      // If the endpoint is unreachable, degrade gracefully — no spinner
    }
  }, [startPolling, applyJobOutcome]);

  // On mount: check for a surviving PROCESSING job from before the refresh
  useEffect(() => {
    checkActiveJob();
    return stopPolling;
  }, [checkActiveJob, stopPolling]);

  return { isTracking, trackedResults, trackedEmail, checkActiveJob };
}
