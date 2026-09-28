import React from 'react';
import { X, ArrowUp, ArrowDown, Minus, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import ScoreGauge from './ScoreGauge';

const dateFormatter = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' });

/** Small +N.N / -N.N badge; green when positive, red when negative, gray at 0. */
function Delta({ value, suffix = '' }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return <span className="text-gray-400">—</span>;
  const n = Number(value);
  const color = n > 0 ? 'text-green-600' : n < 0 ? 'text-red-600' : 'text-gray-400';
  const Icon = n > 0 ? ArrowUp : n < 0 ? ArrowDown : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {n > 0 ? '+' : ''}{n.toFixed(1)}{suffix}
    </span>
  );
}

function RunSummaryCard({ run, label }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
      <p className="text-xs font-bold text-gray-400 uppercase">{label}</p>
      <p className="font-semibold text-gray-800 mt-1">{run.prompt_name || '—'}{run.prompt_is_active && ' (פעיל)'}</p>
      <p className="text-xs text-gray-500">#{run.id} · {dateFormatter.format(new Date(run.created_at))}</p>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <p className="text-xs text-gray-400">עברו</p>
          <p className="font-bold text-gray-800">{run.passed}/{run.total}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">דיוק ממוצע</p>
          <ScoreGauge score={run.average_score} />
        </div>
        <div>
          <p className="text-xs text-gray-400">כיסוי</p>
          <p className="font-bold text-gray-800">{Number(run.coverage).toFixed(0)}%</p>
        </div>
      </div>
    </div>
  );
}

const STATUS_META = {
  improved: { label: 'השתפר', icon: CheckCircle, className: 'text-green-600 bg-green-50 border-green-100' },
  regressed: { label: 'הידרדר', icon: AlertTriangle, className: 'text-red-600 bg-red-50 border-red-100' },
  unchanged: { label: 'ללא שינוי', icon: Minus, className: 'text-gray-500 bg-gray-50 border-gray-100' },
  only_a: { label: 'רק ב-A', icon: HelpCircle, className: 'text-amber-600 bg-amber-50 border-amber-100' },
  only_b: { label: 'רק ב-B', icon: HelpCircle, className: 'text-amber-600 bg-amber-50 border-amber-100' },
};

function CaseSideCell({ side }) {
  if (!side) return <span className="text-gray-300">—</span>;
  return (
    <div className="flex flex-col items-center">
      <span className={side.passed ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
        {side.score !== null && side.score !== undefined ? `${Number(side.score).toFixed(1)}%` : '—'}
      </span>
      {side.critical_failures?.length > 0 && (
        <span className="text-[10px] text-red-500">{side.critical_failures.join(', ')}</span>
      )}
      {side.error && <span className="text-[10px] text-red-500">{side.error}</span>}
    </div>
  );
}

/**
 * Side-by-side A/B comparison of two persisted regression runs: headline
 * metric deltas plus a per-case table (matched by case name).
 * `comparison` is the API's `GET /api/regression/runs/compare` response.
 * @param {{comparison: object, onClose: () => void}} props
 */
export default function RunCompareView({ comparison, onClose }) {
  const { run_a: runA, run_b: runB, cases, summary_delta: delta } = comparison;

  return (
    <div className="space-y-4 bg-indigo-50/40 border border-indigo-100 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-indigo-900">השוואת A/B</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="סגור השוואה">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RunSummaryCard run={runA} label="הרצה A (בסיס)" />
        <RunSummaryCard run={runB} label="הרצה B (מועמד)" />
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="text-gray-500">שינוי מ-A ל-B:</span>
        <span>דיוק ממוצע <Delta value={delta.average_score} suffix="%" /></span>
        <span>דיוק על המחולצים <Delta value={delta.scored_average_score} suffix="%" /></span>
        <span>כיסוי <Delta value={delta.coverage} suffix="%" /></span>
        <span>מקרים שעברו <Delta value={delta.passed} /></span>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="w-full text-right min-w-[560px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="py-2 px-3 font-semibold">תיק</th>
              <th className="py-2 px-3 font-semibold text-center">A</th>
              <th className="py-2 px-3 font-semibold text-center">B</th>
              <th className="py-2 px-3 font-semibold text-center">שינוי בציון</th>
              <th className="py-2 px-3 font-semibold text-center">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const meta = STATUS_META[c.status];
              const Icon = meta.icon;
              return (
                <tr key={c.name} className="border-t border-gray-100">
                  <td className="py-2 px-3 text-sm font-medium text-gray-700">{c.name}</td>
                  <td className="py-2 px-3"><CaseSideCell side={c.a} /></td>
                  <td className="py-2 px-3"><CaseSideCell side={c.b} /></td>
                  <td className="py-2 px-3 text-center"><Delta value={c.score_delta} suffix="%" /></td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${meta.className}`}>
                      <Icon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
