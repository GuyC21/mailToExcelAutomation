import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Trash2, UserCheck, Bot } from 'lucide-react';
import FormField from '../labeling/FormField';
import LineItemsEditor from '../labeling/LineItemsEditor';
import ValidationIssues from '../sandbox/ValidationIssues';
import { toFormState, toPayload } from '../../utils/extractionFormMapper';
import { formatDateTime } from '../../utils/format';

/**
 * ReviewEditorForm Component
 *
 * Keyed by `doc.id` so local controlled form state initializes cleanly per document.
 * Allows operators to inspect/edit all header fields and line items and record
 * reviewer attribution while syncing changes to PostgreSQL and Excel.
 *
 * @component
 * @param {{
 *   doc: object,
 *   saveStatus: { type: string, message?: string }|null,
 *   onSave: (extractedData: object, status: string) => Promise<void>,
 *   onRequestDelete: () => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function ReviewEditorForm({ doc, saveStatus, onSave, onRequestDelete }) {
  const [fields, setFields] = useState(() => toFormState(doc.extracted_data));

  const setField = (key) => (value) => setFields((prev) => ({ ...prev, [key]: value }));
  const existingNotes = doc.extracted_data?.extraction_notes || [];

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800">עריכת נתונים</h2>
        <button
          type="button"
          onClick={onRequestDelete}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
          title="מחק מסמך"
          aria-label="מחק מסמך"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {doc.updated_by ? (
        <div className="bg-blue-50/80 border border-blue-200/90 rounded-lg p-3 text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1 bg-blue-100 rounded-full text-blue-700 flex-shrink-0">
              <UserCheck className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <span className="text-gray-500">נערך ע״י: </span>
              <span className="font-semibold text-blue-900">{doc.updated_by.full_name || doc.updated_by.email}</span>
              {doc.updated_by.full_name && doc.updated_by.email && (
                <span className="text-gray-400 text-[11px] block sm:inline sm:mr-1 truncate">({doc.updated_by.email})</span>
              )}
            </div>
          </div>
          {doc.updated_at && (
            <span className="text-blue-700 font-mono text-[11px] self-end sm:self-auto bg-blue-100/60 px-2 py-0.5 rounded whitespace-nowrap">
              {formatDateTime(doc.updated_at)}
            </span>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-500 flex items-center gap-2">
          <Bot className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span>קליטה אוטומטית (טרם נערך ידנית)</span>
        </div>
      )}

      <ValidationIssues issues={doc.issues || []} error={doc.error} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="ספק" value={fields.supplier_name} onChange={setField('supplier_name')} className="sm:col-span-2" />
        <FormField label="ח.פ / עוסק מורשה" value={fields.supplier_tax_id} onChange={setField('supplier_tax_id')} />
        <FormField label="מספר מסמך" value={fields.document_number} onChange={setField('document_number')} />
        <FormField label="תאריך מסמך" type="date" value={fields.document_date} onChange={setField('document_date')} />
        <FormField label="מטבע" value={fields.currency} onChange={setField('currency')} placeholder="ILS" />
        <FormField label="תחילת תקופת חיוב" type="date" value={fields.billing_period_start} onChange={setField('billing_period_start')} />
        <FormField label="סוף תקופת חיוב" type="date" value={fields.billing_period_end} onChange={setField('billing_period_end')} />
      </div>

      <LineItemsEditor
        lines={fields.line_items}
        onChange={(line_items) => setFields((prev) => ({ ...prev, line_items }))}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
        <FormField label='לפני מע"מ' type="number" value={fields.subtotal} onChange={setField('subtotal')} />
        <FormField label='אחוז מע"מ' type="number" value={fields.vat_rate} onChange={setField('vat_rate')} />
        <FormField label='סכום מע"מ' type="number" value={fields.vat_amount} onChange={setField('vat_amount')} />
        <FormField label='סה"כ לתשלום' type="number" value={fields.total_amount} onChange={setField('total_amount')} />
      </div>

      {saveStatus?.message && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
            saveStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {saveStatus.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{saveStatus.message}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => onSave(toPayload(fields, existingNotes), 'VALID')}
          disabled={saveStatus?.type === 'loading'}
          className="flex-1 bg-green-600 text-white py-2.5 px-4 rounded-md font-medium hover:bg-green-700 transition disabled:opacity-50"
        >
          שמור כתקין
        </button>
        <button
          type="button"
          onClick={() => onSave(toPayload(fields, existingNotes), 'NEEDS_REVIEW')}
          disabled={saveStatus?.type === 'loading'}
          className="flex-1 bg-yellow-500 text-white py-2.5 px-4 rounded-md font-medium hover:bg-yellow-600 transition disabled:opacity-50"
        >
          השאר לבדיקה
        </button>
      </div>
    </div>
  );
}
