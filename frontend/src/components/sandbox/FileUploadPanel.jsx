import { useState } from 'react';
import FilePicker from './FilePicker';

/**
 * Direct upload of a single form, bypassing the email layer.
 * @param {{onRun: (file: File) => void, isRunning: boolean}} props
 */
const FileUploadPanel = ({ onRun, isRunning }) => {
  const [files, setFiles] = useState([]);

  return (
    <div className="bg-white p-5 md:p-6 rounded-lg shadow border border-gray-100">
      <h2 className="text-lg font-semibold mb-1 text-gray-800">העלאת טופס לבדיקה</h2>
      <p className="text-sm text-gray-500 mb-4">הטופס ירוץ דרך אותו תהליך בדיוק כמו מייל אמיתי, עם הפרומפט הפעיל.</p>
      <FilePicker
        files={files}
        onChange={(selected) => setFiles(selected.slice(0, 1))}
        accept=".pdf,image/*"
        placeholder="לחץ לבחירת קובץ PDF או תמונה"
        icon="📄"
      />
      <button
        type="button"
        onClick={() => onRun(files[0])}
        disabled={!files.length || isRunning}
        className="w-full mt-4 bg-blue-600 text-white font-medium py-2.5 px-4 rounded hover:bg-blue-700 transition shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isRunning ? 'מעבד מסמך...' : 'בצע חילוץ נתונים'}
      </button>
    </div>
  );
};

export default FileUploadPanel;
