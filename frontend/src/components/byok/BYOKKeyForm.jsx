import React, { useId, useState } from 'react';
import { Eye, EyeOff, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, Sparkles } from 'lucide-react';

/**
 * BYOKKeyForm Component
 *
 * Self-contained tabbed input form for entering, masking, verifying, and clearing
 * ephemeral Gemini and OpenAI API keys.
 * @component
 * @param {{
 *   initialGemini: string,
 *   initialOpenai: string,
 *   isVerifying: boolean,
 *   onVerify: (provider: 'gemini'|'openai', key: string) => Promise<{ message: string }>,
 *   onSave: (keys: { newGemini: string, newOpenai: string }) => void,
 *   onClear: () => void,
 *   onClose: () => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function BYOKKeyForm({ initialGemini, initialOpenai, isVerifying, onVerify, onSave, onClear, onClose }) {
  const [activeTab, setActiveTab] = useState('gemini');
  const [inputGemini, setInputGemini] = useState(initialGemini);
  const [inputOpenai, setInputOpenai] = useState(initialOpenai);
  const [showKey, setShowKey] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const keyInputId = useId();

  const isGemini = activeTab === 'gemini';
  const currentKey = isGemini ? inputGemini : inputOpenai;
  const externalDocsUrl = isGemini ? 'https://aistudio.google.com/app/apikey' : 'https://platform.openai.com/api-keys';

  const handleVerify = async () => {
    setFeedback(null);
    try {
      const res = await onVerify(activeTab, currentKey);
      setFeedback({ success: true, message: res.message });
    } catch (err) {
      setFeedback({ success: false, message: err.message });
    }
  };

  const handleClear = () => {
    onClear();
    setInputGemini('');
    setInputOpenai('');
    setFeedback(null);
  };

  return (
    <div className="space-y-[1rem]">
      <div className="flex rounded-xl bg-gray-100 p-[0.25rem]">
        {[
          { id: 'gemini', label: 'Google Gemini (מומלץ)' },
          { id: 'openai', label: 'OpenAI (GPT-4o)' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveTab(tab.id); setFeedback(null); }}
            className={`flex-1 py-[0.45rem] text-[clamp(0.72rem,2vw,0.8125rem)] font-semibold rounded-lg transition ${
              activeTab === tab.id ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-[0.35rem]">
        <div className="flex flex-wrap justify-between items-center gap-[0.25rem]">
          <label htmlFor={keyInputId} className="block text-[clamp(0.7rem,2vw,0.75rem)] font-semibold text-gray-700">
            {isGemini ? 'מפתח Google AI Studio (Gemini)' : 'מפתח OpenAI API'}
          </label>
          <a href={externalDocsUrl} target="_blank" rel="noreferrer" className="text-[clamp(0.68rem,1.8vw,0.75rem)] text-blue-600 hover:underline flex items-center gap-[0.25rem]">
            {isGemini ? 'השג מפתח חינמי ב-Google Studio' : 'השג מפתח ב-OpenAI Platform'}
            <ExternalLink className="w-[0.75rem] h-[0.75rem]" />
          </a>
        </div>

        <div className="relative">
          <input
            id={keyInputId}
            type={showKey ? 'text' : 'password'}
            dir="ltr"
            value={currentKey}
            onChange={(e) => {
              setFeedback(null);
              if (isGemini) setInputGemini(e.target.value);
              else setInputOpenai(e.target.value);
            }}
            placeholder={isGemini ? 'AIzaSy...' : 'sk-proj-...'}
            className="w-full px-[0.875rem] py-[0.55rem] pl-[3rem] text-[clamp(0.75rem,2vw,0.85rem)] border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono outline-none text-left"
          />
          <button
            type="button"
            onClick={() => setShowKey((prev) => !prev)}
            className="absolute left-[0.65rem] top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-[0.25rem]"
            title={showKey ? 'הסתר מפתח' : 'הצג מפתח'}
            aria-label={showKey ? 'הסתר מפתח' : 'הצג מפתח'}
          >
            {showKey ? <EyeOff className="w-[1rem] h-[1rem]" /> : <Eye className="w-[1rem] h-[1rem]" />}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-[0.75rem] rounded-xl border flex items-start gap-[0.5rem] text-[clamp(0.72rem,2vw,0.8125rem)] ${
          feedback.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />}
          <div className="flex-1">{feedback.message}</div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[0.5rem]">
        <button
          type="button"
          disabled={isVerifying || !currentKey.trim()}
          onClick={handleVerify}
          className="inline-flex items-center justify-center gap-[0.35rem] px-[0.75rem] py-[0.45rem] text-[clamp(0.7rem,1.9vw,0.75rem)] font-semibold rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition w-full sm:w-auto"
        >
          {isVerifying ? <RefreshCw className="w-[0.85rem] h-[0.85rem] animate-spin" /> : <Sparkles className="w-[0.85rem] h-[0.85rem] text-blue-600" />}
          <span>{isVerifying ? 'בודק תקינות מפתח...' : 'בדוק תקינות מפתח (Test Connection)'}</span>
        </button>

        {(inputGemini || inputOpenai) && (
          <button type="button" onClick={handleClear} className="text-[clamp(0.68rem,1.8vw,0.75rem)] text-red-600 hover:text-red-700 hover:underline font-medium text-center sm:text-right">
            נקה מפתחות שמורים
          </button>
        )}
      </div>

      <div className="flex items-center justify-end gap-[0.5rem] sm:gap-[0.75rem] pt-[0.75rem] border-t border-gray-100">
        <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-[1rem] py-[0.45rem] text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition">
          ביטול
        </button>
        <button
          type="button"
          onClick={() => { onSave({ newGemini: inputGemini, newOpenai: inputOpenai }); onClose(); }}
          className="flex-1 sm:flex-none px-[1.125rem] py-[0.45rem] text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
        >
          שמור והשתמש במפתח
        </button>
      </div>
    </div>
  );
}
