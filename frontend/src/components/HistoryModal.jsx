import React from 'react';
import PromptCard from './PromptCard';

const HistoryModal = ({ isOpen, onClose, prompts, onDuplicate, onActivate, onDelete, onViewTechnical }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-2 md:p-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-full md:h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">מרכז ניהול גרסאות (תצוגה מורחבת)</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-full p-2 transition focus:outline-none"
            aria-label="סגור"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-gray-50/50">
          <div className="flex flex-col gap-5">
            {prompts.length > 0 ? (
              prompts.map(p => (
                <PromptCard 
                  key={p.id}
                  prompt={p}
                  onDuplicate={(prompt) => { onDuplicate(prompt); onClose(); }}
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

        {/* Footer */}
        <div className="bg-white px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
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
