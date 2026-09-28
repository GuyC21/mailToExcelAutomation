import { useEffect, useState } from 'react';
import CaseList from '../components/labeling/CaseList';
import DocumentPreview from '../components/labeling/DocumentPreview';
import LabelForm from '../components/labeling/LabelForm';
import { useRegressionCases } from '../hooks/useRegressionCases';

/**
 * LabelingPage ("תיוג") Component
 *
 * Lets a person manually transcribe a document's fields to create or correct
 * a regression ground-truth case, instead of a developer hand-writing JSON
 * into `data/regression_suite/`. This is the write side of the regression
 * suite; `RegressionPage` (`/regression`) is the read/run side that scores
 * the AI's extraction against whatever gets saved here.
 *
 * The page itself only orchestrates: case selection lives here, all API
 * access is delegated to `useRegressionCases`, and the form's own field
 * state lives inside `LabelForm` (remounted via `key` on case switch).
 *
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

  useEffect(() => { refresh(); }, [refresh]);

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
      // Seed the (re-keyed) form with what was actually stored *before* the
      // selection changes, so it reopens populated - never blank - and a
      // second save can't overwrite the ground truth with empty values.
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

  const handleDelete = async (name) => {
    if (!window.confirm(`למחוק את התיק "${name}"? הפעולה אינה הפיכה.`)) return;
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
          <CaseList cases={cases} selectedName={selectedName} onSelect={openCase} onNew={startNewCase} onDelete={handleDelete} />
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
    </div>
  );
}
