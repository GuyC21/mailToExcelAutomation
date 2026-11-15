/**
 * BYOK Settings Modal Component.
 * 
 * Allows users to input, test, and manage their personal API keys (Gemini / OpenAI).
 * Displays a prominent, legally reassuring privacy and security guarantee box
 * confirming that keys are stored strictly in ephemeral browser sessionStorage
 * and never persisted to databases or server logs.
 * Fully responsive using relative units (rem, clamp, vw, %) to avoid mobile clipping.
 */
import React, { useState, useEffect } from 'react';
import { useBYOK } from '../../hooks/useBYOK';
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Sparkles,
  Lock,
} from 'lucide-react';

/**
 * BYOKModal Component
 * 
 * @component
 * @returns {JSX.Element|null} The rendered modal when open.
 */
export default function BYOKModal() {
  const {
    geminiKey,
    openaiKey,
    isModalOpen,
    closeModal,
    saveKeys,
    clearKeys,
    verifyKey,
    isVerifying,
  } = useBYOK();

  const [activeTab, setActiveTab] = useState('gemini');
  const [inputGemini, setInputGemini] = useState('');
  const [inputOpenai, setInputOpenai] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [localFeedback, setLocalFeedback] = useState(null);

  // Sync inputs with stored context keys when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setInputGemini(geminiKey);
      setInputOpenai(openaiKey);
      setLocalFeedback(null);
      setShowKey(false);
    }
  }, [isModalOpen, geminiKey, openaiKey]);

  if (!isModalOpen) return null;

  const currentKey = activeTab === 'gemini' ? inputGemini : inputOpenai;

  const handleVerify = async () => {
    setLocalFeedback(null);
    try {
      const res = await verifyKey(activeTab, currentKey);
      setLocalFeedback({ success: true, message: res.message });
    } catch (err) {
      setLocalFeedback({ success: false, message: err.message });
    }
  };

  const handleSave = () => {
    saveKeys({ newGemini: inputGemini, newOpenai: inputOpenai });
    closeModal();
  };

  const handleClear = () => {
    clearKeys();
    setInputGemini('');
    setInputOpenai('');
    setLocalFeedback(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[0.75rem] sm:p-[1rem] bg-gray-900/60 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-[min(94vw,34rem)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[1rem] sm:px-[1.5rem] py-[0.875rem] sm:py-[1.25rem] border-b border-gray-100 bg-gray-50/70 flex-shrink-0">
          <div className="flex items-center gap-[0.625rem] min-w-0">
            <div className="w-[2.25rem] h-[2.25rem] sm:w-[2.5rem] sm:h-[2.5rem] rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs flex-shrink-0">
              <Key className="w-[1.125rem] h-[1.125rem]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[clamp(0.95rem,3vw,1.125rem)] font-bold text-gray-900 truncate">הגדרת מפתח AI אישי (BYOK)</h2>
              <p className="text-[clamp(0.68rem,2vw,0.75rem)] text-gray-500 truncate">Bring Your Own Key • שימוש במכסה אישית לחילוץ מסמכים</p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-[0.375rem] text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition flex-shrink-0 mr-1"
            aria-label="סגור"
          >
            <X className="w-[1.25rem] h-[1.25rem]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-[1rem] sm:p-[1.5rem] overflow-y-auto space-y-[1rem] flex-1">
          {/* MANDATORY PROMINENT PRIVACY & SECURITY GUARANTEE */}
          <div className="p-[0.75rem] sm:p-[1rem] bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950 text-[clamp(0.7rem,2vw,0.8rem)]">
            <div className="flex items-center gap-[0.35rem] font-bold text-emerald-900 mb-[0.35rem]">
              <Lock className="w-[0.875rem] h-[0.875rem] text-emerald-700 flex-shrink-0" />
              <span>הבטחת אבטחה ופרטיות מוחלטת (Security Guarantee)</span>
            </div>
            <ul className="space-y-[0.25rem] text-emerald-800 list-disc list-inside leading-relaxed text-[clamp(0.68rem,1.9vw,0.75rem)]">
              <li>
                המפתח נשמר <strong>אך ורק בזיכרון הדפדפן שלך</strong> (<code className="bg-emerald-100 px-[0.25rem] py-[0.1rem] rounded text-emerald-900 font-mono">sessionStorage</code>) לפעילות הנוכחית.
              </li>
              <li>
                המפתח <strong>אינו נשמר לעולם בבסיס הנתונים</strong>, אינו נכתב לקובץ דיסק, ואינו מופיע ביומני השרת.
              </li>
              <li>
                המפתח מועבר בחיבור מאובטח ומוצפן (<span className="font-mono">HTTPS</span>) ישירות לצורך החילוץ, ונמחק מהזיכרון מיד בסיומו.
              </li>
              <li>
                סגירת הלשונית בדפדפן מוחקת את המפתח לצמיתות.
              </li>
            </ul>
          </div>

          {/* Provider Tabs */}
          <div className="flex rounded-xl bg-gray-100 p-[0.25rem]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('gemini');
                setLocalFeedback(null);
              }}
              className={`flex-1 py-[0.45rem] text-[clamp(0.72rem,2vw,0.8125rem)] font-semibold rounded-lg transition ${
                activeTab === 'gemini'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Google Gemini (מומלץ)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('openai');
                setLocalFeedback(null);
              }}
              className={`flex-1 py-[0.45rem] text-[clamp(0.72rem,2vw,0.8125rem)] font-semibold rounded-lg transition ${
                activeTab === 'openai'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              OpenAI (GPT-4o)
            </button>
          </div>

          {/* Key Input Section */}
          <div className="space-y-[0.35rem]">
            <div className="flex flex-wrap justify-between items-center gap-[0.25rem]">
              <label className="block text-[clamp(0.7rem,2vw,0.75rem)] font-semibold text-gray-700">
                {activeTab === 'gemini' ? 'מפתח Google AI Studio (Gemini)' : 'מפתח OpenAI API'}
              </label>
              {activeTab === 'gemini' ? (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[clamp(0.68rem,1.8vw,0.75rem)] text-blue-600 hover:underline flex items-center gap-[0.25rem]"
                >
                  השג מפתח חינמי ב-Google Studio
                  <ExternalLink className="w-[0.75rem] h-[0.75rem]" />
                </a>
              ) : (
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[clamp(0.68rem,1.8vw,0.75rem)] text-blue-600 hover:underline flex items-center gap-[0.25rem]"
                >
                  השג מפתח ב-OpenAI Platform
                  <ExternalLink className="w-[0.75rem] h-[0.75rem]" />
                </a>
              )}
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={activeTab === 'gemini' ? inputGemini : inputOpenai}
                onChange={(e) => {
                  setLocalFeedback(null);
                  if (activeTab === 'gemini') {
                    setInputGemini(e.target.value);
                  } else {
                    setInputOpenai(e.target.value);
                  }
                }}
                placeholder={activeTab === 'gemini' ? 'AIzaSy...' : 'sk-proj-...'}
                className="w-full px-[0.875rem] py-[0.55rem] pl-[3rem] text-[clamp(0.75rem,2vw,0.85rem)] border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-[0.65rem] top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-[0.25rem]"
                title={showKey ? 'הסתר מפתח' : 'הצג מפתח'}
              >
                {showKey ? <EyeOff className="w-[1rem] h-[1rem]" /> : <Eye className="w-[1rem] h-[1rem]" />}
              </button>
            </div>
          </div>

          {/* Verification Feedback Banner */}
          {localFeedback && (
            <div
              className={`p-[0.75rem] rounded-xl border flex items-start gap-[0.5rem] text-[clamp(0.72rem,2vw,0.8125rem)] ${
                localFeedback.success
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {localFeedback.success ? (
                <CheckCircle2 className="w-[1rem] h-[1rem] flex-shrink-0 mt-[0.1rem] text-green-600" />
              ) : (
                <AlertTriangle className="w-[1rem] h-[1rem] flex-shrink-0 mt-[0.1rem] text-red-600" />
              )}
              <div className="flex-1">{localFeedback.message}</div>
            </div>
          )}

          {/* Test / Verify Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[0.5rem] pt-[0.25rem]">
            <button
              type="button"
              disabled={isVerifying || !currentKey.trim()}
              onClick={handleVerify}
              className="inline-flex items-center justify-center gap-[0.35rem] px-[0.75rem] py-[0.45rem] text-[clamp(0.7rem,1.9vw,0.75rem)] font-semibold rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition w-full sm:w-auto"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-[0.85rem] h-[0.85rem] animate-spin" />
                  בודק תקינות מפתח...
                </>
              ) : (
                <>
                  <Sparkles className="w-[0.85rem] h-[0.85rem] text-blue-600" />
                  בדוק תקינות מפתח (Test Connection)
                </>
              )}
            </button>

            {(inputGemini || inputOpenai) && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[clamp(0.68rem,1.8vw,0.75rem)] text-red-600 hover:text-red-700 hover:underline font-medium text-center sm:text-right"
              >
                נקה מפתחות שמורים
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-[0.5rem] sm:gap-[0.75rem] px-[1rem] sm:px-[1.5rem] py-[0.75rem] sm:py-[1rem] border-t border-gray-100 bg-gray-50/70 flex-shrink-0">
          <button
            type="button"
            onClick={closeModal}
            className="flex-1 sm:flex-none px-[1rem] py-[0.45rem] text-[clamp(0.75rem,2vw,0.85rem)] font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition text-center"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 sm:flex-none px-[1.125rem] py-[0.45rem] text-[clamp(0.75rem,2vw,0.85rem)] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs shadow-blue-200 transition text-center"
          >
            שמור והשתמש במפתח
          </button>
        </div>
      </div>
    </div>
  );
}
