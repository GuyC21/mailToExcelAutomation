/**
 * Invoice Review & Manual Validation Page (ReviewPage).
 * 
 * Enables finance operators to inspect ingested documents, cross-check AI-extracted fields
 * against the original invoice preview, manually correct values, and record reviewer
 * attribution (who approved/altered the invoice and when) with live Excel synchronization.
 * 
 * @component
 * @returns {JSX.Element}
 */
import React, { useEffect, useState } from 'react';
import { useDocuments } from '../hooks/useDocuments';
import DocumentPreview from '../components/labeling/DocumentPreview';
import { AlertCircle, CheckCircle, Trash2, Clock, Search, UserCheck, Bot } from 'lucide-react';

const STATUS_MAP = {
  VALID: { label: 'תקין', color: 'text-green-600 bg-green-50' },
  NEEDS_REVIEW: { label: 'דורש בדיקה', color: 'text-yellow-600 bg-yellow-50' },
  EXTRACTION_FAILED: { label: 'חילוץ נכשל', color: 'text-red-600 bg-red-50' }
};

/**
 * Formats an ISO datetime string into readable Hebrew localized date and time.
 * @param {string} dateStr 
 * @returns {string}
 */
const formatAuditDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export default function ReviewPage() {
  const { documents, loading, error, fetchDocuments, updateDocument, deleteDocument, getDocumentUrl } = useDocuments();
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [formData, setFormData] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    fetchDocuments(filter === 'ALL' ? null : filter);
    setSelectedDoc(null);
  }, [fetchDocuments, filter]);

  const handleSelect = (doc) => {
    setSelectedDoc(doc);
    setFormData(doc.extracted_data || {});
    setSaveStatus(null);
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (newStatus) => {
    try {
      setSaveStatus({ type: 'loading' });
      const res = await updateDocument(selectedDoc.id, {
        extracted_data: formData,
        status: newStatus
      });
      setSaveStatus({ type: 'success', message: 'נשמר בהצלחה והאקסל עודכן!' });
      
      // Update selected doc locally with server-assigned reviewer attribution
      const serverDoc = res?.document || {};
      setSelectedDoc(prev => ({
        ...prev,
        extracted_data: formData,
        status: newStatus,
        ...serverDoc
      }));
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק מסמך זה? פעולה זו תמחק אותו גם מקובץ האקסל.')) return;
    try {
      await deleteDocument(selectedDoc.id);
      setSelectedDoc(null);
    } catch (err) {
      alert(`שגיאה במחיקה: ${err.message}`);
    }
  };

  return (
    <div className="w-full space-y-6">
      <header className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100 flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">בקרת חשבוניות</h1>
          <p className="text-gray-500 mt-1">סקירה, עריכה, ומחיקה של נתונים שחולצו לפני כניסתם לאקסל</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm text-sm"
          >
            <option value="ALL">כל המסמכים</option>
            <option value="NEEDS_REVIEW">דורש בדיקה</option>
            <option value="VALID">תקין</option>
            <option value="EXTRACTION_FAILED">נכשל</option>
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Document List Sidebar */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-lg shadow-sm h-[800px] overflow-y-auto">
          <div className="p-4 border-b border-gray-100 sticky top-0 bg-white font-medium text-gray-700">
            מסמכים אחרונים ({documents.length})
          </div>
          {loading ? (
            <div className="p-4 text-center text-gray-500">טוען...</div>
          ) : error ? (
            <div className="p-4 text-red-500 text-sm">{error}</div>
          ) : documents.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">אין מסמכים להצגה</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {documents.map(doc => (
                <div 
                  key={doc.id} 
                  onClick={() => handleSelect(doc)}
                  className={`p-4 cursor-pointer hover:bg-blue-50 transition ${selectedDoc?.id === doc.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm truncate w-32">{doc.filename}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_MAP[doc.status]?.color || 'bg-gray-100'}`}>
                      {STATUS_MAP[doc.status]?.label || doc.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex justify-between">
                    <span className="truncate max-w-[120px]">{doc.extracted_data?.supplier_name || 'ספק לא ידוע'}</span>
                    <span>₪{doc.extracted_data?.total_amount || '0'}</span>
                  </div>
                  {doc.updated_by && (
                    <div className="text-[11px] text-blue-700 mt-1.5 flex items-center gap-1 font-medium">
                      <UserCheck className="w-3 h-3 text-blue-600 flex-shrink-0" />
                      <span className="truncate max-w-[170px]">
                        {doc.updated_by.full_name || doc.updated_by.email}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Document Preview */}
        <div className="lg:col-span-5 h-[800px]">
          {selectedDoc ? (
            <DocumentPreview url={getDocumentUrl(selectedDoc.id)} />
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full flex flex-col items-center justify-center text-gray-400">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p>בחר מסמך מהרשימה להצגה</p>
            </div>
          )}
        </div>

        {/* Editor Form */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-lg shadow-sm p-6 h-[800px] overflow-y-auto">
          {selectedDoc ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-xl font-bold text-gray-800">עריכת נתונים</h2>
                <button 
                  onClick={handleDelete}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
                  title="מחק מסמך"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Reviewer Audit Attribution Badge */}
              {selectedDoc.updated_by ? (
                <div className="bg-blue-50/80 border border-blue-200/90 rounded-lg p-3 text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-blue-100 rounded-full text-blue-700">
                      <UserCheck className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-gray-500">נערך ע״י: </span>
                      <span className="font-semibold text-blue-900">{selectedDoc.updated_by.full_name || selectedDoc.updated_by.email}</span>
                      {selectedDoc.updated_by.full_name && selectedDoc.updated_by.email && (
                        <span className="text-gray-400 text-[11px] block sm:inline sm:mr-1">({selectedDoc.updated_by.email})</span>
                      )}
                    </div>
                  </div>
                  {selectedDoc.updated_at && (
                    <span className="text-blue-700 font-mono text-[11px] self-end sm:self-auto bg-blue-100/60 px-2 py-0.5 rounded">
                      {formatAuditDate(selectedDoc.updated_at)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-500 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-gray-400" />
                  <span>קליטה אוטומטית (טרם נערך ידנית)</span>
                </div>
              )}

              {selectedDoc.issues && selectedDoc.issues.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
                  <h3 className="font-semibold mb-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    הערות חילוץ:
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedDoc.issues.map((i, idx) => <li key={idx}>{i.message}</li>)}
                  </ul>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ספק</label>
                  <input type="text" value={formData.supplier_name || ''} onChange={(e) => handleFieldChange('supplier_name', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ח.פ.</label>
                  <input type="text" value={formData.supplier_tax_id || ''} onChange={(e) => handleFieldChange('supplier_tax_id', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר מסמך</label>
                  <input type="text" value={formData.document_number || ''} onChange={(e) => handleFieldChange('document_number', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">תאריך</label>
                    <input type="date" value={formData.document_date || ''} onChange={(e) => handleFieldChange('document_date', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מטבע</label>
                    <input type="text" value={formData.currency || ''} onChange={(e) => handleFieldChange('currency', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                
                <hr className="my-4" />
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">לפני מע"מ</label>
                    <input type="number" step="0.01" value={formData.subtotal || 0} onChange={(e) => handleFieldChange('subtotal', parseFloat(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">מע"מ</label>
                    <input type="number" step="0.01" value={formData.vat_amount || 0} onChange={(e) => handleFieldChange('vat_amount', parseFloat(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">סה"כ</label>
                    <input type="number" step="0.01" value={formData.total_amount || 0} onChange={(e) => handleFieldChange('total_amount', parseFloat(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm font-bold bg-blue-50" />
                  </div>
                </div>
              </div>

              {saveStatus?.message && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${saveStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {saveStatus.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {saveStatus.message}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button 
                  onClick={() => handleSave('VALID')}
                  disabled={saveStatus?.type === 'loading'}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  שמור כתקין
                </button>
                <button 
                  onClick={() => handleSave('NEEDS_REVIEW')}
                  disabled={saveStatus?.type === 'loading'}
                  className="flex-1 bg-yellow-500 text-white py-2 px-4 rounded-md font-medium hover:bg-yellow-600 transition disabled:opacity-50"
                >
                  השאר לבדיקה
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <p>בחר מסמך לעריכה</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
