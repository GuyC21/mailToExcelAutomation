import React from 'react';
import { UserCheck } from 'lucide-react';
import StatusBadge from '../sandbox/StatusBadge';
import { formatMoney } from '../../utils/format';

/**
 * DocumentListSidebar Component
 *
 * Renders the scrollable list of ingested documents for human review selection.
 * @component
 * @param {{
 *   documents: object[],
 *   selectedId: number|null,
 *   loading: boolean,
 *   error: string|null,
 *   onSelect: (doc: object) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function DocumentListSidebar({ documents, selectedId, loading, error, onSelect }) {
  return (
    <div className="lg:col-span-3 bg-white border border-gray-200 rounded-lg shadow-sm max-h-[320px] lg:h-[780px] lg:max-h-none overflow-y-auto">
      <div className="p-4 border-b border-gray-100 sticky top-0 bg-white font-medium text-gray-700 z-10">
        מסמכים אחרונים ({documents.length})
      </div>
      {loading ? (
        <div className="p-4 text-center text-gray-500 text-sm">טוען...</div>
      ) : error ? (
        <div className="p-4 text-red-500 text-sm">{error}</div>
      ) : documents.length === 0 ? (
        <div className="p-4 text-center text-gray-500 text-sm">אין מסמכים להצגה</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {documents.map((doc) => (
            <div
              key={doc.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(doc)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(doc);
                }
              }}
              className={`p-4 cursor-pointer hover:bg-blue-50 transition focus:outline-none focus:bg-blue-50 ${
                selectedId === doc.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
              }`}
            >
              <div className="flex justify-between items-start gap-2 mb-1">
                <span className="font-medium text-sm truncate min-w-0">{doc.filename}</span>
                <StatusBadge status={doc.status} />
              </div>
              <div className="text-xs text-gray-500 flex justify-between gap-2">
                <span className="truncate min-w-0">{doc.extracted_data?.supplier_name || 'ספק לא ידוע'}</span>
                <span className="font-mono whitespace-nowrap" dir="ltr">
                  {formatMoney(doc.extracted_data?.total_amount, doc.extracted_data?.currency)}
                </span>
              </div>
              {doc.updated_by && (
                <div className="text-[11px] text-blue-700 mt-1.5 flex items-center gap-1 font-medium">
                  <UserCheck className="w-3 h-3 text-blue-600 flex-shrink-0" />
                  <span className="truncate">{doc.updated_by.full_name || doc.updated_by.email}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
