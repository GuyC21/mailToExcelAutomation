/**
 * Desktop Navigation Bar Links & "AI & Management Tools" Dropdown.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { ADMIN_NAV_ITEM, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from './navConfig';

/**
 * Renders primary operational links and secondary tools dropdown on lg+ screens.
 * @component
 * @param {{
 *   isAdmin: boolean,
 *   isMoreActive: boolean,
 *   isMoreDropdownOpen: boolean,
 *   onToggleMoreDropdown: (e: React.MouseEvent) => void,
 *   moreDropdownRef: React.RefObject<HTMLDivElement>,
 *   onNavigate: () => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function DesktopNav({
  isAdmin,
  isMoreActive,
  isMoreDropdownOpen,
  onToggleMoreDropdown,
  moreDropdownRef,
  onNavigate,
}) {
  return (
    <div className="hidden lg:flex items-center gap-[0.4rem] xl:gap-[0.6rem] flex-1 justify-center px-[0.5rem] xl:px-[1rem]">
      {PRIMARY_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.id}
          to={item.path}
          onClick={onNavigate}
          className={({ isActive }) =>
            `px-[0.75rem] xl:px-[0.9rem] py-[0.45rem] rounded-xl text-[0.85rem] xl:text-[0.875rem] transition-all duration-150 whitespace-nowrap ${
              isActive
                ? 'bg-blue-100 text-blue-900 font-bold shadow-2xs'
                : 'font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-900'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}

      <div className="relative" ref={moreDropdownRef}>
        <button
          type="button"
          onClick={onToggleMoreDropdown}
          className={`flex items-center gap-1.5 px-[0.75rem] xl:px-[0.9rem] py-[0.45rem] rounded-xl text-[0.85rem] xl:text-[0.875rem] transition-all duration-150 whitespace-nowrap focus:outline-none cursor-pointer ${
            isMoreActive
              ? 'bg-blue-100 text-blue-900 font-bold border border-blue-200'
              : isMoreDropdownOpen
                ? 'bg-gray-100 text-gray-900 font-semibold'
                : 'font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-900'
          }`}
          aria-expanded={isMoreDropdownOpen}
          aria-haspopup="true"
          aria-label="כלי AI וניהול נוספים"
        >
          <span>כלי AI וניהול</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isMoreDropdownOpen ? 'rotate-180 text-blue-700' : 'text-gray-400'
            }`}
          />
        </button>

        {isMoreDropdownOpen && (
          <div
            className="absolute top-full right-0 mt-2 w-[18rem] bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              מעבדת AI ומודלים
            </div>
            {SECONDARY_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `block px-4 py-2 transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-blue-900'
                  }`
                }
              >
                <div className="text-[13px] font-semibold leading-tight">{item.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 leading-tight font-normal">{item.description}</div>
              </NavLink>
            ))}

            {isAdmin && (
              <>
                <div className="my-1.5 border-t border-gray-100" />
                <div className="px-4 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>ניהול מערכת</span>
                  <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-semibold">
                    מנהל
                  </span>
                </div>
                <NavLink
                  to={ADMIN_NAV_ITEM.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `block px-4 py-2 transition-all ${
                      isActive
                        ? 'bg-purple-50 text-purple-900 font-bold border-r-4 border-purple-600'
                        : 'text-gray-700 hover:bg-purple-50/50 hover:text-purple-900'
                    }`
                  }
                >
                  <div className="text-[13px] font-semibold leading-tight">{ADMIN_NAV_ITEM.label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 leading-tight font-normal">
                    {ADMIN_NAV_ITEM.description}
                  </div>
                </NavLink>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
