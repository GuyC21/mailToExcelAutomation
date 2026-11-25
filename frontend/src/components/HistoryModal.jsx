import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import PromptCard from './PromptCard';

/**
 * HistoryModal Component
 *
 * Full-screen scrollable modal listing all historical prompt versions.
 * @component
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   prompts: object[],
 *   onDuplicate: (prompt: object) => void,
 *   onActivate: (id: number) => void,
 *   onDelete: (prompt: object) => void,
 *   onViewTechnical: (id: number) => void,
 * }} props
 * @returns {JSX.Element|null}
 */
const HistoryModal = ({ isOpen, onClose, prompts, onDuplicate, onActivate, onDelete, onViewTechnical }) => {
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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-2 md:p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-full md:h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 id={titleId} className="text-xl md:text-2xl font-bold text-gray-900">מרכז ניהול גרסאות (תצוגה מורחבת)</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-full p-2 transition focus:outline-none"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-gray-50/50">
          <div className="flex flex-col gap-5">
            {prompts.length > 0 ? (
              prompts.map((p) => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  onDuplicate={(prompt) => {
                    onDuplicate(prompt);
                    onClose();
                  }}
                  onActivate={onActivate}
                  onDelete={onDelete}
                  onViewTechnical={onViewTechnical}
                />
              ))
            ) : (
              <p className="text-center text-gray-500 py-10">אין פרומפטים שמורים במערכת.</p>
            )}
          </div>
        </div>

        <div className="bg-white px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 rounded text-white hover:bg-gray-900 transition shadow-sm font-medium"
          >
            חזור למסך הראשי
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
