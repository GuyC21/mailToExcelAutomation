/**
 * Application Root Component.
 * 
 * Configures the authentication context provider, topbar navigation,
 * public access screens (Login, Register, Pending Approval),
 * and access-guarded routes for backoffice operations and administration.
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Topbar from './components/layout/Topbar';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import UserManagementPage from './pages/UserManagementPage';

import HomePage from './pages/HomePage';
import SandboxPage from './pages/SandboxPage';
import DashboardPage from './pages/DashboardPage';
import RegressionPage from './pages/RegressionPage';
import LabelingPage from './pages/LabelingPage';
import ReviewPage from './pages/ReviewPage';

/**
 * App Component
 * 
 * @component
 * @returns {JSX.Element}
 */
function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans" dir="rtl">
        <Topbar />

        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col items-center justify-start gap-8">
          <Routes>
            {/* Public Authentication Screens */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/pending-approval" element={<PendingApprovalPage />} />

            {/* Protected Backoffice Modules (Approved Users Only) */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/prompts"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sandbox"
              element={
                <ProtectedRoute>
                  <SandboxPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review"
              element={
                <ProtectedRoute>
                  <ReviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/regression"
              element={
                <ProtectedRoute>
                  <RegressionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/labeling"
              element={
                <ProtectedRoute>
                  <LabelingPage />
                </ProtectedRoute>
              }
            />

            {/* Administrator Only Screens */}
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <UserManagementPage />
                </AdminRoute>
              }
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

export default App;
