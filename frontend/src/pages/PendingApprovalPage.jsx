/**
 * Pending Approval Page Component.
 * 
 * Displayed to registered users whose accounts are awaiting administrator approval
 * (status === 'PENDING') or have been rejected.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Clock, RefreshCw, LogOut, ShieldAlert, CheckCircle2 } from 'lucide-react';

/**
 * PendingApprovalPage Component
 * 
 * @component
 * @returns {JSX.Element} The rendered Pending Approval screen.
 */
export default function PendingApprovalPage() {
  const { profile, user, session, isLoading, refreshProfile, logout, isApproved } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isRejected = profile?.status === 'REJECTED' || searchParams.get('status') === 'rejected';

  // If user is already approved, immediately navigate to dashboard
  React.useEffect(() => {
    if (isApproved) {
      navigate('/dashboard', { replace: true });
    }
  }, [isApproved, navigate]);

  // If session is completely missing and not loading, redirect to login
  React.useEffect(() => {
    if (!isLoading && !user && !session) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, user, session, navigate]);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setCheckMessage('');
    try {
      const updated = await refreshProfile();
      if (updated?.status === 'APPROVED') {
        setCheckMessage('חשבונך אושר בהצלחה! מעביר אותך למערכת...');
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 800);
      } else if (updated?.status === 'REJECTED') {
        setCheckMessage('החשבון נדחה על ידי מנהל המערכת.');
      } else {
        setCheckMessage('החשבון עדיין ממתין לאישור מנהל המערכת.');
      }
    } catch {
      setCheckMessage('שגיאה בבדיקת הסטטוס. נסה שוב מאוחר יותר.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="w-full max-w-lg mx-auto my-auto py-12 px-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10 text-center">
        {/* Status Icon */}
        <div className="mb-6 flex justify-center">
          {isRejected ? (
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center shadow-lg shadow-red-50">
              <ShieldAlert className="w-10 h-10" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-50 animate-pulse">
              <Clock className="w-10 h-10" />
            </div>
          )}
        </div>

        {/* Title & Details */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isRejected ? 'הבקשה נדחתה' : 'החשבון ממתין לאישור מנהל'}
        </h1>

        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          {isRejected ? (
            <>
              חשבונך ({user?.email}) נבדק ולא אושר לגישה למערכת.<br />
              לבירור פרטים נוספים או ערעור, פנה למנהל הכספים או לתמיכה הטכנית.
            </>
          ) : (
            <>
              שלום <strong>{profile?.full_name || user?.user_metadata?.full_name || user?.email || 'משתמש'}</strong>,<br />
              על מנת לשמור על אבטחת הנתונים הפיננסיים, כל משתמש חדש במערכת חייב לעבור אישור ידני על ידי מנהל מערכת לפני קבלת גישה.
            </>
          )}
        </p>

        {/* Feedback Alert from Status Check */}
        {checkMessage && (
          <div
            className={`mb-6 p-3.5 rounded-xl text-sm flex items-center justify-center gap-2 ${
              checkMessage.includes('אושר')
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {checkMessage.includes('אושר') ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            <span>{checkMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {!isRejected && (
            <button
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition disabled:opacity-60 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'בודק סטטוס...' : 'בדוק סטטוס אישור כעת'}</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-xl transition flex items-center justify-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4 text-gray-500" />
            <span>התנתק מהחשבון</span>
          </button>
        </div>

        {/* Informative Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400">
          מזהה משתמש: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono text-[11px]">{user?.id || '—'}</code>
        </div>
      </div>
    </div>
  );
}
