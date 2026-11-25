import { useEffect, useState } from 'react';
import CaseList from '../components/labeling/CaseList';
import DocumentPreview from '../components/labeling/DocumentPreview';
import LabelForm from '../components/labeling/LabelForm';
import ConfirmModal from '../components/ConfirmModal';
import { useRegressionCases } from '../hooks/useRegressionCases';

/**
 * LabelingPage ("תיוג") Component
 *
 * Orchestrates ground-truth case selection, previewing, creation/updating, and deletion.
 * @component
 * @returns {JSX.Element}
 */
export default function LabelingPage() {
  const { cases, error, refresh, loadCase, saveCase, deleteCase, documentUrl } = useRegressionCases();
  const [selectedName, setSelectedName] = useState(null);
  const [caseName, setCaseName] = useState('');
  const [initialExpected, setInitialExpected] = useState(null);
  const [selectedMimeType, setSelectedMimeType] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [caseToDelete, setCaseToDelete] = useState(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetFeedback = () => {
    setSaveError(null);
    setSuccessMessage(null);
    setWarnings([]);
  };

  const startNewCase = () => {
    setSelectedName(null);
    setCaseName('');
    setInitialExpected(null);
    setSelectedMimeType(null);
    setPreviewFile(null);
    resetFeedback();
  };

  const openCase = async (name) => {
    resetFeedback();
    try {
      const data = await loadCase(name);
      setSelectedName(name);
      setCaseName(name);
      setInitialExpected(data.expected);
      setSelectedMimeType(data.mime_type);
      setPreviewFile(null);
    } catch (err) {
      setSaveError(err.message);
    }
  };

  const handleSubmit = async (file, expected) => {
    setIsSaving(true);
    resetFeedback();
    try {
      const result = await saveCase({ caseName, file, expected });
      setWarnings(result.warnings || []);
      setSuccessMessage(`התיוג "${result.case.name}" נשמר בהצלחה בחבילת הרגרסיה.`);
      setInitialExpected(result.case.expected);
      setSelectedMimeType(result.case.mime_type);
      setCaseName(result.case.name);
      setPreviewFile(null);
      setSelectedName(result.case.name);
      await refresh();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!caseToDelete) return;
    const name = caseToDelete;
    setCaseToDelete(null);
    try {
      await deleteCase(name);
      if (selectedName === name) startNewCase();
      await refresh();
    } catch (err) {
      setSaveError(err.message);
    }
  };

  const isNewCase = !selectedName;
  const previewUrl = selectedName && !previewFile ? documentUrl(selectedName) : null;

  return (
    <div className="w-full space-y-6">
      <header className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-900">תיוג מסמכים (Ground Truth)</h1>
        <p className="text-gray-500 mt-1 text-sm md:text-base">
          תעתוק ידני של מסמך מקור לנתונים נכונים, ליצירה או עדכון של תיק בחבילת בדיקות הרגרסיה.
        </p>
      </header>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
      {successMessage && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{successMessage}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-3 order-2 lg:order-1">
          <CaseList cases={cases} selectedName={selectedName} onSelect={openCase} onNew={startNewCase} onDelete={setCaseToDelete} />
        </div>

        <div className="lg:col-span-4 order-1 lg:order-2">
          <DocumentPreview file={previewFile} url={previewUrl} mimeType={selectedMimeType} />
        </div>

        <div className="lg:col-span-5 order-3">
          <LabelForm
            key={selectedName || 'new'}
            caseName={caseName}
            onCaseNameChange={setCaseName}
            isNewCase={isNewCase}
            initialExpected={initialExpected}
            onFileSelected={setPreviewFile}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            warnings={warnings}
            saveError={saveError}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(caseToDelete)}
        title="מחיקת תיק רגרסיה"
        message={`למחוק את התיק "${caseToDelete || ''}"? הפעולה אינה הפיכה.`}
        confirmText="מחק"
        cancelText="בטל"
        onConfirm={handleConfirmDelete}
        onCancel={() => setCaseToDelete(null)}
      />
    </div>
  );
}
