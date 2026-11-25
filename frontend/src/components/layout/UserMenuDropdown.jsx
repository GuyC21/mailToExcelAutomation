/**
 * Desktop User Avatar Button & Profile Popover Menu.
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Renders the desktop authenticated user dropdown and sign-out control.
 * @component
 * @param {{
 *   userInitial: string,
 *   displayName: string,
 *   email?: string,
 *   roleLabel: string,
 *   isAdmin: boolean,
 *   isOpen: boolean,
 *   onToggle: (e: React.MouseEvent) => void,
 *   dropdownRef: React.RefObject<HTMLDivElement>,
 *   onLogout: () => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function UserMenuDropdown({
  userInitial,
  displayName,
  email,
  roleLabel,
  isAdmin,
  isOpen,
  onToggle,
  dropdownRef,
  onLogout,
}) {
  return (
    <div className="hidden lg:block relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-[0.625rem] py-[0.375rem] px-[0.625rem] rounded-xl border border-gray-200 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="תפריט משתמש"
      >
        <div className="w-[2rem] h-[2rem] rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[0.75rem] font-bold select-none">
          {userInitial}
        </div>
        <div className="text-right">
          <div className="text-[0.75rem] font-bold text-gray-800 leading-tight truncate max-w-[7.5rem]">
            {displayName}
          </div>
          <div className="text-[0.625rem] text-gray-400 leading-none">{roleLabel}</div>
        </div>
        <ChevronDown
          className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-700' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-[16rem] bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="text-sm font-bold text-gray-900 truncate">{displayName}</div>
            <div className="text-xs text-gray-500 truncate mt-0.5">{email}</div>
            <div className="mt-2">
              <span
                className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  isAdmin
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              onClick={onLogout}
              className="w-full text-right px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
            >
              התנתק מהמערכת
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
