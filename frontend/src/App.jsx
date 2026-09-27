import { useState, useEffect } from 'react'

function App() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');

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

  if (loading) return <div className="p-8 text-center">טוען...</div>;

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex justify-between items-center bg-white p-6 rounded-lg shadow">
        <h1 className="text-3xl font-bold text-blue-900">GoldenCare Backoffice - ניהול פרומפטים</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Form */}
        <div className="bg-white p-6 rounded-lg shadow h-fit">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">יצירת גרסה חדשה</h2>
          <form onSubmit={createPrompt} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">שם הגרסה</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full border rounded p-2 focus:ring focus:ring-blue-200"
                placeholder="למשל: פרומפט חשבוניות מעודכן"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">תוכן הפרומפט</label>
              <textarea 
                value={content}
                onChange={e => setContent(e.target.value)}
                required
                rows={8}
                className="w-full border rounded p-2 focus:ring focus:ring-blue-200"
                placeholder="הכנס את ההנחיות למודל ה-AI כאן..."
                dir="auto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">הערות שחרור (אופציונלי)</label>
              <input 
                type="text" 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border rounded p-2 focus:ring focus:ring-blue-200"
                placeholder="מה השתנה בגרסה זו?"
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2 rounded hover:bg-blue-700 transition">
              שמור פרומפט
            </button>
          </form>
        </div>

        {/* Prompt History */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4 bg-white p-4 rounded shadow border-b pb-2">היסטוריית גרסאות</h2>
          {prompts.map(p => (
            <div key={p.id} className={`p-4 rounded-lg shadow border ${p.is_active ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg">{p.name}</h3>
                {p.is_active ? (
                  <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">פעיל כעת</span>
                ) : (
                  <button onClick={() => activatePrompt(p.id)} className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded transition">
                    הגדר כפעיל
                  </button>
                )}
              </div>
              <p className="text-gray-600 text-sm whitespace-pre-wrap mb-3 max-h-32 overflow-y-auto">{p.content}</p>
              {p.version_notes && (
                <div className="text-xs bg-yellow-100 p-2 rounded text-yellow-800">
                  <span className="font-bold">הערות: </span> {p.version_notes}
                </div>
              )}
            </div>
          ))}
          {prompts.length === 0 && (
            <p className="text-gray-500 text-center py-4">אין פרומפטים שמורים במערכת.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
