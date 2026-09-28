import { useState } from 'react';
import StatusBadge from './StatusBadge';
import LineItemsTable from './LineItemsTable';
import TotalsSummary from './TotalsSummary';
import ValidationIssues from './ValidationIssues';
import { formatDate } from '../../utils/format';

/** @param {{label: string, value?: string}} props */
const Field = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className={`font-semibold break-words ${value ? 'text-gray-900' : 'text-red-600'}`}>{value || 'חסר'}</p>
  </div>
);

/**
 * One processed document: finance-friendly view, with the raw JSON behind a toggle.
 * @param {{result: object}} props - an IngestionResult from the API
 */
const ExtractionResultCard = ({ result }) => {
  const [showTechnical, setShowTechnical] = useState(false);
  if (!result) return null; // defensive: a malformed API response must not crash the page
  const data = result.data;
  const issues = result.issues || [];
  const period = data?.billing_period_start
    ? `${formatDate(data.billing_period_start)} – ${formatDate(data.billing_period_end)}`
    : null;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
      <div className="flex flex-wrap justify-between items-center gap-2 p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={result.status} />
          <h3 className="font-bold text-gray-800 truncate" title={result.filename}>{result.filename}</h3>
        </div>
        {result.status !== 'SKIPPED' && (
          <button type="button" onClick={() => setShowTechnical(!showTechnical)} className="text-sm text-blue-600 hover:text-blue-800 underline">
            {showTechnical ? 'חזרה לתצוגה רגילה' : 'תצוגה טכנית (JSON)'}
          </button>
        )}
      </div>

      {showTechnical ? (
        <pre className="p-4 bg-gray-900 text-green-400 font-mono text-xs leading-relaxed overflow-x-auto max-h-[480px]" dir="ltr">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : (
        <div className="p-4 md:p-6 space-y-6">
          {result.status === 'SKIPPED' ? (
            <p className="text-sm text-gray-600">{result.error}</p>
          ) : (
            <>
              <ValidationIssues issues={issues} error={result.error} />
              {data && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Field label="ספק" value={data.supplier_name} />
                    <Field label="ח.פ / עוסק מורשה" value={data.supplier_tax_id} />
                    <Field label="מספר מסמך" value={data.document_number} />
                    <Field label="תאריך מסמך" value={data.document_date && formatDate(data.document_date)} />
                    <Field label="תקופת חיוב" value={period} />
                    <Field label="תנאי תשלום" value={data.payment_terms} />
                  </div>
                  <LineItemsTable lines={data.line_items} issues={issues} currency={data.currency} />
                  <TotalsSummary data={data} issues={issues} />
                </>
              )}
              <p className="text-xs text-gray-400">
                מנוע: {result.provider}{result.model ? ` / ${result.model}` : ''} · פרומפט: {result.prompt_name}
                {result.excel && (result.excel.written ? ' · ✓ נכתב לאקסל' : ` · ⚠️ ${result.excel.message}`)}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ExtractionResultCard;
