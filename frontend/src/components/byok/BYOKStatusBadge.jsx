/**
 * BYOK Status Badge Component.
 * 
 * Renders an interactive provider badge indicating the active extraction engine.
 * Fully responsive using relative units (rem, clamp, %) to prevent clipping on mobile screens.
 * Clicking the badge opens the BYOK configuration modal.
 */
import React from 'react';
import { useBYOK } from '../../hooks/useBYOK';
import { Sparkles } from 'lucide-react';

/**
 * BYOKStatusBadge Component
 * 
 * @component
 * @param {{ className?: string, compact?: boolean }} props
 * @param {string} [props.className=''] Optional extra styling classes.
 * @param {boolean} [props.compact=false] When true, renders an abbreviated label for constrained mobile headers.
 * @returns {JSX.Element}
 */
export default function BYOKStatusBadge({ className = '', compact = false }) {
  const { activeEngine, openModal } = useBYOK();

  let badgeColor = 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
  let dotColor = 'bg-amber-500';
  let fullLabel = 'מצב הדגמה (ללא מפתח)';
  let shortLabel = 'הדגמה (Mock)';

  if (activeEngine === 'gemini') {
    badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
    dotColor = 'bg-emerald-500 animate-pulse';
    fullLabel = 'Gemini אישי פעיל';
    shortLabel = 'Gemini אישי';
  } else if (activeEngine === 'openai') {
    badgeColor = 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100';
    dotColor = 'bg-blue-500 animate-pulse';
    fullLabel = 'OpenAI אישי פעיל';
    shortLabel = 'OpenAI אישי';
  }

  return (
    <button
      type="button"
      onClick={openModal}
      title="לחץ להגדרת מפתח AI אישי (BYOK) או בדיקת חיבור"
      className={`inline-flex items-center gap-[0.35rem] px-[0.6rem] py-[0.25rem] text-[clamp(0.68rem,1.8vw,0.75rem)] font-semibold rounded-full border transition cursor-pointer shadow-2xs whitespace-nowrap max-w-full min-w-0 ${badgeColor} ${className}`}
    >
      <span className={`w-[0.45rem] h-[0.45rem] rounded-full flex-shrink-0 ${dotColor}`} />
      
      {compact ? (
        <span className="truncate">{shortLabel}</span>
      ) : (
        <>
          <span className="hidden sm:inline truncate">{fullLabel}</span>
          <span className="sm:hidden truncate">{shortLabel}</span>
        </>
      )}

      <Sparkles className="w-[0.75rem] h-[0.75rem] opacity-70 flex-shrink-0" />
    </button>
  );
}
