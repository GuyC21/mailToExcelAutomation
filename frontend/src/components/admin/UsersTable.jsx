import React from 'react';
import { RefreshCw } from 'lucide-react';
import UserRow from './UserRow';

/**
 * UsersTable Component
 *
 * Displays registered users with lifecycle status badges and administrator approval actions.
 * @component
 * @param {{
 *   users: object[],
 *   isLoading: boolean,
 *   currentUserId?: string,
 *   actionLoadingId: string|null,
 *   onUpdateStatus: (userId: string, status: string) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function UsersTable({ users, isLoading, currentUserId, actionLoadingId, onUpdateStatus }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse min-w-[720px]">
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
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-12 text-center text-gray-400">לא נמצאו משתמשים התואמים את החיפוש.</td>
              </tr>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isCurrent={user.id === currentUserId}
                  isBusy={actionLoadingId === user.id}
                  onUpdateStatus={onUpdateStatus}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
