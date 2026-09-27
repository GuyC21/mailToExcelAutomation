import { useState } from 'react';
import { apiRequest } from '../api/client';

/**
 * Sandbox direct upload: runs one file through the production pipeline.
 * @returns {{isUploading: boolean, result: object|null, error: string|null,
 *   uploadFile: (file: File) => Promise<object|null>, reset: () => void}}
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
