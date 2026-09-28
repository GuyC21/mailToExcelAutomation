import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import ScoreGauge from './ScoreGauge';
import FieldRow from './FieldRow';

export default function CaseCard({ testCase }) {
  const [expanded, setExpanded] = useState(false);
  const scoreData = testCase.score;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {testCase.passed ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-red-500" />
          )}
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              {testCase.name}
            </h3>
            <p className="text-xs text-gray-500">Document: {testCase.document_file}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase font-semibold">Score</p>
            <ScoreGauge score={scoreData.score} />
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <h4 className="text-sm font-bold text-gray-700 mb-2">שדות כלליים (Header)</h4>
          <div className="bg-white rounded border border-gray-200 overflow-x-auto mb-6">
            <table className="w-full text-left">
              <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="py-2 px-3 font-semibold">שדה</th>
                  <th className="py-2 px-3 font-semibold">מצופה (Expected)</th>
                  <th className="py-2 px-3 font-semibold">בפועל (Actual)</th>
                  <th className="py-2 px-3 font-semibold text-center">התאמה</th>
                  <th className="py-2 px-3 font-semibold text-right">ציון</th>
                </tr>
              </thead>
              <tbody>
                {scoreData.header_comparisons.map((comp, idx) => (
                  <FieldRow key={idx} field={comp} />
                ))}
              </tbody>
            </table>
          </div>

          {scoreData.line_item_comparisons.length > 0 && (
            <>
              <h4 className="text-sm font-bold text-gray-700 mb-2">שורות פירוט (Line Items)</h4>
              <div className="space-y-4">
                {scoreData.line_item_comparisons.map((line, idx) => (
                  <div key={idx} className="bg-white rounded border border-gray-200 overflow-x-auto">
                    <div className="bg-gray-100 py-1 px-3 text-xs font-semibold text-gray-600 flex justify-between min-w-[500px]">
                      <span>שורה {idx + 1} - סטטוס: {line.status}</span>
                      <span>ציון: {(line.score * 100).toFixed(0)}%</span>
                    </div>
                    <table className="w-full text-left min-w-[500px]">
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
