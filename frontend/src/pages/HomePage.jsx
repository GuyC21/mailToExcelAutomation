import { useState, useEffect, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import ViewModal from '../components/ViewModal';
import HistoryModal from '../components/HistoryModal';
import PromptForm from '../components/PromptForm';
import PromptVersionList from '../components/PromptVersionList';
import { usePrompts } from '../hooks/usePrompts';

/**
 * HomePage (Prompt Management) Component
 *
 * Orchestrates business prompt versioning, AI enhancement, technical envelope
 * inspection, activation, and safe deletion via `usePrompts`.
 * @component
 * @returns {JSX.Element}
 */
const HomePage = () => {
  const {
    prompts,
    loading,
    error,
    fetchPrompts,
    createPrompt,
    activatePrompt,
    deletePrompt,
    getTechnicalPrompt,
    enhancePrompt,
  } = usePrompts();
  const formRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [technicalPromptContent, setTechnicalPromptContent] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const confirmDelete = (prompt) => {
    setActionError('');
    setPromptToDelete(prompt);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!promptToDelete) return;
    const result = await deletePrompt(promptToDelete.id);
    if (!result.success) setActionError(result.error);
    setIsModalOpen(false);
    setPromptToDelete(null);
  };

  const handleActivate = async (id) => {
    setActionError('');
    const result = await activatePrompt(id);
    if (!result.success) setActionError(result.error);
  };

  const fetchTechnicalPrompt = async (id) => {
    setActionError('');
    const result = await getTechnicalPrompt(id);
    if (result.success) {
      setTechnicalPromptContent(result.content);
      setIsViewModalOpen(true);
    } else {
      setActionError(result.error);
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
      <header className="mb-6 md:mb-8 bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-900">ניהול פרומפטים</h1>
        <p className="text-gray-500 mt-1 text-sm md:text-base">
          עריכה, שיפור וניהול גרסאות של הנחיות החילוץ העסקיות למנוע ה-AI
        </p>
      </header>

      {(error || actionError) && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {actionError || error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:h-[680px]">
        <PromptForm ref={formRef} onCreate={createPrompt} onEnhance={enhancePrompt} />
        <PromptVersionList
          prompts={prompts}
          onExpandHistory={() => setIsHistoryModalOpen(true)}
          onDuplicate={handleDuplicate}
          onActivate={handleActivate}
          onDelete={confirmDelete}
          onViewTechnical={fetchTechnicalPrompt}
        />
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
        onActivate={handleActivate}
        onDelete={confirmDelete}
        onViewTechnical={fetchTechnicalPrompt}
      />
    </div>
  );
};

export default HomePage;
