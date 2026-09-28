import { useEffect, useState } from 'react';

/**
 * Preview pane for the document being labeled: a locally chosen file before
 * it's saved (rendered from an object URL) or an already-saved case's
 * document (streamed from the backend). Exactly one of `file`/`url` should
 * be set at a time; `file` takes priority.
 * @param {{file: File|null, url: string|null}} props
 */
const DocumentPreview = ({ file, url }) => {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return undefined;
    }
    const created = URL.createObjectURL(file);
    setObjectUrl(created);
    return () => URL.revokeObjectURL(created); // avoid leaking blob URLs as the user browses cases
  }, [file]);

  const src = objectUrl || url;
  const isImage = file ? file.type.startsWith('image/') : /\.(png|jpe?g|webp)$/i.test(url || '');

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 p-2 h-full">
      {!src ? (
        <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg gap-2">
          <span className="text-3xl">📄</span>
          בחר או העלה קובץ כדי לצפות בו כאן
        </div>
      ) : isImage ? (
        <img src={src} alt="תצוגה מקדימה של המסמך"
            className="w-full h-full min-h-[420px] object-contain rounded bg-gray-50" />
      ) : (
        <iframe title="תצוגה מקדימה של המסמך" src={src}
               className="w-full h-full min-h-[420px] lg:min-h-[600px] rounded bg-gray-50" />
      )}
    </div>
  );
};

export default DocumentPreview;
