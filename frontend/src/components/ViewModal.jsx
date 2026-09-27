import React from 'react';

const ViewModal = ({ isOpen, title, content, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="סגור"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-gray-900 text-green-400 font-mono text-sm leading-relaxed text-left" dir="ltr">
          <pre className="whitespace-pre-wrap">{content}</pre>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100">
          <button
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
