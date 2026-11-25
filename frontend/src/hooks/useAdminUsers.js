import { useState, useCallback, useEffect } from 'react';
import { apiRequest } from '../api/client';

/**
 * Custom React Hook: useAdminUsers
 *
 * Encapsulates fetching registered user profiles and performing administrator
 * lifecycle transitions (APPROVED, REJECTED, SUSPENDED) via `apiRequest`.
 *
 * @returns {{
 *   users: object[],
 *   isLoading: boolean,
 *   errorMessage: string,
 *   actionLoadingId: string|null,
 *   actionError: string,
 *   clearActionError: () => void,
 *   fetchUsers: () => Promise<void>,
 *   updateUserStatus: (userId: string, targetStatus: string) => Promise<void>,
 * }}
 */
export function useAdminUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionError, setActionError] = useState('');

  const fetchUsers = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiRequest('/api/admin/users');
        if (active) {
          setUsers(data.users || []);
          setErrorMessage('');
        }
      } catch (err) {
        if (active) setErrorMessage(err.message || 'שגיאה בטעינת רשימת המשתמשים');
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateUserStatus = useCallback(async (userId, targetStatus) => {
    setActionLoadingId(userId);
    setActionError('');
    try {
      const updated = await apiRequest(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: updated?.status || targetStatus } : u)),
      );
    } catch (err) {
      setActionError(err.message || 'שגיאה בעדכון סטטוס המשתמש');
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const clearActionError = useCallback(() => setActionError(''), []);

  return {
    users,
    isLoading,
    errorMessage,
    actionLoadingId,
    actionError,
    clearActionError,
    fetchUsers,
    updateUserStatus,
  };
}
