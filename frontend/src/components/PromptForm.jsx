import React, { useState, forwardRef, useImperativeHandle } from 'react';

const PromptForm = forwardRef(({ onSuccess }, ref) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Expose a method to populate the form from outside (for the "Duplicate" feature)
  useImperativeHandle(ref, () => ({
    populateForm: (promptName, promptContent) => {
      setName(promptName);
      setContent(promptContent);
      setNotes('');
    }
  }));

  const handleEnhance = async () => {
    if (!content.trim()) {
      alert("אנא הכנס טקסט בסיסי תחילה כדי שנוכל לשפר אותו.");
      return;
    }
    
    setIsEnhancing(true);
    try {
      const res = await fetch(`${API_URL}/api/prompts/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content })
      });
      if (res.ok) {
        const data = await res.json();
        setContent(data.enhanced_text);
      } else {
        alert("שגיאה בשיפור הפרומפט.");
      }
    } catch (e) {
      console.error(e);
      alert("שגיאת רשת בשיפור הפרומפט.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/prompts/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          content,
          version_notes: notes,
          is_active: false
        })
      });
      if (res.ok) {
        setName('');
        setContent('');
        setNotes('');
        onSuccess(); // Trigger parent refresh
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-lg shadow border border-gray-100 flex flex-col h-full">
      <h2 className="text-lg md:text-xl font-semibold mb-4 border-b pb-2 text-gray-800 shrink-0">יצירת גרסה חדשה</h2>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 space-y-4">
        <div className="shrink-0">
          <label className="block text-sm font-medium mb-1 text-gray-700">שם הגרסה</label>
          <input 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            placeholder="למשל: פרומפט חשבוניות מעודכן"
          />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex justify-between items-end mb-1 shrink-0">
            <label className="block text-sm font-medium text-gray-700">תוכן הפרומפט</label>
            <button 
              type="button" 
              onClick={handleEnhance}
              disabled={isEnhancing}
              className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded transition flex items-center gap-1 font-medium disabled:opacity-50"
            >
              {isEnhancing ? 'משפר...' : '✨ שפר באמצעות AI'}
            </button>
          </div>
          <textarea 
            value={content}
            onChange={e => setContent(e.target.value)}
            required
            className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition flex-1 resize-none min-h-[150px]"
            placeholder="הכנס את ההנחיות למודל ה-AI כאן..."
            dir="auto"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-sm font-medium mb-1 text-gray-700">הערות שחרור (אופציונלי)</label>
          <input 
            type="text" 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            placeholder="מה השתנה בגרסה זו?"
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded hover:bg-blue-700 transition shadow-sm shrink-0">
          שמור פרומפט
        </button>
      </form>
    </div>
  );
});

export default PromptForm;
