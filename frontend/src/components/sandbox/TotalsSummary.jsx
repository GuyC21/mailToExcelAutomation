import { formatMoney } from '../../utils/format';

/**
 * Subtotal / VAT / total block; amounts with a finding are marked.
 * @param {{data: object, issues: object[]}} props
 */
const TotalsSummary = ({ data, issues }) => {
  const flaggedFields = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.field));
  const rows = [
    { field: 'subtotal', label: 'סה"כ לפני מע"מ', value: data.subtotal },
    { field: 'vat_amount', label: `מע"מ${data.vat_rate != null ? ` (${data.vat_rate}%)` : ''}`, value: data.vat_amount },
  ];

  return (
    <div className="flex justify-end">
      <div className="w-full sm:w-80 bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-2">
        {rows.map((row) => (
          <div key={row.field} className="flex justify-between gap-6 text-sm text-gray-600">
            <span>{flaggedFields.has(row.field) && '⚠️ '}{row.label}</span>
            <span className="font-mono">{formatMoney(row.value, data.currency)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-6 font-bold text-lg text-blue-900 pt-2 border-t border-gray-200">
          <span>{flaggedFields.has('total_amount') && '⚠️ '}סה"כ לתשלום</span>
          <span className="font-mono">{formatMoney(data.total_amount, data.currency)}</span>
        </div>
      </div>
    </div>
  );
};

export default TotalsSummary;
