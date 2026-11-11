/**
 * Topbar Navigation Header Component.
 * 
 * Implements a high-density, fully responsive navigation bar tailored for RTL layout:
 * - Desktop (>= 1280px / xl): Inline navigation tabs with a compact user avatar
 *   popover menu, preventing horizontal overcrowding and eliminating scrollbars.
 * - Mobile / Tablet (< 1280px, including iPad Pro 13 at 1032px): An expansive,
 *   full-width responsive drawer using relative viewport units (vh, vw, %) that
 *   guarantees zero clipping, full visibility of all modules, and touch targets >= 44px.
 * 
 * Strict Constraint: Icon-free design relying purely on clean typography,
 * subtle micro-interactions, relative units, and role badges.
 */
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * Base navigation routes available to all authenticated and approved users.
 * Kept as static configuration to simplify role-based menu generation.
 */
const BASE_NAV_ITEMS = [
  { id: 'dashboard', path: '/dashboard', label: 'דאשבורד פיננסי' },
  { id: 'prompts', path: '/prompts', label: 'ניהול פרומפטים' },
  { id: 'sandbox', path: '/sandbox', label: 'טסטר חילוץ' },
  { id: 'review', path: '/review', label: 'בקרת חשבוניות' },
  { id: 'regression', path: '/regression', label: 'בדיקות רגרסיה' },
  { id: 'labeling', path: '/labeling', label: 'תיוג מסמכים' },
];

/**
 * ============================================================================
 * ANIMATION SPEED PREFERENCE
 * ----------------------------------------------------------------------------
 * Change this single value (in milliseconds) to adjust opening/closing speed:
 * - 150: Fast / Snappy
 * - 300: Fluent / Standard (Recommended)
 * - 500: Relaxed / Gentle
 * ============================================================================
 */
export const MENU_ANIMATION_SPEED_MS = 450;

/**
 * Topbar Component
 * 
 * Renders the top navigation bar, logo, responsive module links,
 * authenticated user profile snippet, role badge, and logout action.
 * 
 * @component
 * @returns {JSX.Element} The rendered navigation bar with desktop and mobile/tablet states.
 */
