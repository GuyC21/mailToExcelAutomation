import { useState, useEffect } from 'react';
import ConfirmModal from '../components/ConfirmModal';

const HomePage = () => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');

  // Delete Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/prompts/`);
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [isEnhancing, setIsEnhancing] = useState(false);

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

  const createPrompt = async (e) => {
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
        fetchPrompts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activatePrompt = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/prompts/${id}/activate`, { method: 'POST' });
      if (res.ok) {
        fetchPrompts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const confirmDelete = (prompt) => {
    setPromptToDelete(prompt);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!promptToDelete) return;
    
    try {
      const res = await fetch(`${API_URL}/api/prompts/${promptToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPrompts();
      } else {
        const err = await res.json();
        alert(err.detail || "שגיאה במחיקת הפרומפט");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsModalOpen(false);
      setPromptToDelete(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">טוען...</div>;

  return (
    <div className="w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-center bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-900">GoldenCare Backoffice - ניהול פרומפטים</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Create Form */}
        <div className="bg-white p-5 md:p-6 rounded-lg shadow border border-gray-100 h-fit">
          <h2 className="text-lg md:text-xl font-semibold mb-4 border-b pb-2 text-gray-800">יצירת גרסה חדשה</h2>
          <form onSubmit={createPrompt} className="space-y-4">
            <div>
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
            <div>
              <div className="flex justify-between items-end mb-1">
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
                rows={6}
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-y"
                placeholder="הכנס את ההנחיות למודל ה-AI כאן..."
                dir="auto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">הערות שחרור (אופציונלי)</label>
              <input 
                type="text" 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                placeholder="מה השתנה בגרסה זו?"
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded hover:bg-blue-700 transition shadow-sm">
              שמור פרומפט
            </button>
          </form>
        </div>

        {/* Prompt History */}
        <div className="space-y-4">
          <h2 className="text-lg md:text-xl font-semibold mb-4 bg-white p-4 rounded shadow border border-gray-100 border-b pb-2 text-gray-800">היסטוריית גרסאות</h2>
          
          <div className="flex flex-col gap-4">
            {prompts.map(p => (
              <div key={p.id} className={`p-4 md:p-5 rounded-lg shadow-sm border transition ${p.is_active ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2 sm:gap-0">
                  <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {p.is_active ? (
                      <span className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold w-full sm:w-auto text-center shadow-sm">פעיל כעת</span>
                    ) : (
                      <>
                        <button onClick={() => activatePrompt(p.id)} className="flex-1 sm:flex-none text-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1 rounded transition font-medium">
                          הגדר כפעיל
                        </button>
                        <button onClick={() => confirmDelete(p)} className="text-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-1 rounded transition font-medium">
                          מחק
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded border border-gray-100 mb-3">
                  <p className="text-gray-600 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{p.content}</p>
                </div>
                {p.version_notes && (
                  <div className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded text-yellow-800">
                    <span className="font-bold">הערות: </span> {p.version_notes}
                  </div>
                )}
              </div>
            ))}
            
            {prompts.length === 0 && (
              <div className="bg-white p-8 rounded-lg shadow border border-gray-100 text-center">
                <p className="text-gray-500">אין פרומפטים שמורים במערכת.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={isModalOpen}
        title="מחיקת פרומפט"
        message={`האם אתה בטוח שברצונך למחוק את הפרומפט "${promptToDelete?.name}"? פעולה זו אינה הפיכה.`}
        confirmText="מחק"
        cancelText="בטל"
        onConfirm={handleDelete}
        onCancel={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default HomePage;
