import { useState } from 'react';
import { apiRequest } from '../api/client';

/**
 * Hook: useIngestion
 * 
 * Manages the state and API interaction for the "Direct Upload" flow in the sandbox.
 * We extract this logic into a custom hook to keep the component layer clean and 
 * to encapsulate the FormData construction and loading/error states.
 * 
 * @returns {{
 *   isUploading: boolean, // Indicates if an upload is currently in progress
 *   result: object|null,  // The extraction result payload from the server
 *   error: string|null,   // Error message if the upload failed
 *   uploadFile: (file: File) => Promise<object|null>, // Function to trigger the upload
 *   reset: () => void     // Helper to clear current results/errors
 * }}
 */
export function useIngestion() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const uploadFile = async (file) => {
    setIsUploading(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await apiRequest('/api/ingestion/upload', { method: 'POST', body: formData });
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { isUploading, result, error, uploadFile, reset };
}
