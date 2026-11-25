/**
 * BYOK Settings Modal Dialog Component.
 */
import React, { useEffect, useId } from 'react';
import { Key, X } from 'lucide-react';
import { useBYOK } from '../../hooks/useBYOK';
import BYOKSecurityNotice from './BYOKSecurityNotice';
import BYOKKeyForm from './BYOKKeyForm';

/**
 * Renders the accessible BYOK configuration modal when open.
 * @component
 * @returns {JSX.Element|null}
 */
export default function BYOKModal() {
  const { geminiKey, openaiKey, isModalOpen, closeModal, saveKeys, clearKeys, verifyKey, isVerifying } = useBYOK();
  const titleId = useId();

  useEffect(() => {
    if (!isModalOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-[0.75rem] sm:p-[1rem] bg-gray-900/60 backdrop-blur-sm animate-fade-in"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={closeModal}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-[min(94vw,34rem)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-[1rem] sm:px-[1.5rem] py-[0.875rem] sm:py-[1.25rem] border-b border-gray-100 bg-gray-50/70 flex-shrink-0">
          <div className="flex items-center gap-[0.625rem] min-w-0">
            <div className="w-[2.25rem] h-[2.25rem] sm:w-[2.5rem] sm:h-[2.5rem] rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs flex-shrink-0">
              <Key className="w-[1.125rem] h-[1.125rem]" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-[clamp(0.95rem,3vw,1.125rem)] font-bold text-gray-900 truncate">
                הגדרת מפתח AI אישי (BYOK)
              </h2>
              <p className="text-[clamp(0.68rem,2vw,0.75rem)] text-gray-500 truncate">
                Bring Your Own Key • שימוש במכסה אישית לחילוץ מסמכים
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-[0.375rem] text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition flex-shrink-0 mr-1"
            aria-label="סגור"
          >
            <X className="w-[1.25rem] h-[1.25rem]" />
          </button>
        </div>

        <div className="p-[1rem] sm:p-[1.5rem] overflow-y-auto space-y-[1rem] flex-1">
          <BYOKSecurityNotice />
          <BYOKKeyForm
            initialGemini={geminiKey}
            initialOpenai={openaiKey}
            isVerifying={isVerifying}
            onVerify={verifyKey}
            onSave={saveKeys}
            onClear={clearKeys}
            onClose={closeModal}
          />
        </div>
      </div>
    </div>
  );
}
