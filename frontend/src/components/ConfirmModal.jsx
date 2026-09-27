import React from 'react';

const ConfirmModal = ({ isOpen, title, message, confirmText = "אישור", cancelText = "ביטול", onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm md:text-base">{message}</p>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse md:flex-row justify-end gap-3 rounded-b-lg">
          <button
            onClick={onCancel}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-gray-300 font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="w-full md:w-auto px-4 py-2 bg-red-600 rounded text-white hover:bg-red-700 transition focus:outline-none focus:ring-2 focus:ring-red-500 font-medium shadow-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
