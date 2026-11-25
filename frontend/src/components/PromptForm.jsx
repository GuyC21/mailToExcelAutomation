import React, { useState, useId, forwardRef, useImperativeHandle } from 'react';

/**
 * PromptForm Component
 *
 * Isolated form for authoring new business prompt versions and invoking AI-assisted
 * prompt enhancement via injected hook callbacks.
 * @component
 * @param {{
 *   onCreate: (payload: { name: string, content: string, version_notes: string, is_active: boolean }) => Promise<{ success: boolean, error?: string }>,
 *   onEnhance: (text: string) => Promise<{ success: boolean, text?: string, error?: string }>,
 *   onSuccess?: () => void,
 * }} props
 * @param {React.Ref<{ populateForm: (name: string, content: string) => void }>} ref
 * @returns {JSX.Element}
 */
const PromptForm = forwardRef(({ onCreate, onEnhance, onSuccess }, ref) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const baseId = useId();

  useImperativeHandle(ref, () => ({
    populateForm: (promptName, promptContent) => {
      setName(promptName);
      setContent(promptContent);
      setNotes('');
      setFormError('');
    },
  }));

  const handleEnhance = async () => {
    setFormError('');
    if (!content.trim()) {
      setFormError('אנא הכנס טקסט בסיסי תחילה כדי שנוכל לשפר אותו.');
      return;
    }
    setIsEnhancing(true);
    const result = await onEnhance(content);
    if (result.success) {
      setContent(result.text);
    } else {
      setFormError(result.error || 'שגיאה בשיפור הפרומפט.');
    }
    setIsEnhancing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    const result = await onCreate({ name, content, version_notes: notes, is_active: false });
    setIsSubmitting(false);
    if (result.success) {
      setName('');
      setContent('');
      setNotes('');
      onSuccess?.();
    } else {
      setFormError(result.error || 'שגיאה בשמירת הפרומפט.');
    }
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-lg shadow border border-gray-100 flex flex-col h-full">
      <h2 className="text-lg md:text-xl font-semibold mb-4 border-b pb-2 text-gray-800 shrink-0">יצירת גרסה חדשה</h2>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 space-y-4">
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm shrink-0">{formError}</div>
        )}
        <div className="shrink-0">
          <label htmlFor={`${baseId}-name`} className="block text-sm font-medium mb-1 text-gray-700">שם הגרסה</label>
          <input
            id={`${baseId}-name`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            placeholder="למשל: פרומפט חשבוניות מעודכן"
          />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex justify-between items-end mb-1 shrink-0">
            <label htmlFor={`${baseId}-content`} className="block text-sm font-medium text-gray-700">תוכן הפרומפט</label>
            <button
              type="button"
              onClick={handleEnhance}
              disabled={isEnhancing || isSubmitting}
              className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded transition flex items-center gap-1 font-medium disabled:opacity-50"
            >
              {isEnhancing ? 'משפר...' : '✨ שפר באמצעות AI'}
            </button>
          </div>
          <textarea
            id={`${baseId}-content`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition flex-1 resize-none min-h-[150px]"
            placeholder="הכנס את ההנחיות למודל ה-AI כאן..."
            dir="auto"
          />
        </div>
        <div className="shrink-0">
          <label htmlFor={`${baseId}-notes`} className="block text-sm font-medium mb-1 text-gray-700">הערות שחרור (אופציונלי)</label>
          <input
            id={`${baseId}-notes`}
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            placeholder="מה השתנה בגרסה זו?"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded hover:bg-blue-700 transition shadow-sm shrink-0 disabled:opacity-50"
        >
          {isSubmitting ? 'שומר...' : 'שמור פרומפט'}
        </button>
      </form>
    </div>
  );
});

PromptForm.displayName = 'PromptForm';

export default PromptForm;
