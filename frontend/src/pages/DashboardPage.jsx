import React, { useState } from 'react';
import { TrendingUp, FileText, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { downloadAuthenticatedFile } from '../api/client';
import { formatMoney } from '../utils/format';
import DashboardCharts from '../components/dashboard/DashboardCharts';

/**
 * DashboardPage Component
 *
 * Orchestrates financial KPI cards, status/supplier charts, and Excel export.
 * @component
 * @returns {JSX.Element}
 */
export default function DashboardPage() {
  const [scope, setScope] = useState('operational');
  const [downloadError, setDownloadError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const { stats, loading, error, refresh } = useDashboard(scope);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError('');
    try {
      await downloadAuthenticatedFile('/api/excel/download', 'BillingStream_Master.xlsx');
    } catch (err) {
      setDownloadError(err.message || 'שגיאה בהורדת קובץ האקסל');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="animate-spin text-blue-500 w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap gap-4 justify-between items-center bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">דאשבורד פיננסי</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">מבט על לביצועי המערכת וקליטת החשבוניות</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm bg-white flex-1 sm:flex-none"
            aria-label="היקף הנתונים"
          >
            <option value="operational">נתונים תפעוליים בלבד</option>
            <option value="all">כולל בדיקות (סנדבוקס / דמה)</option>
          </select>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm font-medium disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'מוריד...' : 'הורד אקסל מלא'}</span>
          </button>
          <button
            type="button"
            onClick={refresh}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded transition"
            title="רענן נתונים"
            aria-label="רענן נתונים"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {downloadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{downloadError}</div>
      )}

      {scope === 'operational' && stats.excluded_test_documents > 0 && (
        <div className="bg-blue-50 border border-blue-100 text-blue-800 p-3 rounded-lg text-sm">
          {stats.excluded_test_documents} מסמכי בדיקה (העלאה ידנית בסנדבוקס או חילוץ דמה) אינם נכללים בנתונים.
          ניתן להציגם דרך בורר ההיקף.
        </div>
      )}
      {scope === 'all' && (
        <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-3 rounded-lg text-sm">
          תצוגת בדיקה: הנתונים כוללים העלאות סנדבוקס וחילוצי דמה ואינם מייצגים פעילות פיננסית אמיתית.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">סה"כ סכום שטופל (מסמכים תקינים, לפי מטבע)</p>
            {stats.totals_by_currency.length === 0 ? (
              <h3 className="text-3xl font-bold text-gray-800 mt-1">{formatMoney(0, 'ILS')}</h3>
            ) : (
              stats.totals_by_currency.map((total) => (
                <h3 key={total.currency} className="text-3xl font-bold text-gray-800 mt-1" dir="ltr">
                  {formatMoney(total.amount, total.currency)}
                </h3>
              ))
            )}
          </div>
          <div className="bg-green-100 p-3 rounded-full text-green-600">
            <TrendingUp className="w-8 h-8" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">מסמכים שעובדו</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-1">{stats.total_documents}</h3>
          </div>
          <div className="bg-blue-100 p-3 rounded-full text-blue-600">
            <FileText className="w-8 h-8" />
          </div>
        </div>
      </div>

      <DashboardCharts
        statusDistribution={stats.status_distribution}
        topSuppliers={stats.top_suppliers}
        topSuppliersCurrency={stats.top_suppliers_currency}
      />
    </div>
  );
}
