import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowLeft } from 'lucide-react';

/**
 * RegistrationSuccessCard Component
 *
 * Confirmation screen displayed after a new user completes registration.
 * @component
 * @param {{ fullName: string }} props - Registered user's display name.
 * @returns {JSX.Element}
 */
export default function RegistrationSuccessCard({ fullName }) {
  const navigate = useNavigate();

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
            type="button"
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
