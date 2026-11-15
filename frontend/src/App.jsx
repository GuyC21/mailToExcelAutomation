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
import { BYOKProvider } from './context/BYOKContext';
import Topbar from './components/layout/Topbar';
import Footer from './components/layout/Footer';
import BYOKModal from './components/byok/BYOKModal';
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
      <BYOKProvider>
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans w-full max-w-[100vw] overflow-x-hidden" dir="rtl">
          <Topbar />
          <BYOKModal />

          <main className="flex-1 w-full max-w-7xl mx-auto p-[0.75rem] sm:p-[1rem] md:p-[1.5rem] lg:p-[2rem] flex flex-col items-center justify-start gap-[1rem] sm:gap-[1.5rem] md:gap-[2rem] overflow-x-hidden">
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

        <Footer />
      </div>
    </BYOKProvider>
  </AuthProvider>
  );
}

export default App;
