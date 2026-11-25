import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import ScoreGauge from './ScoreGauge';
import FieldRow from './FieldRow';

/** File name from a server path (either separator). */
const baseName = (path) => (path || '').split(/[\\/]/).pop();

/**
 * One regression case: pass/fail status, aggregate score, and expandable field breakdown.
 * @component
 * @param {{ testCase: object }} props - Single TestCaseResult from the regression API.
 * @returns {JSX.Element}
 */
export default function CaseCard({ testCase }) {
  const [expanded, setExpanded] = useState(false);
  const scoreData = testCase.score;
  const criticalFailures = testCase.critical_failures || [];
  const fieldResults = scoreData?.field_results || [];
  const lineComparisons = scoreData?.line_item_comparisons || [];

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition focus:outline-none focus:bg-gray-50"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {testCase.passed ? (
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 truncate">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{testCase.name}</span>
            </h3>
            <p className="text-xs text-gray-500 truncate">
              Document: {baseName(testCase.document_path)}
              {testCase.provider && ` · ${testCase.provider}${testCase.model ? `/${testCase.model}` : ''}`}
            </p>
            {criticalFailures.length > 0 && (
              <p className="text-xs text-red-600 font-medium mt-0.5 break-words">
                שדות קריטיים שגויים: {criticalFailures.join(', ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase font-semibold">Score</p>
            <ScoreGauge score={scoreData ? scoreData.overall_score : null} />
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {expanded && !scoreData && (
        <div className="p-4 bg-red-50 border-t border-red-100 text-sm text-red-700">
          החילוץ נכשל ולכן אין ציון: {testCase.error || 'שגיאה לא ידועה'}
        </div>
      )}

      {expanded && scoreData && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <h4 className="text-sm font-bold text-gray-700 mb-2">שדות כלליים (Header)</h4>
          <div className="bg-white rounded border border-gray-200 overflow-x-auto mb-6">
            <table className="w-full text-right min-w-[520px]">
              <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="py-2 px-3 font-semibold">שדה</th>
                  <th className="py-2 px-3 font-semibold">מצופה (Expected)</th>
                  <th className="py-2 px-3 font-semibold">בפועל (Actual)</th>
                  <th className="py-2 px-3 font-semibold text-center">התאמה</th>
                  <th className="py-2 px-3 font-semibold text-left">ציון</th>
                </tr>
              </thead>
              <tbody>
                {fieldResults.map((comp, idx) => (
                  <FieldRow key={idx} field={comp} />
                ))}
              </tbody>
            </table>
          </div>

          {lineComparisons.length > 0 && (
            <>
              <h4 className="text-sm font-bold text-gray-700 mb-2">שורות פירוט (Line Items)</h4>
              <div className="space-y-4">
                {lineComparisons.map((line, idx) => (
                  <div key={idx} className="bg-white rounded border border-gray-200 overflow-x-auto">
                    <div className="bg-gray-100 py-1 px-3 text-xs font-semibold text-gray-600 flex justify-between min-w-[500px]">
                      <span>שורה {idx + 1} - סטטוס: {line.status}</span>
                      <span>ציון: {(line.score * 100).toFixed(0)}%</span>
                    </div>
                    <table className="w-full text-right min-w-[500px]">
                      <tbody>
                        {line.fields && line.fields.map((comp, fIdx) => (
                          <FieldRow key={fIdx} field={comp} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
