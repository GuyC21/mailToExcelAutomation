import React, { useState } from 'react';
import { useRegression } from '../hooks/useRegression';
import { Play, AlertTriangle, FileText, History } from 'lucide-react';
import CaseCard from '../components/regression/CaseCard';
import ScoreGauge from '../components/regression/ScoreGauge';
import RunHistoryPanel from '../components/regression/RunHistoryPanel';
import RunCompareView from '../components/regression/RunCompareView';

/**
 * RegressionPage Component
 * 
 * Provides a user interface for running and viewing algorithmic regression tests.
 * This page connects to the backend regression suite via the `useRegression` hook,
 * allowing developers to verify that recent changes haven't degraded extraction
 * accuracy against a known set of ground-truth documents.
 * 
 * @component
 * @returns {JSX.Element} The rendered Regression page.
 */
export default function RegressionPage() {
  const {
    report, loading, error, runSuite, prompts,
    history, historyLoading, historyError, deleteRun,
    comparison, compareLoading, compareError, compareRuns, clearComparison,
  } = useRegression();
  const [promptId, setPromptId] = useState('');
  const [tab, setTab] = useState('run'); // 'run' | 'history'
  const [selectedRuns, setSelectedRuns] = useState([]);
  const summary = report?.summary;
  const results = report?.results || [];

  const toggleSelectRun = (id) => {
    setSelectedRuns((current) => (current.includes(id) ? current.filter((x) => x !== id)
      : current.length >= 2 ? current : [...current, id]));
  };

  const handleCompare = () => {
    if (selectedRuns.length === 2) compareRuns(selectedRuns[0], selectedRuns[1]);
  };

  const handleDeleteRun = async (id) => {
    await deleteRun(id);
    setSelectedRuns((current) => current.filter((x) => x !== id));
  };

  return (
    <div className="w-full space-y-6">
      <header className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">בדיקות רגרסיה (Regression)</h1>
          <p className="text-gray-500 mt-1">הרצת בדיקות אלגוריתמיות מול Ground Truth</p>
        </div>
        {tab === 'run' && (
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
        <select
          value={promptId}
          onChange={(e) => setPromptId(e.target.value)}
          disabled={loading}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white min-w-0 sm:max-w-xs"
          aria-label="פרומפט לבדיקה"
        >
          <option value="">הפרומפט הפעיל</option>
          {prompts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.is_active ? ' (פעיל)' : ''} · #{p.id}
            </option>
          ))}
        </select>
        <button 
          onClick={() => runSuite(promptId ? Number(promptId) : null)}
          disabled={loading}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white transition shadow ${
            loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              מריץ טסטים...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              הרץ חבילת רגרסיה
            </>
          )}
        </button>
        </div>
        )}
      </header>

      <div className="flex gap-1 bg-white p-1 rounded-lg shadow-sm border border-gray-100 w-fit">
        <button
          onClick={() => setTab('run')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition ${
            tab === 'run' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Play className="w-4 h-4" /> הרצה נוכחית
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition ${
            tab === 'history' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <History className="w-4 h-4" /> היסטוריה והשוואת A/B
          {history.length > 0 && (
            <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-1.5 py-0.5">{history.length}</span>
          )}
        </button>
      </div>

      {tab === 'run' && error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 shadow-sm border border-red-100">
          <AlertTriangle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {tab === 'run' && report && summary && (
        <div className="space-y-6">
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
            <span>פרומפט: <b className="text-gray-800">{report.prompt?.name || '—'}</b>{report.prompt?.is_active === false && ' (לא פעיל – בדיקה מקדימה)'}</span>
            {report.providers?.length > 0 && <span>מנוע: {report.providers.join(', ')}</span>}
            <span>סף מעבר: {report.pass_threshold}%</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 text-center col-span-2 md:col-span-1">
              <p className="text-sm text-gray-500 font-medium">כיסוי חילוץ</p>
              <ScoreGauge score={summary.coverage} />
              <p className="text-xs text-gray-500 mt-1">
                {summary.scored}/{summary.total} חולצו · דיוק על המחולצים {Number(summary.scored_average_score).toFixed(1)}%
              </p>
            </div>
          </div>

          {report.warnings?.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-3 rounded-lg text-sm space-y-1">
              {report.warnings.map((warning, idx) => <p key={idx}>{warning}</p>)}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800">פירוט מסמכים</h3>
            {results.length === 0 && (
              <p className="text-sm text-gray-500">חבילת הרגרסיה ריקה – הוסף תיקים במסך התיוג.</p>
            )}
            {results.map((testCase) => (
              <CaseCard key={testCase.name} testCase={testCase} />
            ))}
          </div>
        </div>
      )}
      
      {tab === 'run' && !report && !loading && !error && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-600">אין נתונים להצגה</h3>
          <p className="text-gray-500 text-sm mt-1">לחץ על כפתור ההרצה כדי להתחיל בדיקת רגרסיה</p>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-6">
          {compareError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 shadow-sm border border-red-100">
              <AlertTriangle className="w-5 h-5" />
              <p>{compareError}</p>
            </div>
          )}

          {comparison && (
            <RunCompareView
              comparison={comparison}
              onClose={() => { clearComparison(); setSelectedRuns([]); }}
            />
          )}

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
