import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import { apiUrl } from '../api/client';
import { TrendingUp, FileText, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Formats an amount in its own currency (never assumes shekels).
 * Falls back to "<amount> <code>" for codes Intl does not know.
 * @param {number} value
 * @param {string} currency - ISO-like code from the API, e.g. "ILS", "USD".
 */
function formatMoney(value, currency) {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}

/**
 * DashboardPage Component
 * 
 * Renders the main financial dashboard, providing a high-level overview of system 
 * performance and invoice processing metrics. It uses the `useDashboard` hook to 
 * fetch aggregated statistics.
 * 
 * The visual breakdown (KPIs, pie charts for status, bar charts for top suppliers) 
 * helps business users quickly identify bottlenecks or anomalies in the ingestion pipeline.
 * 
 * @component
 * @returns {JSX.Element} The rendered Dashboard page.
 */
export default function DashboardPage() {
  const [scope, setScope] = useState('operational');
  const { stats, loading, error, refresh } = useDashboard(scope);

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
        <AlertCircle className="w-5 h-5" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap gap-4 justify-between items-center bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">דאשבורד פיננסי</h1>
          <p className="text-gray-500 mt-1">מבט על לביצועי המערכת וקליטת החשבוניות</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
            aria-label="היקף הנתונים"
          >
            <option value="operational">נתונים תפעוליים בלבד</option>
            <option value="all">כולל בדיקות (סנדבוקס / דמה)</option>
          </select>
          <a
            href={apiUrl('/api/excel/download')}
            download
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm font-medium"
          >
            הורד אקסל מלא
          </a>
          <button 
            onClick={refresh}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded transition"
            title="רענן נתונים"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

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

      {/* KPI Cards */}
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
            <h3 className="text-3xl font-bold text-gray-800 mt-1">
              {stats.total_documents}
            </h3>
          </div>
          <div className="bg-blue-100 p-3 rounded-full text-blue-600">
            <FileText className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[400px]">
        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex flex-col h-[300px] lg:h-full">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">התפלגות סטטוסים</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.status_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.status_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Suppliers */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex flex-col h-[300px] lg:h-full">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            ספקים מובילים (לפי סכום{stats.top_suppliers_currency ? `, ${stats.top_suppliers_currency}` : ''})
          </h3>
          <div className="flex-1 min-h-0" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.top_suppliers}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                layout="vertical"
              >
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={140} 
                  tick={{ fontSize: 11, fill: '#4b5563' }} 
                />
                <Tooltip formatter={(value) => formatMoney(value, stats.top_suppliers_currency || 'ILS')} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
