import React from 'react';

const PromptCard = ({ prompt, onDuplicate, onActivate, onDelete, onViewTechnical }) => {
  return (
    <div className={`p-4 md:p-5 rounded-lg shadow-sm border transition flex flex-col ${prompt.is_active ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2 sm:gap-0">
        <h3 className="font-bold text-lg text-gray-800">{prompt.name}</h3>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap justify-end">
          <button onClick={() => onDuplicate(prompt)} className="flex-1 sm:flex-none text-sm bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 px-3 py-1 rounded transition font-medium">
            שכפל לעריכה
          </button>
          {prompt.is_active ? (
            <span className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold w-full sm:w-auto text-center shadow-sm flex items-center justify-center">פעיל כעת</span>
          ) : (
            <>
              <button onClick={() => onActivate(prompt.id)} className="flex-1 sm:flex-none text-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1 rounded transition font-medium">
                הגדר כפעיל
              </button>
              <button onClick={() => onDelete(prompt)} className="text-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-1 rounded transition font-medium">
                מחק
              </button>
            </>
          )}
        </div>
      </div>
      <div className="bg-gray-50 p-3 rounded border border-gray-100 mb-3">
        <p className="text-gray-600 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{prompt.content}</p>
      </div>
      {prompt.version_notes && (
        <div className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded text-yellow-800 mb-3">
          <span className="font-bold">הערות: </span> {prompt.version_notes}
        </div>
      )}
      <div className="mt-auto border-t border-gray-200/60 pt-3 text-left">
        <button onClick={() => onViewTechnical(prompt.id)} className="text-xs text-blue-600 hover:text-blue-800 underline font-medium focus:outline-none">
          הצג פרומפט טכני (מלא)
        </button>
      </div>
    </div>
  );
};

export default PromptCard;
