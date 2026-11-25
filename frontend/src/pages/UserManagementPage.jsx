/**
 * User Management and Approval Orchestrator Page (Admin Only).
 */
import React, { useState } from 'react';
import { Shield, RefreshCw, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAdminUsers } from '../hooks/useAdminUsers';
import UserStatsCards from '../components/admin/UserStatsCards';
import UsersTable from '../components/admin/UsersTable';

/**
 * Orchestrates admin user filtering, search, statistics, and status updates.
 * @component
 * @returns {JSX.Element}
 */
export default function UserManagementPage() {
  const { user: currentAuthUser } = useAuth();
  const {
    users,
    isLoading,
    errorMessage,
    actionLoadingId,
    actionError,
    clearActionError,
    fetchUsers,
    updateUserStatus,
  } = useAdminUsers();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter((u) => {
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = users.filter((u) => u.status === 'PENDING').length;
  const approvedCount = users.filter((u) => u.status === 'APPROVED').length;
  const suspendedCount = users.filter((u) => u.status === 'SUSPENDED').length;
  const rejectedCount = users.filter((u) => u.status === 'REJECTED').length;

  const tabs = [
    { id: 'ALL', label: 'הכל', count: users.length },
    { id: 'PENDING', label: 'ממתינים', count: pendingCount },
    { id: 'APPROVED', label: 'מאושרים', count: approvedCount },
    { id: 'SUSPENDED', label: 'מוקפאים', count: suspendedCount },
    { id: 'REJECTED', label: 'נדחו', count: rejectedCount },
  ];

  return (
    <div className="w-full" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">פאנל ניהול אבטחה</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">ניהול משתמשים ואישורי גישה</h1>
          <p className="text-sm text-gray-500 mt-1">אישור, הקפאה, דחייה וניהול הרשאות למשתמשי מערכת BillingStream AI.</p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-700 shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>רענן נתונים</span>
        </button>
      </div>

      <UserStatsCards totalCount={users.length} pendingCount={pendingCount} approvedCount={approvedCount} />

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                clearActionError();
                setStatusFilter(tab.id);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                statusFilter === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                statusFilter === tab.id ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:flex-1 sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש לפי שם או אימייל..."
            aria-label="חיפוש משתמשים לפי שם או אימייל"
            className="w-full px-3.5 py-2 pr-9 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {(errorMessage || actionError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{actionError || errorMessage}</span>
        </div>
      )}

      <UsersTable
        users={filteredUsers}
        isLoading={isLoading}
        currentUserId={currentAuthUser?.id}
        actionLoadingId={actionLoadingId}
        onUpdateStatus={updateUserStatus}
      />
    </div>
  );
}
