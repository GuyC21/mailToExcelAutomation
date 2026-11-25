/**
 * Login Page Component.
 */
import React, { useId, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../api/supabase';
import { Lock, Mail, AlertCircle, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';

/**
 * Renders the Hebrew RTL login screen backed by Supabase GoTrue authentication.
 * @component
 * @returns {JSX.Element}
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const baseId = useId();

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
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold mx-auto shadow-md shadow-blue-200 mb-4">
            B
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">כניסה למערכת</h1>
          <p className="text-sm text-gray-500 mt-1">BillingStream AI • אוטומציה ובקרה פיננסית</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <div>שירות האימות (Supabase) אינו מוגדר בסביבה זו. יש להגדיר <code>VITE_SUPABASE_URL</code> ו-<code>VITE_SUPABASE_ANON_KEY</code>.</div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor={`${baseId}-email`} className="block text-xs font-semibold text-gray-700 mb-1.5 mr-1">
              כתובת אימייל
            </label>
            <div className="relative">
              <input
                id={`${baseId}-email`}
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3 pr-10 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none text-left"
              />
              <Mail className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label htmlFor={`${baseId}-pass`} className="block text-xs font-semibold text-gray-700 mb-1.5 mr-1">
              סיסמה
            </label>
            <div className="relative">
              <input
                id={`${baseId}-pass`}
                type="password"
                dir="ltr"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-10 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none text-left"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isSupabaseConfigured}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /><span>מאמת נתונים...</span></>
            ) : (
              <><span>התחבר למערכת</span><ArrowLeft className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-600">
          עדיין אין לך חשבון?{' '}
          <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
            הרשם כאן
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>מאובטח באמצעות Supabase JWT & אישור מנהל</span>
        </div>
      </div>
    </div>
  );
}