export default function Topbar() {
  const { isAuthenticated, isAdmin, profile, user, logout } = useAuth();
  const navigate = useNavigate();

  // Mobile / Tablet responsive menu toggle state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Desktop user profile popover state
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  /**
   * Helper to ensure all menus/drawers close upon user navigation.
   */
  const closeAllMenus = () => {
    setIsMobileMenuOpen(false);
    setIsUserDropdownOpen(false);
  };

  // Lock background scroll when mobile menu is open to prevent background bouncing
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Close desktop dropdown on click outside or escape key press
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsUserDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    if (isUserDropdownOpen || isMobileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserDropdownOpen, isMobileMenuOpen]);

  /**
   * Handles user sign-out and redirects to login screen.
   */
  const handleLogout = async () => {
    closeAllMenus();
    await logout();
    navigate('/login', { replace: true });
  };

  // Compile list of navigation items based on user privileges
  const navItems = [...BASE_NAV_ITEMS];
  if (isAdmin) {
    navItems.push({ id: 'admin-users', path: '/admin/users', label: 'ניהול משתמשים' });
  }

  // Derive initial character for user avatar
  const userInitial = (profile?.full_name || user?.email || 'U')[0].toUpperCase();
  const displayName = profile?.full_name || 'משתמש';
  const roleLabel = isAdmin ? 'מנהל מערכת' : 'משתמש מאושר';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs w-full" dir="rtl">
      {/* Top Header Bar (Height: 4rem / 64px) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-8 w-full">
        <div className="flex items-center justify-between h-16 w-full">
          
          {/* Right Section: Brand Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <NavLink to="/dashboard" onClick={closeAllMenus} className="flex items-center gap-2.5 focus:outline-none">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-xs select-none flex-shrink-0">
                B
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base sm:text-lg text-blue-900 tracking-tight leading-tight whitespace-nowrap">
                  BillingStream AI
                </span>
                <span className="text-[10px] text-gray-500 font-medium leading-none whitespace-nowrap">
                  מערכת בקרה פיננסית
                </span>
              </div>
            </NavLink>
          </div>

          {/* Center Section: Desktop Navigation Links (Visible only on xl: screens 1280px+) */}
          {isAuthenticated && (
            <div className="hidden xl:flex items-center gap-1.5 flex-1 justify-center px-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={closeAllMenus}
                  className="px-3.5 py-2 rounded-xl text-sm font-medium text-gray-700 transition-all duration-150 whitespace-nowrap hover:bg-blue-100 hover:text-blue-900 hover:font-bold"
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          {/* Left Section: Desktop Profile & Mobile Trigger */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAuthenticated ? (
              <>
                {/* Desktop User Dropdown (Visible on xl: screens 1280px+) */}
                <div className="hidden xl:block relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    aria-expanded={isUserDropdownOpen}
                    aria-label="תפריט משתמש"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold select-none">
                      {userInitial}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-800 leading-tight truncate max-w-[120px]">
                        {displayName}
                      </div>
                      <div className="text-[10px] text-gray-400 leading-none">
                        {roleLabel}
                      </div>
                    </div>
                  </button>

                  {/* Dropdown Menu Popover */}
                  {isUserDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 text-right">
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <div className="text-sm font-bold text-gray-900 truncate">{displayName}</div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</div>
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
                          onClick={handleLogout}
                          className="w-full text-right px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          התנתק מהמערכת
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile / Tablet Menu Trigger Button (Visible on screens < 1280px, including iPads) */}
                <div className="flex items-center gap-2 xl:hidden">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold select-none">
                    {userInitial}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                    className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold transition shadow-xs ${
                      isMobileMenuOpen
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    aria-label={isMobileMenuOpen ? 'סגור תפריט ניווט' : 'פתח תפריט ניווט'}
                    aria-expanded={isMobileMenuOpen}
                  >
                    {isMobileMenuOpen ? 'סגור' : 'תפריט'}
                  </button>
                </div>
              </>
            ) : (
              <NavLink
                to="/login"
                className="text-xs font-semibold bg-blue-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-blue-700 transition"
              >
                התחבר למערכת
              </NavLink>
            )}
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Full-Width Expanding Responsive Menu Panel */}
      {/* Dimmed Backdrop Overlay (Fades smoothly in and out using customizable MENU_ANIMATION_SPEED_MS) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 xl:hidden transition-opacity ease-in-out ${
          isMobileMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        style={{
          top: '4rem',
          height: 'calc(100vh - 4rem)',
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          transitionDuration: `${MENU_ANIMATION_SPEED_MS}ms`,
        }}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden={!isMobileMenuOpen}
      />

      {/* Expanding Menu Container (Smoothly expands and collapses using max-height, opacity, and transform) */}
      <div
        className={`relative z-50 xl:hidden bg-white border-b border-gray-200 shadow-2xl flex flex-col w-full transition-all ease-in-out origin-top ${
          isMobileMenuOpen
            ? 'opacity-100 translate-y-0 border-t border-gray-100 pointer-events-auto'
            : 'opacity-0 -translate-y-2 border-t-0 pointer-events-none overflow-hidden'
        }`}
        style={{
          maxHeight: isMobileMenuOpen ? '82vh' : '0px',
          overflowY: isMobileMenuOpen ? 'auto' : 'hidden',
          transitionDuration: `${MENU_ANIMATION_SPEED_MS}ms`,
        }}
        aria-hidden={!isMobileMenuOpen}
      >
        {/* User Profile Summary Card */}
        {isAuthenticated && (
          <div className="p-4 sm:p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between w-full flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base font-bold select-none shadow-xs flex-shrink-0">
                {userInitial}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-gray-900 leading-tight truncate max-w-[55vw]">
                  {displayName}
                </span>
                <span className="text-xs text-gray-500 truncate max-w-[55vw]">
                  {user?.email}
                </span>
              </div>
            </div>
            <div className="flex-shrink-0">
              <span
                className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  isAdmin
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}
              >
                {roleLabel}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Links Area (Scrolls gracefully if screen height is constrained) */}
        <div className="p-4 sm:p-6 space-y-1.5 flex-1 min-h-0 bg-white">
          <div className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider">
            ניווט במערכת
          </div>

          {isAuthenticated ? (
            navItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={closeAllMenus}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-gray-700 border-r-4 border-solid border-transparent transition-all duration-150 hover:border-blue-600 hover:bg-blue-100 hover:text-blue-900 hover:font-bold active:border-blue-600 active:bg-blue-100 active:text-blue-900 focus:bg-blue-100 focus:border-blue-600"
              >
                <span>{item.label}</span>
                {item.id === 'admin-users' && (
                  <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                    ניהול
                  </span>
                )}
              </NavLink>
            ))
          ) : (
            <div className="text-xs text-gray-500 px-3 py-4 text-center">
              יש להתחבר למערכת לקבלת גישה למודולים
            </div>
          )}
        </div>

        {/* Footer Action: Logout Button */}
        {isAuthenticated && (
          <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition text-center"
            >
              התנתק מהמערכת
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
