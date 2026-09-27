import { useState } from 'react';
import ModeTabs from '../components/sandbox/ModeTabs';
import EmailComposer from '../components/sandbox/EmailComposer';
import FileUploadPanel from '../components/sandbox/FileUploadPanel';
import EmailPayloadCard from '../components/sandbox/EmailPayloadCard';
import ExtractionResultCard from '../components/sandbox/ExtractionResultCard';
import ResultsPlaceholder from '../components/sandbox/ResultsPlaceholder';
import ExcelPreviewPanel from '../components/sandbox/ExcelPreviewPanel';
import { useIngestion } from '../hooks/useIngestion';
import { useEmailInbound } from '../hooks/useEmailInbound';
import { useExcelPreview } from '../hooks/useExcelPreview';

/**
 * Sample Runner – orchestrates the email simulation / direct upload flows and
 * the live Excel view. Holds no business logic; all I/O lives in hooks.
 */
const SandboxPage = () => {
  const [mode, setMode] = useState('email');
  const upload = useIngestion();
  const inbound = useEmailInbound();
  const excel = useExcelPreview();

  const isRunning = upload.isUploading || inbound.isSending;
  const results = mode === 'email' ? inbound.response?.results || [] : upload.result ? [upload.result] : [];
  const error = mode === 'email' ? inbound.error : upload.error;
  const highlightIds = results.map((r) => r.ingestion_id).filter(Boolean);

  const afterRun = async (promise) => {
    await promise;
    excel.refresh();
  };

  return (
    <div className="w-full">
      <header className="mb-6 bg-white p-4 md:p-6 rounded-lg shadow border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-900">טסטר חילוץ נתונים (Sandbox)</h1>
        <p className="text-gray-500 mt-1 text-sm md:text-base">
          הדמיה מלאה של התהליך: מייל מספק נכנס ← ה-AI מחלץ ובודק את הטופס ← השורה נוספת לקובץ האקסל.
        </p>
      </header>

      <ModeTabs mode={mode} onChange={setMode} disabled={isRunning} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <div className="lg:col-span-5">
          {mode === 'email' ? (
            <EmailComposer
              isSending={inbound.isSending}
              onSendComposed={(email) => afterRun(inbound.sendComposedEmail(email))}
              onSendEml={(file) => afterRun(inbound.sendEmlFile(file))}
            />
          ) : (
            <FileUploadPanel isRunning={upload.isUploading} onRun={(file) => afterRun(upload.uploadFile(file))} />
          )}
        </div>

        <div className="lg:col-span-7 space-y-4">
          {isRunning || error || !results.length ? (
            <ResultsPlaceholder isRunning={isRunning} error={error} mode={mode} />
          ) : (
            <>
              {mode === 'email' && inbound.response && (
                <EmailPayloadCard email={inbound.response.email} results={results} />
              )}
              {results.map((result, idx) => (
                <ExtractionResultCard key={result.ingestion_id ?? `${result.filename}-${idx}`} result={result} />
              ))}
            </>
          )}
        </div>
      </div>

      <ExcelPreviewPanel
        preview={excel.preview}
        isLoading={excel.isLoading}
        error={excel.error}
        downloadUrl={excel.downloadUrl}
        highlightIds={highlightIds}
        onRefresh={excel.refresh}
      />
    </div>
  );
};

export default SandboxPage;
