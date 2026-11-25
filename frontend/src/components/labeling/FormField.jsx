import { useId } from 'react';

/**
 * A labeled text, number, or date input with accessible label association.
 * @component
 * @param {{
 *   label: string,
 *   value: string|number|null|undefined,
 *   onChange: (value: string) => void,
 *   type?: string,
 *   placeholder?: string,
 *   required?: boolean,
 *   className?: string,
 * }} props
 * @returns {JSX.Element}
 */
const FormField = ({ label, value, onChange, type = 'text', placeholder = '', required = false, className = '' }) => {
  const inputId = useId();

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={inputId}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={type === 'number' ? 'any' : undefined}
        dir={type === 'number' || type === 'date' ? 'ltr' : undefined}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
      />
    </div>
  );
};

export default FormField;
