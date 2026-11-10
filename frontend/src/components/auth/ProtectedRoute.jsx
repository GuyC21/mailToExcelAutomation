/**
 * Protected Route Guard Component.
 * 
 * Enforces that only authenticated and APPROVED users can access the wrapped route.
 * Redirects unauthenticated visitors to /login, and pending/unapproved users to /pending-approval.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { RefreshCw } from 'lucide-react';

/**
 * ProtectedRoute Component
 * 
 * @component
 * @param {{ children: React.ReactNode }} props - The components to render when authorized.
 * @returns {JSX.Element}
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isApproved, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium">מאמת הרשאות גישה...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isApproved) {
    const isRejected = profile?.status === 'REJECTED';
    return <Navigate to={isRejected ? "/pending-approval?status=rejected" : "/pending-approval"} replace />;
  }

  return children;
}
