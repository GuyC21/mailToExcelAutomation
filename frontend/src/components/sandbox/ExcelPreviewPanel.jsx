import { formatDate } from '../../utils/format';

const COLUMNS = ['מזהה קליטה', 'תאריך קליטה', 'סטטוס', 'ערוץ', 'ספק', 'מספר מסמך', 'תאריך מסמך', 'סה"כ לתשלום'];
const STATUS_COLORS = { 'תקין': 'text-green-700', 'דורש בדיקה': 'text-amber-700', 'חילוץ נכשל': 'text-red-700' };
const COUNT_CHIPS = [
  { code: 'VALID', label: 'תקינים', className: 'bg-green-50 text-green-800' },
  { code: 'NEEDS_REVIEW', label: 'לבדיקה', className: 'bg-amber-50 text-amber-800' },
  { code: 'EXTRACTION_FAILED', label: 'נכשלו', className: 'bg-red-50 text-red-800' },
];

const display = (header, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (header.includes('תאריך')) return formatDate(value);
  if (typeof value === 'number' && header.includes('סה"כ')) return value.toLocaleString('he-IL', { minimumFractionDigits: 2 });
  return value;
};

/**
 * Latest rows of the master workbook, so testers see Excel update live.
 * @param {{preview: object|null, isLoading: boolean, error?: string, downloadUrl: string,
 *   highlightIds: number[], onRefresh: () => void}} props
 */
const ExcelPreviewPanel = ({ preview, isLoading, error, downloadUrl, highlightIds, onRefresh }) => {
  const indexes = preview ? COLUMNS.map((c) => preview.headers.indexOf(c)) : [];

  return (
    <section className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-800">📊 קובץ האקסל המרכזי (מקור האמת)</h2>
          <p className="text-xs text-gray-500">
            {preview ? `${preview.total} מסמכים · עודכן ${formatDate(preview.updated_at)}` : 'טוען...'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {preview && COUNT_CHIPS.map((c) => (
            <span key={c.code} className={`text-xs font-medium px-2 py-1 rounded ${c.className}`}>{c.label}: {preview.counts[c.code] ?? 0}</span>
          ))}
          <button type="button" onClick={onRefresh} disabled={isLoading} className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50">רענן</button>
          <a href={downloadUrl} className="text-sm px-3 py-1.5 rounded bg-green-700 text-white hover:bg-green-800">⬇ הורד Excel</a>
        </div>
      </div>
      {error && <p className="p-4 text-sm text-red-700">{error}</p>}
      {preview && preview.rows.length === 0 && <p className="p-6 text-center text-sm text-gray-500">הקובץ עדיין ריק – שלח מייל או העלה טופס.</p>}
      {preview && preview.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm min-w-[720px]">
            <thead><tr className="bg-slate-800 text-white">{COLUMNS.map((c) => <th key={c} className="p-2 font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row[0]} className={`border-t border-gray-100 ${highlightIds.includes(row[0]) ? 'bg-blue-50 font-medium' : ''}`}>
                  {indexes.map((i, k) => (
                    <td key={COLUMNS[k]} className={`p-2 whitespace-nowrap ${STATUS_COLORS[row[i]] || ''}`}>{i >= 0 ? display(COLUMNS[k], row[i]) : '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ExcelPreviewPanel;
