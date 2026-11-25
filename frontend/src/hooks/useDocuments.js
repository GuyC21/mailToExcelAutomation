import { useState, useCallback, useRef } from 'react';
import { apiRequest } from '../api/client';

/**
 * Custom React Hook: useDocuments
 *
 * Manages fetching, updating, and deleting document ingestion records for the Review page.
 * Synchronizes human reviewer attribution and filters stale out-of-order responses.
 *
 * @returns {{
 *   documents: Array<Object>,
 *   loading: boolean,
 *   error: string|null,
 *   fetchDocuments: (status?: string|null) => Promise<void>,
 *   updateDocument: (id: number, updates: Object, activeFilter?: string) => Promise<Object>,
 *   deleteDocument: (id: number) => Promise<void>,
 *   getDocumentUrl: (id: number) => string,
 * }}
 */
export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  /**
   * Fetches recent document ingestions, optionally filtered by status.
   * @param {string|null} [status=null] - Optional status filter.
   * @returns {Promise<void>}
   */
  const fetchDocuments = useCallback(async (status = null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const url = status ? `/api/documents?status=${encodeURIComponent(status)}` : '/api/documents';
      const data = await apiRequest(url, { signal: controller.signal });
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Updates extracted data or verification status for a document.
   * Removes the document from the active list if its new status no longer matches `activeFilter`.
   * @param {number} id - Document ingestion ID.
   * @param {{ extracted_data?: Object, status?: string }} updates - Field updates.
   * @param {string} [activeFilter='ALL'] - Currently active UI status filter.
   * @returns {Promise<Object>} API response including the updated document summary.
   */
  const updateDocument = useCallback(async (id, updates, activeFilter = 'ALL') => {
    const res = await apiRequest(`/api/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      headers: { 'Content-Type': 'application/json' },
    });
    const serverDoc = res?.document || {};
    const nextStatus = serverDoc.status || updates.status;

    setDocuments((prev) => {
      if (activeFilter !== 'ALL' && nextStatus && nextStatus !== activeFilter) {
        return prev.filter((doc) => doc.id !== id);
      }
      return prev.map((doc) => (doc.id === id ? { ...doc, ...updates, ...serverDoc } : doc));
    });
    return res;
  }, []);

  /**
   * Deletes a document record from the database, inbox, and master Excel spreadsheet.
   * @param {number} id - Document ingestion ID.
   * @returns {Promise<void>}
   */
  const deleteDocument = useCallback(async (id) => {
    await apiRequest(`/api/documents/${id}`, { method: 'DELETE' });
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  /**
   * Builds the relative API path for authenticated Blob preview streaming.
   * @param {number} id - Document ingestion ID.
   * @returns {string} Relative API path for the document bytes.
   */
  const getDocumentUrl = useCallback((id) => `/api/documents/${id}/file`, []);

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    updateDocument,
    deleteDocument,
    getDocumentUrl,
  };
}
