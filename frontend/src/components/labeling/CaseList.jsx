import { FileText, Plus, Trash2 } from 'lucide-react';

/**
 * Sidebar list of labeled regression-suite cases, with actions to start a
 * new one, open an existing one for editing, or delete one.
 * @param {{cases: object[], selectedName: string|null, onSelect: (name: string) => void,
 *   onNew: () => void, onDelete: (name: string) => void}} props
 */
const CaseList = ({ cases, selectedName, onSelect, onNew, onDelete }) => (
  <div className="bg-white rounded-lg shadow border border-gray-100 flex flex-col max-h-[420px] lg:max-h-[700px]">
    <div className="p-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
      <h2 className="font-semibold text-gray-800">תיקים מתויגים ({cases.length})</h2>
      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition"
      >
        <Plus className="w-4 h-4" /> חדש
      </button>
    </div>
    <div className="overflow-y-auto divide-y divide-gray-100">
      {!cases.length ? (
        <p className="p-4 text-sm text-gray-400 text-center">עדיין לא נוספו תיקים לחבילת הרגרסיה</p>
      ) : (
        cases.map((c) => (
          <div
            key={c.name}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(c.name)}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(c.name)}
            className={`p-3 flex items-center justify-between gap-2 cursor-pointer transition ${
              selectedName === c.name ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.expected?.supplier_name || c.document_filename}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(c.name); }}
              className="text-gray-300 hover:text-red-500 flex-shrink-0"
              title="מחק תיק"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
    </div>
  </div>
);

export default CaseList;
