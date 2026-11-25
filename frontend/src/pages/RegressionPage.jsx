import React, { useState } from 'react';
import { useRegression } from '../hooks/useRegression';
import { Play, AlertTriangle, History } from 'lucide-react';
import RegressionRunTab from '../components/regression/RegressionRunTab';
import RunHistoryPanel from '../components/regression/RunHistoryPanel';
import RunCompareView from '../components/regression/RunCompareView';
import BYOKStatusBadge from '../components/byok/BYOKStatusBadge';

/**
 * RegressionPage Component
 *
 * Orchestrates running the regression suite against any prompt version and
 * browsing persisted Run History / A-B comparisons.
 * @component
 * @returns {JSX.Element}
 */
export default function RegressionPage() {
  const {
    report, loading, error, runSuite, prompts,
    history, historyLoading, historyError, deleteRun,
    comparison, compareLoading, compareError, compareRuns, clearComparison,
  } = useRegression();
  const [promptId, setPromptId] = useState('');
  const [tab, setTab] = useState('run');
  const [selectedRuns, setSelectedRuns] = useState([]);

  const toggleSelectRun = (id) => {
    setSelectedRuns((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : current.length >= 2 ? current : [...current, id],
    );
  };

  const handleCompare = () => {
    if (selectedRuns.length === 2) compareRuns(selectedRuns[0], selectedRuns[1]);
  };

  const handleDeleteRun = async (id) => {
    await deleteRun(id);
    setSelectedRuns((current) => current.filter((x) => x !== id));
  };

  return (
    <div className="w-full max-w-full overflow-hidden space-y-[1.25rem]">
      <header className="bg-white p-[1rem] sm:p-[1.25rem] md:p-[1.5rem] rounded-xl shadow-xs border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-[0.75rem]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[0.5rem] w-full md:w-auto min-w-0">
          <div>
            <h1 className="text-[clamp(1.15rem,3.8vw,1.75rem)] font-bold text-blue-900 leading-snug">
              בדיקות רגרסיה (Regression)
            </h1>
            <p className="text-gray-500 mt-[0.25rem] text-[clamp(0.75rem,2.2vw,0.875rem)]">
              הרצת בדיקות אלגוריתמיות מול Ground Truth
            </p>
          </div>
          <div className="md:hidden self-start"><BYOKStatusBadge /></div>
        </div>
        {tab === 'run' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[0.5rem] w-full md:w-auto">
            <div className="hidden md:block ml-[0.5rem]"><BYOKStatusBadge /></div>
            <select
              value={promptId}
              onChange={(e) => setPromptId(e.target.value)}
              disabled={loading}
              className="border border-gray-300 rounded-lg px-[0.75rem] py-[0.5rem] text-[0.875rem] bg-white min-w-0 w-full sm:w-auto sm:max-w-xs"
              aria-label="פרומפט לבדיקה"
            >
              <option value="">הפרומפט הפעיל</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.is_active ? ' (פעיל)' : ''} · #{p.id}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => runSuite(promptId ? Number(promptId) : null)}
              disabled={loading}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-white transition shadow ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />מריץ טסטים...</>
              ) : (
                <><Play className="w-5 h-5" />הרץ חבילת רגרסיה</>
              )}
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-1 bg-white p-1 rounded-lg shadow-sm border border-gray-100 w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setTab('run')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition ${
            tab === 'run' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Play className="w-4 h-4" /> הרצה נוכחית
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition ${
            tab === 'history' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <History className="w-4 h-4" /> היסטוריה והשוואת A/B
          {history.length > 0 && <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-1.5 py-0.5">{history.length}</span>}
        </button>
      </div>

      {tab === 'run' && <RegressionRunTab report={report} loading={loading} error={error} />}

      {tab === 'history' && (
        <div className="space-y-6">
          {compareError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 shadow-sm border border-red-100">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" /><p>{compareError}</p>
            </div>
          )}
          {comparison && <RunCompareView comparison={comparison} onClose={() => { clearComparison(); setSelectedRuns([]); }} />}
          <RunHistoryPanel
            runs={history}
            loading={historyLoading}
            error={historyError}
            selected={selectedRuns}
            onToggleSelect={toggleSelectRun}
            onDelete={handleDeleteRun}
            onCompare={handleCompare}
            compareLoading={compareLoading}
          />
        </div>
      )}
    </div>
  );
}
