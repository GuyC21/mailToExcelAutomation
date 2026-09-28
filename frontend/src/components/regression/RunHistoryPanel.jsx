import React from 'react';
import { Trash2, GitCompareArrows, Clock } from 'lucide-react';
import ScoreGauge from './ScoreGauge';

const dateFormatter = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Persisted run history (`RegressionRun` rows) with checkboxes to pick two
 * runs for the A/B Comparison view.
 *
 * @param {{
 *   runs: object[], loading: boolean, error: string|null,
 *   selected: number[], onToggleSelect: (id: number) => void,
 *   onDelete: (id: number) => void,
 *   onCompare: () => void, compareLoading: boolean,
 * }} props
 */
export default function RunHistoryPanel({ runs, loading, error, selected, onToggleSelect, onDelete, onCompare, compareLoading }) {
  if (loading) {
    return <p className="text-sm text-gray-500 py-6 text-center">טוען היסטוריית הרצות...</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600 py-6 text-center">{error}</p>;
  }
  if (runs.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">עדיין אין הרצות שמורות. הרץ את הסוויטה כדי להתחיל היסטוריה.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">בחר שתי הרצות כדי להשוות ביניהן (A/B)</p>
        <button
          onClick={onCompare}
          disabled={selected.length !== 2 || compareLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition shadow ${
            selected.length !== 2 || compareLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          <GitCompareArrows className="w-4 h-4" />
          {compareLoading ? 'משווה...' : `השווה נבחרים (${selected.length}/2)`}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="w-full text-right min-w-[720px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="py-2 px-3 font-semibold w-10"></th>
              <th className="py-2 px-3 font-semibold">מועד</th>
              <th className="py-2 px-3 font-semibold">פרומפט</th>
              <th className="py-2 px-3 font-semibold">מנוע</th>
              <th className="py-2 px-3 font-semibold text-center">עברו/סה"כ</th>
              <th className="py-2 px-3 font-semibold text-center">דיוק ממוצע</th>
              <th className="py-2 px-3 font-semibold text-center">כיסוי</th>
              <th className="py-2 px-3 font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(run.id)}
                    onChange={() => onToggleSelect(run.id)}
                    disabled={!selected.includes(run.id) && selected.length >= 2}
                    aria-label={`בחר הרצה #${run.id} להשוואה`}
                  />
                </td>
                <td className="py-2 px-3 text-sm text-gray-700 whitespace-nowrap">
                  #{run.id} · {dateFormatter.format(new Date(run.created_at))}
                </td>
                <td className="py-2 px-3 text-sm text-gray-800">
                  {run.prompt_name || '—'}{run.prompt_is_active && <span className="text-green-600"> (פעיל)</span>}
                </td>
                <td className="py-2 px-3 text-xs text-gray-500">{run.providers?.join(', ') || '—'}</td>
                <td className="py-2 px-3 text-center text-sm">
                  <span className={run.failed > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                    {run.passed}/{run.total}
                  </span>
                </td>
                <td className="py-2 px-3 text-center"><ScoreGauge score={run.average_score} /></td>
                <td className="py-2 px-3 text-center text-sm text-gray-600">{Number(run.coverage).toFixed(0)}%</td>
                <td className="py-2 px-3 text-center">
                  <button
                    onClick={() => onDelete(run.id)}
                    className="text-gray-400 hover:text-red-600 transition"
                    aria-label={`מחק הרצה #${run.id}`}
                    title="מחק הרצה"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
