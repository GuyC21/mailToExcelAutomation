import { Plus, Trash2 } from 'lucide-react';

const EMPTY_LINE = { service_date: '', description: '', quantity: '', unit_price: '', line_total: '' };

/**
 * Editable line-items table for manual ground-truth transcription. Rows are
 * plain controlled inputs (not `LineItemsTable`, the read-only Sandbox
 * counterpart) since every cell here must be typed in by hand.
 * @param {{lines: object[], onChange: (lines: object[]) => void}} props
 */
const LineItemsEditor = ({ lines, onChange }) => {
  const update = (idx, field, value) => {
    onChange(lines.map((line, i) => (i === idx ? { ...line, [field]: value } : line)));
  };
  const addLine = () => onChange([...lines, { ...EMPTY_LINE }]);
  const removeLine = (idx) => onChange(lines.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-gray-700">שורות חיוב (Line Items)</h3>
        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <Plus className="w-4 h-4" /> הוסף שורה
        </button>
      </div>

      {!lines.length ? (
        <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded p-4 text-center">
          אין עדיין שורות חיוב – לחץ "הוסף שורה"
        </p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="w-full text-right text-sm min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="p-2 font-medium w-10">#</th>
                <th className="p-2 font-medium w-32">תאריך</th>
                <th className="p-2 font-medium">תיאור</th>
                <th className="p-2 font-medium w-24">כמות</th>
                <th className="p-2 font-medium w-28">מחיר יחידה</th>
                <th className="p-2 font-medium w-28">סה"כ שורה</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                // Rows have no stable id in this editor (order == line_number,
                // assigned on submit), so the index is an acceptable React key here.
                <tr key={idx} className="border-t border-gray-100">
                  <td className="p-1 text-gray-500 text-center">{idx + 1}</td>
                  <td className="p-1">
                    <input type="date" dir="ltr" value={line.service_date || ''}
                          onChange={(e) => update(idx, 'service_date', e.target.value)}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs" />
                  </td>
                  <td className="p-1">
                    <input type="text" value={line.description || ''}
                          onChange={(e) => update(idx, 'description', e.target.value)}
                          className="w-full border border-gray-200 rounded px-1.5 py-1" />
                  </td>
                  <td className="p-1">
                    <input type="number" step="any" dir="ltr" value={line.quantity ?? ''}
                          onChange={(e) => update(idx, 'quantity', e.target.value)}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 font-mono" />
                  </td>
                  <td className="p-1">
                    <input type="number" step="any" dir="ltr" value={line.unit_price ?? ''}
                          onChange={(e) => update(idx, 'unit_price', e.target.value)}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 font-mono" />
                  </td>
                  <td className="p-1">
                    <input type="number" step="any" dir="ltr" value={line.line_total ?? ''}
                          onChange={(e) => update(idx, 'line_total', e.target.value)}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 font-mono" />
                  </td>
                  <td className="p-1 text-center">
                    <button type="button" onClick={() => removeLine(idx)} className="text-gray-300 hover:text-red-500" title="מחק שורה">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LineItemsEditor;
