import React from 'react';
import ScoreGauge from './ScoreGauge';

/**
 * RegressionSummaryCards Component
 *
 * Displays headline accuracy, coverage, and pass/fail metrics for a regression report.
 * @component
 * @param {{ summary: object }} props - Summary metrics dictionary from RegressionReport.
 * @returns {JSX.Element}
 */
export default function RegressionSummaryCards({ summary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
      <div className="bg-white p-4 rounded-lg shadow border border-gray-100 text-center">
        <p className="text-sm text-gray-500 font-medium">סה"כ טסטים</p>
        <p className="text-3xl font-bold text-gray-800 mt-1">{summary.total}</p>
      </div>
      <div className="bg-green-50 p-4 rounded-lg shadow border border-green-100 text-center">
        <p className="text-sm text-green-600 font-medium">עברו</p>
        <p className="text-3xl font-bold text-green-700 mt-1">{summary.passed}</p>
      </div>
      <div className="bg-red-50 p-4 rounded-lg shadow border border-red-100 text-center">
        <p className="text-sm text-red-600 font-medium">נכשלו</p>
        <p className="text-3xl font-bold text-red-700 mt-1">{summary.failed}</p>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg shadow border border-blue-100 text-center">
        <p className="text-sm text-blue-600 font-medium">דיוק ממוצע (כל המקרים)</p>
        <ScoreGauge score={summary.average_score} />
        <p className="text-xs text-gray-500 mt-1">חילוץ שנכשל נספר כ-0</p>
      </div>
      <div className="bg-white p-4 rounded-lg shadow border border-gray-100 text-center sm:col-span-2 md:col-span-1">
        <p className="text-sm text-gray-500 font-medium">כיסוי חילוץ</p>
        <ScoreGauge score={summary.coverage} />
        <p className="text-xs text-gray-500 mt-1">
          {summary.scored}/{summary.total} חולצו · דיוק על המחולצים {Number(summary.scored_average_score).toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
