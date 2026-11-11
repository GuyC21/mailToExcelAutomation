/**
 * Website Footer Component.
 * 
 * Provides a persistent legal disclaimer across all authenticated and public views.
 * Clarifies that the platform is a simulation environment utilizing synthetic/mock data,
 * mitigating legal exposure and disclaiming formal accounting reliance.
 */
import React from 'react';

/**
 * Footer Component
 * 
 * Renders a full-width bottom layout banner anchored cleanly at the base of the page.
 * Uses muted colors and clean typography aligned with the application's RTL interface.
 * 
 * @component
 * @returns {JSX.Element} The rendered footer element.
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      className="w-full bg-white border-t border-gray-200 mt-auto py-6 px-4 md:px-8 text-gray-500 text-xs" 
      dir="rtl"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Legal Disclaimer Text (Option A) */}
        <div className="flex-1 text-center md:text-right leading-relaxed space-y-1">
          <p className="font-semibold text-gray-600">
            הבהרה משפטית:
          </p>
          <p className="text-gray-500">
            מערכת זו הינה סביבת הדגמה ופיתוח (Demo Environment). כלל הנתונים, המסמכים, הטפסים, 
            הסכומים ושמות החברות המופיעים באתר הינם סינתטיים ונוצרו לצורכי בדיקה וסימולציה בלבד. 
            כל קשר בין המידע המוצג לבין חברות, ישויות או אנשים במציאות הינו מקרי בהחלט. 
            אין לראות במידע זה מסמכים חשבונאיים רשמיים, ואין להסתמך עליהם לכל מטרה.
          </p>
        </div>

        {/* Project & Environment Identification */}
        <div className="flex flex-col items-center md:items-end text-center md:text-left shrink-0 text-gray-400 text-[11px] border-t md:border-t-0 md:border-r border-gray-200 pt-3 md:pt-0 md:pr-6 gap-0.5">
          <span className="font-medium text-gray-600">
            BillingStream AI
          </span>
          <span>
            סביבת סימולציה ומחקר &bull; {currentYear}
          </span>
        </div>
      </div>
    </footer>
  );
}
