/**
 * Invoice Review & Manual Validation Orchestrator Page (ReviewPage).
 */
import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useDocuments } from '../hooks/useDocuments';
import DocumentPreview from '../components/labeling/DocumentPreview';
import DocumentListSidebar from '../components/review/DocumentListSidebar';
import ReviewEditorForm from '../components/review/ReviewEditorForm';
import ConfirmModal from '../components/ConfirmModal';

/**
 * Orchestrates invoice inspection, previewing, inline correction, and deletion.
 * @component
 * @returns {JSX.Element} The rendered Review page.
 */
export default function ReviewPage() {
  const { documents, loading, error, fetchDocuments, updateDocument, deleteDocument, getDocumentUrl } = useDocuments();
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [saveStatus, setSaveStatus] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    fetchDocuments(filter === 'ALL' ? null : filter);
  }, [fetchDocuments, filter]);

  const handleFilterChange = (nextFilter) => {
    setFilter(nextFilter);
    setSelectedDoc(null);
    setSaveStatus(null);
  };

  const handleSelect = (doc) => {
    setSelectedDoc(doc);
    setSaveStatus(null);
  };

  const handleSave = async (extractedData, newStatus) => {
    if (!selectedDoc) return;
    setSaveStatus({ type: 'loading' });
    try {
      const res = await updateDocument(selectedDoc.id, { extracted_data: extractedData, status: newStatus }, filter);
      const serverDoc = res?.document || {};
      const finalStatus = serverDoc.status || newStatus;

      if (filter !== 'ALL' && finalStatus !== filter) {
        setSelectedDoc(null);
        setSaveStatus(null);
        return;
      }

      setSaveStatus({ type: 'success', message: 'נשמר בהצלחה והאקסל עודכן!' });
      setSelectedDoc((prev) => (prev ? { ...prev, extracted_data: extractedData, status: finalStatus, ...serverDoc } : null));
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message });
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedDoc) return;
    const targetId = selectedDoc.id;
    setIsDeleteModalOpen(false);
    try {
      await deleteDocument(targetId);
      setSelectedDoc(null);
      setSaveStatus(null);
    } catch (err) {
      setSaveStatus({ type: 'error', message: `שגיאה במחיקה: ${err.message}` });
    }
  };

  return (
    <div className="w-full space-y-6">
      <header className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">בקרת חשבוניות</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">סקירה, עריכה, ומחיקה של נתונים שחולצו לפני כניסתם לאקסל</p>
        </div>
        <select
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
          aria-label="סינון מסמכים לפי סטטוס"
          className="border border-gray-300 rounded-md px-3 py-2 shadow-sm text-sm bg-white w-full sm:w-auto"
        >
          <option value="ALL">כל המסמכים</option>
          <option value="NEEDS_REVIEW">דורש בדיקה</option>
          <option value="VALID">תקין</option>
          <option value="EXTRACTION_FAILED">נכשל</option>
        </select>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <DocumentListSidebar
          documents={documents}
          selectedId={selectedDoc?.id ?? null}
          loading={loading}
          error={error}
          onSelect={handleSelect}
        />

        <div className="lg:col-span-5 min-h-[420px] lg:h-[780px]">
          {selectedDoc ? (
            <DocumentPreview url={getDocumentUrl(selectedDoc.id)} mimeType={selectedDoc.content_type} />
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full min-h-[420px] flex flex-col items-center justify-center text-gray-400">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p>בחר מסמך מהרשימה להצגה</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-6 h-auto lg:h-[780px] lg:overflow-y-auto">
          {selectedDoc ? (
            <ReviewEditorForm
              key={selectedDoc.id}
              doc={selectedDoc}
              saveStatus={saveStatus}
              onSave={handleSave}
              onRequestDelete={() => setIsDeleteModalOpen(true)}
            />
          ) : (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-gray-400">
              <p>בחר מסמך לעריכה</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="מחיקת מסמך"
        message={`האם אתה בטוח שברצונך למחוק את המסמך "${selectedDoc?.filename || ''}"? פעולה זו תמחק אותו גם מקובץ האקסל.`}
        confirmText="מחק"
        cancelText="בטל"
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
