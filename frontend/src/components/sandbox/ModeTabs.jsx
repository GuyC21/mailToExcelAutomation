const MODES = [
  { id: 'email', label: '📧 סימולציית מייל נכנס' },
  { id: 'file', label: '📄 העלאת קובץ ישירה' },
];

/**
 * Switches the Sandbox between the email flow and a direct file upload.
 * @param {{mode: string, onChange: (mode: string) => void, disabled?: boolean}} props
 */
const ModeTabs = ({ mode, onChange, disabled }) => (
  <div className="flex flex-col sm:flex-row gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-gray-100 mb-6">
    {MODES.map((m) => (
      <button
        key={m.id}
        type="button"
        disabled={disabled}
        onClick={() => onChange(m.id)}
        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-60 ${
          mode === m.id ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        {m.label}
      </button>
    ))}
  </div>
);

export default ModeTabs;
