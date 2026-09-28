/**
 * A labeled text/number/date input, styled to match the rest of the Backoffice forms.
 * @param {{label: string, value: string|number|null|undefined, onChange: (value: string) => void,
 *   type?: string, placeholder?: string, required?: boolean, className?: string}} props
 */
const FormField = ({ label, value, onChange, type = 'text', placeholder = '', required = false, className = '' }) => (
  <div className={className}>
    <label className="block text-xs text-gray-500 mb-1">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      step={type === 'number' ? 'any' : undefined}
      dir={type === 'number' || type === 'date' ? 'ltr' : undefined}
      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
    />
  </div>
);

export default FormField;
