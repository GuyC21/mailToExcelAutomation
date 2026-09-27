/** Colour-coded pipeline status, matching the Excel status colours. */
const STATUS = {
  VALID: { label: 'תקין', className: 'bg-green-100 text-green-800 border-green-200' },
  NEEDS_REVIEW: { label: 'דורש בדיקה', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  EXTRACTION_FAILED: { label: 'חילוץ נכשל', className: 'bg-red-100 text-red-800 border-red-200' },
  SKIPPED: { label: 'לא עובד', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/**
 * @param {{status: string}} props - VALID | NEEDS_REVIEW | EXTRACTION_FAILED | SKIPPED
 */
const StatusBadge = ({ status }) => {
  const config = STATUS[status] || { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${config.className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
