import { useEffect, useState } from 'react';
import { fetchAuthenticatedBlob } from '../../api/client';

/**
 * Preview pane for documents: renders a local File (before upload) or fetches
 * a protected backend document via Authorization headers into a Blob URL so
 * Bearer tokens are never placed into iframe/img query strings.
 * @component
 * @param {{ file?: File|null, url?: string|null, mimeType?: string|null }} props
 * @returns {JSX.Element}
 */
const DocumentPreview = ({ file = null, url = null, mimeType = null }) => {
  const [preview, setPreview] = useState({ key: null, src: null, type: null, error: null });

  const sourceKey = file ? `file:${file.name}:${file.size}:${file.lastModified}` : url ? `url:${url}` : null;

  useEffect(() => {
    if (!sourceKey) return undefined;

    if (file) {
      const created = URL.createObjectURL(file);
      const timer = setTimeout(() => {
        setPreview({ key: sourceKey, src: created, type: file.type || mimeType || '', error: null });
      }, 0);
      return () => {
        clearTimeout(timer);
        URL.revokeObjectURL(created);
      };
    }

    const controller = new AbortController();
    let created = null;

    fetchAuthenticatedBlob(url, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        created = URL.createObjectURL(blob);
        setPreview({
          key: sourceKey,
          src: created,
          type: blob.type || mimeType || '',
          error: null,
        });
      })
      .catch((err) => {
        if (err?.name !== 'AbortError' && !controller.signal.aborted) {
          setPreview({ key: sourceKey, src: null, type: null, error: err.message || 'שגיאה בטעינת המסמך' });
        }
      });

    return () => {
      controller.abort();
      if (created) URL.revokeObjectURL(created);
    };
  }, [file, url, mimeType, sourceKey]);

  const active = sourceKey && preview.key === sourceKey ? preview : null;
  const isLoading = Boolean(sourceKey && !active);
  const resolvedType = active?.type || mimeType || '';
  const isImage = resolvedType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(url || '');

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 p-2 h-full min-h-[420px]">
      {!sourceKey ? (
        <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg gap-2">
          <span className="text-3xl">📄</span>
          בחר או העלה קובץ כדי לצפות בו כאן
        </div>
      ) : isLoading ? (
        <div className="h-full min-h-[400px] flex items-center justify-center text-sm text-gray-400">טוען תצוגה מקדימה...</div>
      ) : active?.error ? (
        <div className="h-full min-h-[400px] flex items-center justify-center text-sm text-red-600 p-4 text-center">{active.error}</div>
      ) : isImage ? (
        <img src={active.src} alt="תצוגה מקדימה של המסמך" className="w-full h-full min-h-[400px] object-contain rounded bg-gray-50" />
      ) : (
        <iframe title="תצוגה מקדימה של המסמך" src={active.src} className="w-full h-full min-h-[400px] lg:min-h-[600px] rounded bg-gray-50" />
      )}
    </div>
  );
};

export default DocumentPreview;
