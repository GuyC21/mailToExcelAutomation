/**
 * Responsive Mobile & Tablet Navigation Drawer (< 1024px).
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import BYOKStatusBadge from '../byok/BYOKStatusBadge';
import { ADMIN_NAV_ITEM, MENU_ANIMATION_SPEED_MS, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from './navConfig';

const linkClass = ({ isActive }) =>
  `flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150 min-h-[44px] ${
    isActive
      ? 'bg-blue-100 text-blue-900 font-bold border-r-4 border-blue-600'
      : 'font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-900'
  }`;

/**
 * Full-width categorized navigation drawer for mobile and tablet viewports.
 * @component
 * @param {{
 *   isOpen: boolean,
 *   isAuthenticated: boolean,
 *   isAdmin: boolean,
 *   userInitial: string,
 *   displayName: string,
 *   email?: string,
 *   roleLabel: string,
 *   onClose: () => void,
 *   onLogout: () => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function MobileDrawer({
  isOpen,
  isAuthenticated,
  isAdmin,
  userInitial,
  displayName,
  email,
  roleLabel,
  onClose,
  onLogout,
}) {
  return (
    <>
      <div
        className={`fixed inset-x-0 top-[3.75rem] sm:top-[4rem] h-[calc(100vh-3.75rem)] sm:h-[calc(100vh-4rem)] z-40 lg:hidden transition-opacity ease-in-out ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)', transitionDuration: `${MENU_ANIMATION_SPEED_MS}ms` }}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <div
        className={`relative z-50 lg:hidden bg-white border-b border-gray-200 shadow-2xl flex flex-col w-full transition-all ease-in-out origin-top ${
          isOpen ? 'opacity-100 translate-y-0 border-t border-gray-100 pointer-events-auto' : 'opacity-0 -translate-y-2 border-t-0 pointer-events-none overflow-hidden'
        }`}
        style={{ maxHeight: isOpen ? '85vh' : '0px', overflowY: isOpen ? 'auto' : 'hidden', transitionDuration: `${MENU_ANIMATION_SPEED_MS}ms` }}
        aria-hidden={!isOpen}
      >
        {isAuthenticated && (
          <>
            <div className="p-4 sm:p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between w-full flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base font-bold select-none shadow-xs flex-shrink-0">
                  {userInitial}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-gray-900 leading-tight truncate max-w-[55vw]">{displayName}</span>
                  <span className="text-xs text-gray-500 truncate max-w-[55vw]">{email}</span>
                </div>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                isAdmin ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {roleLabel}
              </span>
            </div>

            <div className="px-4 py-3 bg-gray-100/60 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">ספק AI ומפתח פעיל:</span>
              <BYOKStatusBadge />
            </div>
          </>
        )}

        <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 bg-white">
          {isAuthenticated ? (
            <>
              <div>
                <div className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider mb-1">תפעול שוטף</div>
                <div className="space-y-1">
                  {PRIMARY_NAV_ITEMS.map((item) => (
                    <NavLink key={item.id} to={item.path} onClick={onClose} className={linkClass}>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider mb-1">מעבדת AI ומודלים</div>
                <div className="space-y-1">
                  {SECONDARY_NAV_ITEMS.map((item) => (
                    <NavLink key={item.id} to={item.path} onClick={onClose} className={linkClass}>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div>
                  <div className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider mb-1">ניהול מערכת</div>
                  <NavLink
                    to={ADMIN_NAV_ITEM.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150 min-h-[44px] ${
                        isActive ? 'bg-purple-100 text-purple-900 font-bold border-r-4 border-purple-600' : 'font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-900'
                      }`
                    }
                  >
                    <span>{ADMIN_NAV_ITEM.label}</span>
                    <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">ניהול</span>
                  </NavLink>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-gray-500 px-3 py-4 text-center">יש להתחבר למערכת לקבלת גישה למודולים</div>
          )}
        </div>

        {isAuthenticated && (
          <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition text-center min-h-[44px]"
            >
              התנתק מהמערכת
            </button>
          </div>
        )}
      </div>
    </>
  );
}
