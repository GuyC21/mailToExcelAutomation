import { useState } from 'react';
import FormField from './FormField';
import LineItemsEditor from './LineItemsEditor';
import FilePicker from '../sandbox/FilePicker';
import ValidationIssues from '../sandbox/ValidationIssues';
import { slugifyCaseName } from '../../hooks/useRegressionCases';
import { toFormState, toPayload } from '../../utils/extractionFormMapper';

/**
 * The תיוג (labeling) form: transcribe one document's fields by hand to
 * create a new regression ground-truth case, or correct an existing one.
 * @component
 * @param {{
 *   caseName: string,
 *   onCaseNameChange: (name: string) => void,
 *   isNewCase: boolean,
 *   initialExpected: object|null,
 *   onFileSelected: (file: File|null) => void,
 *   onSubmit: (file: File|null, expected: object) => void,
 *   isSaving: boolean,
 *   warnings: object[],
 *   saveError: string|null,
 * }} props
 * @returns {JSX.Element}
 */
const LabelForm = ({
  caseName,
  onCaseNameChange,
  isNewCase,
  initialExpected,
  onFileSelected,
  onSubmit,
  isSaving,
  warnings,
  saveError,
}) => {
  const [fields, setFields] = useState(() => toFormState(initialExpected));
  const [file, setFile] = useState(null);
  const [nameTouched, setNameTouched] = useState(Boolean(initialExpected));

  const setField = (key) => (value) => setFields((prev) => ({ ...prev, [key]: value }));

  const handleFile = (selected) => {
    const picked = selected[0] || null;
    setFile(picked);
    onFileSelected(picked);
    if (picked && isNewCase && !nameTouched) {
      onCaseNameChange(slugifyCaseName(picked.name.replace(/\.[^.]+$/, '')));
    }
  };

  const canSubmit = caseName.trim().length > 0 && (Boolean(file) || !isNewCase);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="שם הקובץ באנגלית"
          value={caseName}
          onChange={(value) => {
            setNameTouched(true);
            onCaseNameChange(slugifyCaseName(value));
          }}
          placeholder="shl_valid"
          required
          className={isNewCase ? '' : 'opacity-60 pointer-events-none'}
        />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            קובץ מקור {isNewCase && <span className="text-red-500">*</span>}
          </label>
          <FilePicker
            files={file ? [file] : []}
            onChange={handleFile}
            accept=".pdf,image/*"
            placeholder={isNewCase ? 'לחץ לבחירת PDF או תמונה' : 'השאר ריק כדי לשמור את הקובץ הקיים'}
            icon="📄"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">פרטי מסמך</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField label="שם ספק" value={fields.supplier_name} onChange={setField('supplier_name')} required />
          <FormField label="ח.פ / עוסק מורשה" value={fields.supplier_tax_id} onChange={setField('supplier_tax_id')} />
          <FormField label="מספר מסמך" value={fields.document_number} onChange={setField('document_number')} />
          <FormField label="תאריך מסמך" type="date" value={fields.document_date} onChange={setField('document_date')} />
          <FormField label="תחילת תקופת חיוב" type="date" value={fields.billing_period_start} onChange={setField('billing_period_start')} />
          <FormField label="סוף תקופת חיוב" type="date" value={fields.billing_period_end} onChange={setField('billing_period_end')} />
          <FormField label="תאריך פירעון" type="date" value={fields.due_date} onChange={setField('due_date')} />
          <FormField label="סוג מסמך" value={fields.document_type} onChange={setField('document_type')} placeholder="טופס התחשבנות" />
          <FormField label="שם לקוח" value={fields.customer_name} onChange={setField('customer_name')} placeholder="BillingStream" />
          <FormField label="מטבע" value={fields.currency} onChange={setField('currency')} placeholder="ILS" />
          <FormField label="תנאי תשלום" value={fields.payment_terms} onChange={setField('payment_terms')} placeholder="שוטף + 30" />
        </div>
      </div>

      <LineItemsEditor lines={fields.line_items} onChange={(line_items) => setFields((prev) => ({ ...prev, line_items }))} />

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">סיכום כספי</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <FormField label='סה"כ לפני מע"מ' type="number" value={fields.subtotal} onChange={setField('subtotal')} />
          <FormField label='אחוז מע"מ' type="number" value={fields.vat_rate} onChange={setField('vat_rate')} placeholder="17" />
          <FormField label='סכום מע"מ' type="number" value={fields.vat_amount} onChange={setField('vat_amount')} />
          <FormField label='סה"כ לתשלום' type="number" value={fields.total_amount} onChange={setField('total_amount')} />
        </div>
      </div>

      {saveError && <div className="p-3 bg-red-50 border-r-4 border-red-500 text-red-800 rounded text-sm">{saveError}</div>}
      {warnings?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2">בדיקות חישוב על התיוג (לא חוסמות שמירה)</h3>
          <ValidationIssues issues={warnings} />
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSubmit || isSaving}
          onClick={() => onSubmit(file, toPayload(fields))}
          className="bg-blue-600 text-white font-medium py-2.5 px-6 rounded hover:bg-blue-700 transition shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSaving ? 'שומר...' : 'שמור תיוג'}
        </button>
      </div>
    </div>
  );
};

export default LabelForm;
