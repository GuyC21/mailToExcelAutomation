import React from 'react';

/**
 * Shows a 0-100 score (the backend's scale) as a percentage.
 * `null`/`undefined` (e.g. an extraction that failed) renders as a dash.
 * @param {{score: number|null|undefined}} props
 */
export default function ScoreGauge({ score }) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return <div className="text-2xl font-bold text-gray-400">—</div>;
  }
  const value = Number(score);
  let color = 'text-red-500';
  if (value >= 90) color = 'text-green-500';
  else if (value >= 70) color = 'text-yellow-500';

  return (
    <div className={`text-2xl font-bold ${color}`}>
      {value.toFixed(1)}%
    </div>
  );
}
