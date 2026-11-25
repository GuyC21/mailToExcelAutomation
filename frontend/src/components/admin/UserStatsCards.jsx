import React from 'react';
import { Users, Clock, CheckCircle } from 'lucide-react';

/**
 * UserStatsCards Component
 *
 * Displays summary KPI counters for total, pending, and approved accounts.
 * @component
 * @param {{ totalCount: number, pendingCount: number, approvedCount: number }} props
 * @returns {JSX.Element}
 */
export default function UserStatsCards({ totalCount, pendingCount, approvedCount }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">סה״כ משתמשים במערכת</div>
          <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
        </div>
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
          <Users className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-amber-700 mb-1">ממתינים לאישור מנהל</div>
          <div className="text-2xl font-bold text-amber-800">{pendingCount}</div>
        </div>
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
          <Clock className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-emerald-700 mb-1">משתמשים פעילים ומאושרים</div>
          <div className="text-2xl font-bold text-emerald-800">{approvedCount}</div>
        </div>
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
          <CheckCircle className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
