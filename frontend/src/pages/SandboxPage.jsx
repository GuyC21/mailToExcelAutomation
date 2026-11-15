import { useState } from 'react';
import ModeTabs from '../components/sandbox/ModeTabs';
import EmailComposer from '../components/sandbox/EmailComposer';
import FileUploadPanel from '../components/sandbox/FileUploadPanel';
import EmailPayloadCard from '../components/sandbox/EmailPayloadCard';
import ExtractionResultCard from '../components/sandbox/ExtractionResultCard';
import ResultsPlaceholder from '../components/sandbox/ResultsPlaceholder';
import ExcelPreviewPanel from '../components/sandbox/ExcelPreviewPanel';
import BYOKStatusBadge from '../components/byok/BYOKStatusBadge';
import { useIngestion } from '../hooks/useIngestion';
import { useEmailInbound } from '../hooks/useEmailInbound';
import { useExcelPreview } from '../hooks/useExcelPreview';

/**
 * SandboxPage Component
 * 
 * Orchestrates the end-to-end sandbox testing environment for data extraction.
 * This component intentionally holds no direct business logic or API calls; 
 * instead, it acts as a coordinator between the UI modes (Email vs Direct Upload) 
 * and delegates all I/O operations to custom hooks (`useIngestion`, `useEmailInbound`, `useExcelPreview`).
 * This separation ensures the UI remains declarative and easy to test.
 * 
 * @component
 * @returns {JSX.Element} The rendered Sandbox page.
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
    <div className="w-full max-w-full overflow-hidden">
      <header className="mb-[1.5rem] bg-white p-[1rem] sm:p-[1.25rem] md:p-[1.5rem] rounded-xl shadow-xs border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-[0.75rem]">
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(1.15rem,3.8vw,1.75rem)] font-bold text-blue-900 leading-snug">
            טסטר חילוץ נתונים (Sandbox)
          </h1>
          <p className="text-gray-500 mt-[0.25rem] text-[clamp(0.75rem,2.2vw,0.875rem)] leading-relaxed">
            הדמיה מלאה של התהליך: מייל מספק נכנס ← ה-AI מחלץ ובודק את הטופס ← השורה נוספת לקובץ האקסל.
          </p>
        </div>
        <div className="flex-shrink-0 self-start sm:self-auto">
          <BYOKStatusBadge />
        </div>
      </header>

      <ModeTabs mode={mode} onChange={setMode} disabled={isRunning} />

      <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-[1rem] sm:gap-[1.5rem] mb-[1.5rem] w-full max-w-full">
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

        <div className="lg:col-span-7 w-full lg:max-h-[850px] overflow-y-auto pl-2 pb-2 custom-scrollbar space-y-4">
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
