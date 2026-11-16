import { useState, useCallback } from 'react';
import { apiRequest, apiUrl } from '../api/client';

/**
 * Custom React Hook: useDocuments
 * 
 * Manages fetching, updating, and deleting document ingestion records for the Review page.
 * Synchronizes human reviewer attribution (user identity and update timestamp) across local state.
 * 
 * @returns {{
 *   documents: Array<Object>,
 *   loading: boolean,
 *   error: string|null,
 *   fetchDocuments: (status?: string|null) => Promise<void>,
 *   updateDocument: (id: number, updates: Object) => Promise<Object>,
 *   deleteDocument: (id: number) => Promise<void>,
 *   getDocumentUrl: (id: number) => string
 * }}
 */
export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetches recent document ingestions, optionally filtered by status.
   * @param {string|null} status - Optional filter ('VALID', 'NEEDS_REVIEW', 'EXTRACTION_FAILED')
   */
  const fetchDocuments = useCallback(async (status = null) => {
    setLoading(true);
    setError(null);
    try {
      const url = status ? `/api/documents?status=${status}` : '/api/documents';
      const data = await apiRequest(url);
      setDocuments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Updates extracted data or verification status for a document.
   * Merges server-assigned reviewer attribution (updated_by and updated_at) into state.
   * 
   * @param {number} id - Document ingestion ID.
   * @param {{ extracted_data?: Object, status?: string }} updates - Field updates.
   * @returns {Promise<Object>} API response including the updated document summary.
   */
  const updateDocument = async (id, updates) => {
    try {
      const res = await apiRequest(`/api/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: { 'Content-Type': 'application/json' }
      });
      // Synchronize updated fields and reviewer attribution into local documents state
      const serverDoc = res?.document || {};
      setDocuments((prev) => 
        prev.map((doc) => (doc.id === id ? { ...doc, ...updates, ...serverDoc } : doc))
      );
      return res;
    } catch (err) {
      throw err;
    }
  };

  /**
   * Deletes a document record from both database and the master Excel spreadsheet.
   * @param {number} id - Document ingestion ID.
   */
  const deleteDocument = async (id) => {
    try {
      await apiRequest(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      // Remove from local state immediately
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      throw err;
    }
  };

  /**
   * Builds the authenticated URL for streaming the physical PDF or image for preview.
   * @param {number} id - Document ingestion ID.
   * @returns {string} Fully resolved file URL.
   */
  const getDocumentUrl = (id) => apiUrl(`/api/documents/${id}/file`);

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
