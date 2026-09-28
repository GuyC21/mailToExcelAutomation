import { formatDate, formatMoney, formatNumber } from '../../utils/format';

/**
 * Charge lines as printed on the form; lines with findings are highlighted.
 * @param {{lines: object[], issues: object[], currency: string}} props
 */
const LineItemsTable = ({ lines, issues, currency }) => {
  const safeLines = lines || [];
  const flagged = new Set((issues || []).filter((i) => i.line_number != null).map((i) => i.line_number));
  if (!safeLines.length) return <p className="text-gray-500 text-sm">לא זוהו שורות חיוב.</p>;

  return (
    <div className="overflow-x-auto border border-gray-100 rounded">
      <table className="w-full text-right text-sm min-w-[560px]">
        <thead>
          <tr className="bg-gray-50 text-gray-600">
            <th className="p-2 font-medium w-10">#</th>
            <th className="p-2 font-medium w-24">תאריך</th>
            <th className="p-2 font-medium">תיאור</th>
            <th className="p-2 font-medium w-20">כמות</th>
            <th className="p-2 font-medium w-28">מחיר יחידה</th>
            <th className="p-2 font-medium w-28">סה"כ שורה</th>
          </tr>
        </thead>
        <tbody>
          {safeLines.map((line, idx) => (
            <tr key={line.line_number ?? idx} className={`border-t border-gray-100 ${flagged.has(line.line_number) ? 'bg-amber-50' : ''}`}>
              <td className="p-2 text-gray-500">{flagged.has(line.line_number) ? '⚠️' : line.line_number}</td>
              <td className="p-2 whitespace-nowrap">{formatDate(line.service_date)}</td>
              <td className="p-2 text-gray-800">{line.description}</td>
              <td className="p-2 font-mono">{formatNumber(line.quantity)}</td>
              <td className="p-2 font-mono whitespace-nowrap">{formatMoney(line.unit_price, currency)}</td>
              <td className="p-2 font-mono whitespace-nowrap font-medium">{formatMoney(line.line_total, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LineItemsTable;
