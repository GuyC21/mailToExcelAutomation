import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

/**
 * ViewModal Component
 *
 * Accessible monospace modal used to display the complete wrapped LLM system envelope.
 * @component
 * @param {{
 *   isOpen: boolean,
 *   title: string,
 *   content: string,
 *   onClose: () => void,
 * }} props
 * @returns {JSX.Element|null}
 */
const ViewModal = ({ isOpen, title, content, onClose }) => {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 id={titleId} className="text-xl font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="סגור"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-gray-900 text-green-400 font-mono text-sm leading-relaxed text-left" dir="ltr">
          <pre className="whitespace-pre-wrap">{content}</pre>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 rounded text-white hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-sm"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewModal;
