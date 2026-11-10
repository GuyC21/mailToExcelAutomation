/**
 * Login Page Component.
 * 
 * Provides a secure, Hebrew RTL login screen allowing registered users to
 * authenticate via Supabase GoTrue with their email and password.
 */
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, AlertCircle, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';

/**
 * LoginPage Component
 * 
 * @component
 * @returns {JSX.Element} The rendered Login Page.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      // Route pending users directly to the approval waiting screen
      if (res?.profile && res.profile.status !== 'APPROVED') {
        navigate('/pending-approval', { replace: true });
      } else {
        navigate(fromPath, { replace: true });
      }
    } catch (err) {
      setErrorMessage(err.message || 'שם משתמש או סיסמה שגויים');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-auto py-8 px-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold mx-auto shadow-md shadow-blue-200 mb-4">
            B
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">כניסה למערכת</h1>
          <p className="text-sm text-gray-500 mt-1">BillingStream AI • אוטומציה ובקרה פיננסית</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 mr-1">
              כתובת אימייל
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3 pr-10 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none"
              />
              <Mail className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 mr-1">
              סיסמה
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-10 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>מאמת נתונים...</span>
              </>
            ) : (
              <>
                <span>התחבר למערכת</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer / Registration link */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-600">
          עדיין אין לך חשבון?{' '}
          <Link
            to="/register"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            הרשם כאן
          </Link>
        </div>

        {/* Security badge note */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>מאובטח באמצעות Supabase JWT & אישור מנהל</span>
        </div>
      </div>
    </div>
  );
}
