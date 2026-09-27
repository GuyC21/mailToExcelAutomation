import { useState, useEffect, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import ViewModal from '../components/ViewModal';
import PromptCard from '../components/PromptCard';
import HistoryModal from '../components/HistoryModal';
import PromptForm from '../components/PromptForm';
import { usePrompts } from '../hooks/usePrompts';

const HomePage = () => {
  const { prompts, loading, fetchPrompts, activatePrompt, deletePrompt, getTechnicalPrompt } = usePrompts();
  const formRef = useRef(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [technicalPromptContent, setTechnicalPromptContent] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const confirmDelete = (prompt) => {
    setPromptToDelete(prompt);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!promptToDelete) return;
    const result = await deletePrompt(promptToDelete.id);
    if (!result.success) {
      alert(result.error);
    }
    setIsModalOpen(false);
    setPromptToDelete(null);
  };

  const fetchTechnicalPrompt = async (id) => {
    const result = await getTechnicalPrompt(id);
    if (result.success) {
      setTechnicalPromptContent(result.content);
      setIsViewModalOpen(true);
    } else {
      alert(result.error);
    }
  };

  const handleDuplicate = (prompt) => {
    if (formRef.current) {
      formRef.current.populateForm(`${prompt.name} (עותק)`, prompt.content);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">טוען...</div>;

  return (
    <div className="w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-center bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-900">GoldenCare Backoffice - ניהול פרומפטים</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:h-[680px]">
        
        {/* Create Form - Extracted to isolated component */}
        <PromptForm ref={formRef} onSuccess={fetchPrompts} />

        {/* Prompt History */}
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4 bg-white p-4 rounded shadow border border-gray-100 border-b pb-2 shrink-0">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">היסטוריית גרסאות</h2>
            {prompts.length > 2 && (
              <button 
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded transition font-medium"
              >
                הרחב רשימה (מסך מלא)
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-4 overflow-y-auto pr-2 pb-2 flex-1">
            {prompts.map(p => (
              <PromptCard 
                key={p.id}
                prompt={p}
                onDuplicate={handleDuplicate}
                onActivate={activatePrompt}
                onDelete={confirmDelete}
                onViewTechnical={fetchTechnicalPrompt}
              />
            ))}
            
            {prompts.length === 0 && (
              <div className="bg-white p-8 rounded-lg shadow border border-gray-100 text-center mt-4 shrink-0">
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

      <ViewModal
        isOpen={isViewModalOpen}
        title="תצוגת פרומפט מערכת (System Envelope)"
        content={technicalPromptContent}
        onClose={() => setIsViewModalOpen(false)}
      />

      <HistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        prompts={prompts}
        onDuplicate={handleDuplicate}
        onActivate={activatePrompt}
        onDelete={confirmDelete}
        onViewTechnical={fetchTechnicalPrompt}
      />
    </div>
  );
};

export default HomePage;
