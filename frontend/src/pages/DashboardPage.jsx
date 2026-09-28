import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import { TrendingUp, FileText, AlertCircle, RefreshCw } from 'lucide-react';

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const { stats, loading, error, refresh } = useDashboard();

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
      <header className="flex justify-between items-center bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">דאשבורד פיננסי</h1>
          <p className="text-gray-500 mt-1">מבט על לביצועי המערכת וקליטת החשבוניות</p>
        </div>
        <button 
          onClick={refresh}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded transition"
          title="רענן נתונים"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">סה"כ סכום שטופל</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-1">
              ₪{stats.total_amount_processed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4">ספקים מובילים (לפי סכום)</h3>
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
                <Tooltip formatter={(value) => `₪${value.toLocaleString()}`} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
