import { useState, useCallback } from 'react';
import { apiRequest, apiUrl } from '../api/client';

/**
 * Hook to manage document ingestions for the Review page.
 */
export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const updateDocument = async (id, updates) => {
    try {
      await apiRequest(`/api/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: { 'Content-Type': 'application/json' }
      });
      // Optimistically update the local state
      setDocuments((prev) => 
        prev.map((doc) => (doc.id === id ? { ...doc, ...updates } : doc))
      );
    } catch (err) {
      throw err;
    }
  };

  const deleteDocument = async (id) => {
    try {
      await apiRequest(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      // Remove from local state
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      throw err;
    }
  };

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
