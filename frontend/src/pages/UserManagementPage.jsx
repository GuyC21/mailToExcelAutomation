/**
 * User Management and Approval Page Component (Admin Only).
 * 
 * Enables system administrators to review newly registered users,
 * inspect their lifecycle status, and promote pending users to APPROVED.
 */
import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
} from 'lucide-react';

/**
 * UserManagementPage Component
 * 
 * @component
 * @returns {JSX.Element} The rendered User Management dashboard.
 */
export default function UserManagementPage() {
  const { user: currentAuthUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await apiRequest('/api/admin/users');
      setUsers(data.users || []);
    } catch (err) {
      setErrorMessage(err.message || 'שגיאה בטעינת רשימת המשתמשים');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateStatus = async (userId, targetStatus) => {
    setActionLoadingId(userId);
    try {
      await apiRequest(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      // Update locally in state
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: targetStatus } : u))
      );
    } catch (err) {
      alert(`שגיאה בעדכון סטטוס: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    const matchesSearch =
      (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = users.filter((u) => u.status === 'PENDING').length;
  const approvedCount = users.filter((u) => u.status === 'APPROVED').length;

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">פאנל ניהול אבטחה</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            ניהול משתמשים ואישורי גישה
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            אישור, דחייה וניהול הרשאות למשתמשי מערכת BillingStream AI.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-700 shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>רענן נתונים</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">סה״כ משתמשים במערכת</div>
            <div className="text-2xl font-bold text-gray-900">{users.length}</div>
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

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', label: 'הכל', count: users.length },
            { id: 'PENDING', label: 'ממתינים', count: pendingCount },
            { id: 'APPROVED', label: 'מאושרים', count: approvedCount },
            { id: 'REJECTED', label: 'נדחו', count: users.filter((u) => u.status === 'REJECTED').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.id ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש לפי שם או אימייל..."
            className="w-full px-3.5 py-2 pr-9 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs font-semibold">
                <th className="py-3.5 px-6">שם המשתמש ואימייל</th>
                <th className="py-3.5 px-6">תפקיד</th>
                <th className="py-3.5 px-6">סטטוס אישור</th>
                <th className="py-3.5 px-6">תאריך הרשמה</th>
                <th className="py-3.5 px-6 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>טוען רשימת משתמשים...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-400">
                    לא נמצאו משתמשים התואמים את החיפוש.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentAuthUser?.id;
                  const isPending = u.status === 'PENDING';
                  const isApproved = u.status === 'APPROVED';
                  const isRejected = u.status === 'REJECTED';
                  const isBusy = actionLoadingId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                            {(u.full_name || u.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              <span>{u.full_name || 'משתמש ללא שם'}</span>
                              {isCurrent && (
                                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  אתה
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-gray-50 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {u.role === 'ADMIN' ? 'מנהל מערכת' : 'משתמש'}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {isApproved && <CheckCircle className="w-3.5 h-3.5" />}
                          {isPending && <Clock className="w-3.5 h-3.5" />}
                          {isRejected && <XCircle className="w-3.5 h-3.5" />}
                          <span>
                            {isApproved ? 'מאושר' : isPending ? 'ממתין לאישור' : 'נדחה'}
                          </span>
                        </span>
                      </td>

                      <td className="py-4 px-6 text-xs text-gray-500">
                        {new Intl.DateTimeFormat('he-IL', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(u.created_at))}
                      </td>

                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(u.id, 'APPROVED')}
                                disabled={isBusy}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1 disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3.5 h-3.5" />
                                )}
                                <span>אשר</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(u.id, 'REJECTED')}
                                disabled={isBusy}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>דחה</span>
                              </button>
                            </>
                          )}

                          {isApproved && !isCurrent && (
                            <button
                              onClick={() => handleUpdateStatus(u.id, 'REJECTED')}
                              disabled={isBusy}
                              className="px-2.5 py-1 text-gray-400 hover:text-red-600 text-xs rounded transition"
                              title="דחה / הקפא משתמש"
                            >
                              הקפא גישה
                            </button>
                          )}

                          {isRejected && (
                            <button
                              onClick={() => handleUpdateStatus(u.id, 'APPROVED')}
                              disabled={isBusy}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>אשר מחדש</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
