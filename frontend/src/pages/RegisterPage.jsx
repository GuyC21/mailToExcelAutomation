/**
 * User Registration Page Component.
 * 
 * Allows new users to create an account via Supabase GoTrue.
 * Displays clear notices regarding the required administrator approval step.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, User, AlertCircle, CheckCircle, ArrowLeft, RefreshCw, Info } from 'lucide-react';

/**
 * RegisterPage Component
 * 
 * @component
 * @returns {JSX.Element} The rendered Register Page.
 */
export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (password !== confirmPassword) {
      setErrorMessage('הסיסמאות אינן תואמות');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('על הסיסמה להכיל לפחות 6 תווים');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, fullName);
      setIsSuccess(true);
    } catch (err) {
      setErrorMessage(err.message || 'שגיאה ביצירת החשבון');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto my-auto py-8 px-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ההרשמה נקלטה בהצלחה!</h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            תודה שנרשמת, <strong>{fullName}</strong>.<br />
            החשבון נוצר ונמצא כעת בסטטוס <span className="font-semibold text-amber-600">ממתין לאישור מנהל</span>.
            ברגע שמנהל המערכת יאשר את בקשתך, תוכל לגשת לכל חלקי המערכת.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/pending-approval')}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-100 transition text-sm flex items-center justify-center gap-2"
            >
              <span>מעבר למסך ההמתנה</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Link
              to="/login"
              className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-xl transition text-sm text-center"
            >
              חזרה למסך התחברות
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto my-auto py-8 px-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10">
        {/* Branding Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold mx-auto shadow-md shadow-blue-200 mb-4">
            B
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">הרשמת משתמש חדש</h1>
          <p className="text-sm text-gray-500 mt-1">BillingStream AI</p>
        </div>

        {/* Approval Policy Banner */}
        <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-xs leading-relaxed">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong>שים לב:</strong> הגישה למערכת מוגבלת למשתמשים מאושרים בלבד. לאחר ההרשמה, חשבונך ימתין לאישור מנהל המערכת.
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 mr-1">
              שם מלא
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ישראל ישראלי"
                className="w-full px-4 py-3 pr-10 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none"
              />
              <User className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

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
              סיסמה (לפחות 6 תווים)
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

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 mr-1">
              אימות סיסמה
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-10 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>יוצר חשבון...</span>
              </>
            ) : (
              <>
                <span>הרשם עכשיו</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-gray-100 text-center text-sm text-gray-600">
          כבר יש לך חשבון?{' '}
          <Link
            to="/login"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            התחבר כאן
          </Link>
        </div>
      </div>
    </div>
  );
}
