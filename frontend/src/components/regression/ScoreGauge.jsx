import React from 'react';

export default function ScoreGauge({ score }) {
  const percentage = (score * 100).toFixed(1);
  let color = 'text-red-500';
  if (score >= 0.9) color = 'text-green-500';
  else if (score >= 0.7) color = 'text-yellow-500';

  return (
    <div className={`text-2xl font-bold ${color}`}>
      {percentage}%
    </div>
  );
}
