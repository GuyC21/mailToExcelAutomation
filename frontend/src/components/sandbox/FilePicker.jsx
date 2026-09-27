import { useRef } from 'react';
import { formatBytes } from '../../utils/format';

/**
 * Click-to-choose drop zone showing the selected file names.
 * @param {{files: File[], onChange: (files: File[]) => void, accept: string,
 *   multiple?: boolean, placeholder: string, icon?: string}} props
 */
const FilePicker = ({ files, onChange, accept, multiple = false, placeholder, icon = '📎' }) => {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    onChange(Array.from(e.target.files || []));
    e.target.value = ''; // allow re-selecting the same file
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition"
    >
      <input ref={inputRef} type="file" className="hidden" accept={accept} multiple={multiple} onChange={handleChange} />
      <div className="text-2xl mb-1">{icon}</div>
      {files.length === 0 ? (
        <p className="text-sm text-gray-500">{placeholder}</p>
      ) : (
        <ul className="text-sm text-blue-800 space-y-0.5">
          {files.map((f) => (
            <li key={f.name} className="break-all">
              {f.name} <span className="text-gray-400 text-xs">({formatBytes(f.size)})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FilePicker;
