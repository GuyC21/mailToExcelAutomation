/**
 * Loading / empty / error states of the results column.
 * @param {{isRunning: boolean, error?: string, mode: string}} props
 */
const ResultsPlaceholder = ({ isRunning, error, mode }) => {
  if (isRunning) {
    return (
      <div className="bg-white p-12 rounded-lg shadow border border-gray-100 flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-600 font-medium animate-pulse">
          {mode === 'email' ? 'המייל התקבל – ה-AI מנתח את הקבצים המצורפים...' : 'ה-AI מנתח את המסמך...'}
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
        <span className="font-bold">שגיאה: </span>{error}
      </div>
    );
  }
  return (
    <div className="bg-gray-50 p-12 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center min-h-[300px] text-gray-400 text-center">
      <div className="text-5xl mb-4">✨</div>
      <p>{mode === 'email' ? 'שלח מייל כדי לראות את כל הדרך: מייל ← חילוץ ← אקסל' : 'התוצאות יופיעו כאן לאחר סיום החילוץ'}</p>
    </div>
  );
};

export default ResultsPlaceholder;
