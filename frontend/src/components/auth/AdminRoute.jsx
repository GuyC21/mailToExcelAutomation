/**
 * Administrator Route Guard Component.
 * 
 * Restricts access exclusively to users with the ADMIN role and APPROVED status.
 * Non-admin users are safely redirected to the main dashboard.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { RefreshCw } from 'lucide-react';

/**
 * AdminRoute Component
 * 
 * @component
 * @param {{ children: React.ReactNode }} props - The components to render when admin privilege is verified.
 * @returns {JSX.Element}
 */
export default function AdminRoute({ children }) {
  const { isAuthenticated, isApproved, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium">בודק הרשאות ניהול...</span>
      </div>
    );
  }

  if (!isAuthenticated || !isApproved) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
