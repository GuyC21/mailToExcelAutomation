import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Topbar from './components/layout/Topbar';
import HomePage from './pages/HomePage';
import SandboxPage from './pages/SandboxPage';
import DashboardPage from './pages/DashboardPage';
import RegressionPage from './pages/RegressionPage';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans" dir="rtl">
      <Topbar />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col items-center justify-start gap-8">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/prompts" element={<HomePage />} />
          <Route path="/sandbox" element={<SandboxPage />} />
          <Route path="/regression" element={<RegressionPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
