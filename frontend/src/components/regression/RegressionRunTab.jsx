import React from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import CaseCard from './CaseCard';
import RegressionSummaryCards from './RegressionSummaryCards';

/**
 * RegressionRunTab Component
 *
 * Renders the active regression suite execution report, summary metrics,
 * non-blocking warnings, error banner, and empty prompt state.
 * @component
 * @param {{
 *   report: object|null,
 *   loading: boolean,
 *   error: string|null,
 * }} props
 * @returns {JSX.Element}
 */
export default function RegressionRunTab({ report, loading, error }) {
  const summary = report?.summary;
  const results = report?.results || [];

  return (
    <>
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 shadow-sm border border-red-100">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" /><p>{error}</p>
        </div>
      )}

      {report && summary && (
        <div className="space-y-6">
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
            <span>פרומפט: <b className="text-gray-800">{report.prompt?.name || '—'}</b>{report.prompt?.is_active === false && ' (לא פעיל – בדיקה מקדימה)'}</span>
            {report.providers?.length > 0 && <span>מנוע: {report.providers.join(', ')}</span>}
            <span>סף מעבר: {report.pass_threshold}%</span>
          </div>
          <RegressionSummaryCards summary={summary} />
          {report.warnings?.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-3 rounded-lg text-sm space-y-1">
              {report.warnings.map((warning, idx) => <p key={idx}>{warning}</p>)}
            </div>
          )}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800">פירוט מסמכים</h3>
            {results.length === 0 && <p className="text-sm text-gray-500">חבילת הרגרסיה ריקה – הוסף תיקים במסך התיוג.</p>}
            {results.map((testCase) => <CaseCard key={testCase.name} testCase={testCase} />)}
          </div>
        </div>
      )}

      {!report && !loading && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-600">אין נתונים להצגה</h3>
          <p className="text-gray-500 text-sm mt-1">לחץ על כפתור ההרצה כדי להתחיל בדיקת רגרסיה</p>
        </div>
      )}
    </>
  );
}
