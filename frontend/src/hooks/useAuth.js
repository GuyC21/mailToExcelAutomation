/**
 * Custom hook to access global authentication state and session actions.
 * @returns {object} Authentication state and action helpers from AuthProvider.
 */
import { useContext } from 'react';
import { AuthContext } from '../context/contexts';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
