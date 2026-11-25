import React from 'react';
import { Lock } from 'lucide-react';

/**
 * BYOKSecurityNotice Component
 *
 * Displays the security and ephemeral-storage privacy guarantee inside BYOKModal.
 * @component
 * @returns {JSX.Element}
 */
export default function BYOKSecurityNotice() {
  return (
    <div className="p-[0.75rem] sm:p-[1rem] bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950 text-[clamp(0.7rem,2vw,0.8rem)]">
      <div className="flex items-center gap-[0.35rem] font-bold text-emerald-900 mb-[0.35rem]">
        <Lock className="w-[0.875rem] h-[0.875rem] text-emerald-700 flex-shrink-0" />
        <span>הבטחת אבטחה ופרטיות מוחלטת (Security Guarantee)</span>
      </div>
      <ul className="space-y-[0.25rem] text-emerald-800 list-disc list-inside leading-relaxed text-[clamp(0.68rem,1.9vw,0.75rem)]">
        <li>
          המפתח נשמר <strong>אך ורק בזיכרון הדפדפן שלך</strong> (<code className="bg-emerald-100 px-[0.25rem] py-[0.1rem] rounded text-emerald-900 font-mono">sessionStorage</code>) לפעילות הנוכחית.
        </li>
        <li>המפתח <strong>אינו נשמר לעולם בבסיס הנתונים</strong>, אינו נכתב לקובץ דיסק, ואינו מופיע ביומני השרת.</li>
        <li>המפתח מועבר ישירות לצורך החילוץ ומוגבל לבקשה הנוכחית בלבד.</li>
        <li>סגירת הלשונית בדפדפן מוחקת את המפתח לצמיתות.</li>
      </ul>
    </div>
  );
}
