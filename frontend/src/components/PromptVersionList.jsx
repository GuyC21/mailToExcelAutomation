import React from 'react';
import PromptCard from './PromptCard';

/**
 * PromptVersionList Component
 *
 * Displays the scrollable right-hand column of prompt versions with quick expand trigger.
 * @component
 * @param {{
 *   prompts: object[],
 *   onExpandHistory: () => void,
 *   onDuplicate: (prompt: object) => void,
 *   onActivate: (id: number) => void,
 *   onDelete: (prompt: object) => void,
 *   onViewTechnical: (id: number) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function PromptVersionList({
  prompts,
  onExpandHistory,
  onDuplicate,
  onActivate,
  onDelete,
  onViewTechnical,
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-4 bg-white p-4 rounded shadow border border-gray-100 border-b pb-2 shrink-0">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800">היסטוריית גרסאות</h2>
        {prompts.length > 2 && (
          <button
            type="button"
            onClick={onExpandHistory}
            className="text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded transition font-medium"
          >
            הרחב רשימה (מסך מלא)
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto pr-2 pb-2 flex-1">
        {prompts.map((p) => (
          <PromptCard
            key={p.id}
            prompt={p}
            onDuplicate={onDuplicate}
            onActivate={onActivate}
            onDelete={onDelete}
            onViewTechnical={onViewTechnical}
          />
        ))}

        {prompts.length === 0 && (
          <div className="bg-white p-8 rounded-lg shadow border border-gray-100 text-center mt-4 shrink-0">
            <p className="text-gray-500">אין פרומפטים שמורים במערכת.</p>
          </div>
        )}
      </div>
    </div>
  );
}
