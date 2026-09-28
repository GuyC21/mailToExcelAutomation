import React from 'react';
import { useRegression } from '../hooks/useRegression';
import { Play, AlertTriangle, FileText } from 'lucide-react';
import CaseCard from '../components/regression/CaseCard';
import ScoreGauge from '../components/regression/ScoreGauge';

export default function RegressionPage() {
  const { report, loading, error, runSuite } = useRegression();

  return (
    <div className="w-full space-y-6">
      <header className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">בדיקות רגרסיה (Regression)</h1>
          <p className="text-gray-500 mt-1">הרצת בדיקות אלגוריתמיות מול Ground Truth</p>
        </div>
        <button 
          onClick={runSuite}
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
      </header>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 shadow-sm border border-red-100">
          <AlertTriangle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 text-center">
              <p className="text-sm text-gray-500 font-medium">סה"כ טסטים</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{report.total}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg shadow border border-green-100 text-center">
              <p className="text-sm text-green-600 font-medium">עברו</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{report.passed}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg shadow border border-red-100 text-center">
              <p className="text-sm text-red-600 font-medium">נכשלו</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{report.failed}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg shadow border border-blue-100 text-center">
              <p className="text-sm text-blue-600 font-medium">ממוצע דיוק</p>
              <ScoreGauge score={report.average_score} />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800">פירוט מסמכים</h3>
            {report.cases.map((testCase, idx) => (
              <CaseCard key={idx} testCase={testCase} />
            ))}
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
    </div>
  );
}
