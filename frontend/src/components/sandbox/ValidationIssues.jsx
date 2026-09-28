/**
 * Business-rule findings in plain Hebrew: errors (need review) then warnings.
 * @param {{issues: object[], error?: string}} props
 */
const ValidationIssues = ({ issues, error }) => {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity !== 'error');

  if (error) {
    return (
      <div className="p-3 bg-red-50 border-r-4 border-red-500 text-red-800 rounded text-sm">
        <p className="font-bold mb-1">החילוץ נכשל – המסמך נרשם באקסל לטיפול ידני</p>
        <p className="break-words">{error}</p>
      </div>
    );
  }
  if (!issues.length) {
    return <div className="p-3 bg-green-50 border-r-4 border-green-500 text-green-800 rounded text-sm">✓ כל בדיקות החישוב והשדות עברו בהצלחה</div>;
  }

  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <div className="p-3 bg-amber-50 border-r-4 border-amber-500 text-amber-900 rounded text-sm">
          <p className="font-bold mb-1">נמצאו {errors.length} בעיות הדורשות בדיקה</p>
          <ul className="list-disc pr-5 space-y-0.5">{errors.map((i, k) => <li key={k}>{i.message}</li>)}</ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="p-3 bg-slate-50 border-r-4 border-slate-300 text-slate-700 rounded text-sm">
          <p className="font-semibold mb-1">הערות</p>
          <ul className="list-disc pr-5 space-y-0.5">{warnings.map((i, k) => <li key={k}>{i.message}</li>)}</ul>
        </div>
      )}
    </div>
  );
};

export default ValidationIssues;
