import React from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, PauseCircle } from 'lucide-react';
import { formatDateTime } from '../../utils/format';

const STATUS_META = {
  APPROVED: { label: 'מאושר', icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING: { label: 'ממתין לאישור', icon: Clock, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUSPENDED: { label: 'מוקפא', icon: PauseCircle, cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  REJECTED: { label: 'נדחה', icon: XCircle, cls: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * UserRow Component
 *
 * Renders a single row in the admin users table with lifecycle badge and transition buttons.
 * @component
 * @param {{
 *   user: object,
 *   isCurrent: boolean,
 *   isBusy: boolean,
 *   onUpdateStatus: (userId: string, status: string) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function UserRow({ user, isCurrent, isBusy, onUpdateStatus }) {
  const meta = STATUS_META[user.status] || STATUS_META.PENDING;
  const StatusIcon = meta.icon;
  const initial = ((user.full_name || user.email || 'U')[0] || 'U').toUpperCase();

  return (
    <tr className="hover:bg-gray-50/70 transition">
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="truncate">{user.full_name || 'משתמש ללא שם'}</span>
              {isCurrent && <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">אתה</span>}
            </div>
            <div className="text-xs text-gray-500 font-mono truncate">{user.email}</div>
          </div>
        </div>
      </td>

      <td className="py-4 px-6">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
          user.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-gray-50 text-gray-600 border border-gray-200'
        }`}>
          {user.role === 'ADMIN' ? 'מנהל מערכת' : 'משתמש'}
        </span>
      </td>

      <td className="py-4 px-6">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{meta.label}</span>
        </span>
      </td>

      <td className="py-4 px-6 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(user.created_at)}</td>

      <td className="py-4 px-6 text-center">
        <div className="flex items-center justify-center gap-2">
          {user.status === 'PENDING' && (
            <>
              <button
                type="button"
                onClick={() => onUpdateStatus(user.id, 'APPROVED')}
                disabled={isBusy}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1 disabled:opacity-50"
              >
                {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                <span>אשר</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(user.id, 'REJECTED')}
                disabled={isBusy}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>דחה</span>
              </button>
            </>
          )}
          {user.status === 'APPROVED' && !isCurrent && (
            <button
              type="button"
              onClick={() => onUpdateStatus(user.id, 'SUSPENDED')}
              disabled={isBusy}
              className="px-2.5 py-1 text-gray-500 hover:text-orange-700 hover:bg-orange-50 text-xs rounded transition"
              title="הקפא גישה"
            >
              הקפא גישה
            </button>
          )}
          {(user.status === 'REJECTED' || user.status === 'SUSPENDED') && (
            <button
              type="button"
              onClick={() => onUpdateStatus(user.id, 'APPROVED')}
              disabled={isBusy}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{user.status === 'SUSPENDED' ? 'בטל הקפאה' : 'אשר מחדש'}</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
