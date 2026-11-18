/**
 * Topbar Navigation Header Component.
 * 
 * Implements Option 1: Primary Tabs + "More Tools" Dropdown with full responsive adaptation:
 * - Desktop (>= 1024px / lg+): Displays the 3 primary operational modules directly in the topbar
 *   ('דאשבורד פיננסי', 'בקרת חשבוניות', 'טסטר חילוץ') and neatly condenses the technical AI
 *   and administration modules into a sleek 'כלי AI וניהול' dropdown popover.
 * - Mobile / Tablet (< 1024px / md & mobile): Fully categorized responsive drawer that organizes
 *   links into logical sections ('תפעול שוטף', 'כלי AI ומודלים', 'ניהול מערכת'), ensuring
 *   touch targets >= 44px, zero horizontal overflow, and frictionless navigation.
 * 
 * Strict Constraint: Uses only generic, open-source free-to-use vector icons (lucide-react ChevronDown)
 * and clean typography, avoiding any proprietary or unconventional glyphs.
 */
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import BYOKStatusBadge from '../byok/BYOKStatusBadge';

/**
 * Primary navigation routes visible directly in the desktop topbar.
 * These represent the core daily workflow for financial and backoffice operators.
 */
const PRIMARY_NAV_ITEMS = [
  { id: 'dashboard', path: '/dashboard', label: 'דאשבורד פיננסי' },
  { id: 'review', path: '/review', label: 'בקרת חשבוניות' },
  { id: 'sandbox', path: '/sandbox', label: 'טסטר חילוץ' },
];

/**
 * Secondary navigation routes grouped inside the 'כלי AI וניהול' dropdown on desktop.
 * These represent deep engineering, evaluation, and prompt tuning capabilities.
 */
const SECONDARY_NAV_ITEMS = [
  {
    id: 'prompts',
    path: '/prompts',
    label: 'ניהול פרומפטים',
    description: 'עריכה ובדיקת פרומפטים של מנוע החילוץ',
  },
  {
    id: 'regression',
    path: '/regression',
    label: 'בדיקות רגרסיה',
    description: 'מבחני דיוק ומדדי איכות על פני גרסאות',
  },
  {
    id: 'labeling',
    path: '/labeling',
    label: 'תיוג מסמכים',
    description: 'בניית מאגר מסמכים מוזהב (Golden Dataset)',
  },
];

/**
 * Administrative user management route (accessible only to users with the Admin role).
 */
const ADMIN_NAV_ITEM = {
  id: 'admin-users',
  path: '/admin/users',
  label: 'ניהול משתמשים',
  description: 'אישור משתמשים חדשים וניהול הרשאות מנהל',
};

/**
 * Animation speed preference for responsive drawers (in milliseconds).
 */
export const MENU_ANIMATION_SPEED_MS = 350;

/**
 * Topbar Component
 * 
 * Renders the top navigation bar, brand identity, grouped desktop navigation,
 * categorized mobile/tablet drawer, BYOK status, and user profile popover.
 * 
 * @component
 * @returns {JSX.Element}
 */
export default function Topbar() {
  const { isAuthenticated, isAdmin, profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile & Tablet responsive drawer toggle state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Desktop user profile dropdown state
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  // Desktop "More Tools" (AI & Management) dropdown state
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
  const moreDropdownRef = useRef(null);

  /**
   * Helper to ensure all menus/drawers close upon user navigation.
   */
  const closeAllMenus = () => {
    setIsMobileMenuOpen(false);
    setIsUserDropdownOpen(false);
    setIsMoreDropdownOpen(false);
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

  // Handle outside click and escape key to close popover menus
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target)) {
        setIsMoreDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsUserDropdownOpen(false);
        setIsMoreDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  /**
   * Handles user sign-out and redirects to login screen.
   */
  const handleLogout = async () => {
    closeAllMenus();
    await logout();
    navigate('/login', { replace: true });
  };

  // Compile list of secondary paths to detect if the "More Tools" dropdown is active
  const secondaryPaths = [
    ...SECONDARY_NAV_ITEMS.map((item) => item.path),
    ...(isAdmin ? [ADMIN_NAV_ITEM.path] : []),
  ];
  const isMoreActive = secondaryPaths.some((path) => location.pathname.startsWith(path));

  // User avatar identity attributes
  const userInitial = (profile?.full_name || user?.email || 'U')[0].toUpperCase();
  const displayName = profile?.full_name || 'משתמש';
  const roleLabel = isAdmin ? 'מנהל מערכת' : 'משתמש מאושר';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs w-full max-w-[100vw]" dir="rtl">
      {/* Top Header Bar (Height: 3.75rem / 4rem) */}
      <div className="max-w-7xl mx-auto px-[0.75rem] sm:px-[1.25rem] lg:px-[2rem] w-full">
        <div className="flex items-center justify-between h-[3.75rem] sm:h-[4rem] w-full gap-[0.5rem]">
          
          {/* Right Section: Brand Logo */}
          <div className="flex items-center gap-[0.5rem] sm:gap-[0.75rem] min-w-0 flex-shrink-0">
            <NavLink to="/dashboard" onClick={closeAllMenus} className="flex items-center gap-[0.5rem] focus:outline-none min-w-0">
              <div className="w-[2rem] h-[2rem] sm:w-[2.25rem] sm:h-[2.25rem] bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-[clamp(0.9rem,2.5vw,1.125rem)] shadow-xs select-none flex-shrink-0">
                B
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[clamp(0.85rem,3.2vw,1.125rem)] text-blue-900 tracking-tight leading-tight whitespace-nowrap truncate">
                  BillingStream AI
                </span>
                <span className="hidden sm:inline-block text-[0.625rem] text-gray-500 font-medium leading-none whitespace-nowrap">
                  מערכת בקרה פיננסית
                </span>
              </div>
            </NavLink>
          </div>

          {/* Center Section: Desktop Grouped Navigation (Visible on lg: screens 1024px+) */}
          {isAuthenticated && (
            <div className="hidden lg:flex items-center gap-[0.4rem] xl:gap-[0.6rem] flex-1 justify-center px-[0.5rem] xl:px-[1rem]">
              {/* Primary 3 Operational Links */}
              {PRIMARY_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={closeAllMenus}
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

              {/* Secondary AI & Management Tools Dropdown Menu */}
              <div className="relative" ref={moreDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMoreDropdownOpen((prev) => !prev);
                    setIsUserDropdownOpen(false);
                  }}
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

                {/* Dropdown Menu Popover */}
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
                        onClick={closeAllMenus}
                        className={({ isActive }) =>
                          `block px-4 py-2 transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-900 font-bold border-r-4 border-blue-600'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-blue-900'
                          }`
                        }
                      >
                        <div className="text-[13px] font-semibold leading-tight">{item.label}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 leading-tight font-normal">
                          {item.description}
                        </div>
                      </NavLink>
                    ))}

                    {/* Admin Users Section */}
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
                          onClick={closeAllMenus}
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
          )}

          {/* Left Section: BYOK Badge, Desktop Profile & Mobile Trigger */}
          <div className="flex items-center gap-[0.5rem] sm:gap-[0.75rem] flex-shrink-0">
            {isAuthenticated && (
              <div className="hidden md:flex">
                <BYOKStatusBadge />
              </div>
            )}
            {isAuthenticated ? (
              <>
                {/* Desktop User Dropdown (Visible on lg: screens 1024px+) */}
                <div className="hidden lg:block relative" ref={userDropdownRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsUserDropdownOpen((prev) => !prev);
                      setIsMoreDropdownOpen(false);
                    }}
                    className="flex items-center gap-[0.625rem] py-[0.375rem] px-[0.625rem] rounded-xl border border-gray-200 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    aria-expanded={isUserDropdownOpen}
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
                      <div className="text-[0.625rem] text-gray-400 leading-none">
                        {roleLabel}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${
                        isUserDropdownOpen ? 'rotate-180 text-blue-700' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu Popover */}
                  {isUserDropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-2 w-[16rem] bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-4 py-2 border-b border-gray-100">
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
                          className="w-full text-right px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          התנתק מהמערכת
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile / Tablet Menu Trigger Button (Visible on screens < 1024px) */}
                <div className="flex items-center gap-[0.35rem] sm:gap-[0.5rem] lg:hidden">
                  <div className="w-[1.85rem] h-[1.85rem] sm:w-[2rem] sm:h-[2rem] rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[0.75rem] font-bold select-none flex-shrink-0">
                    {userInitial}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                    className={`px-[0.65rem] sm:px-[0.85rem] py-[0.35rem] rounded-lg border text-[clamp(0.7rem,2vw,0.75rem)] font-bold transition shadow-xs whitespace-nowrap cursor-pointer ${
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

      {/* Mobile & Tablet Full-Width Categorized Menu Drawer */}
      {/* Dimmed Backdrop Overlay */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 lg:hidden transition-opacity ease-in-out ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
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

      {/* Expanding Drawer Container */}
      <div
        className={`relative z-50 lg:hidden bg-white border-b border-gray-200 shadow-2xl flex flex-col w-full transition-all ease-in-out origin-top ${
          isMobileMenuOpen
            ? 'opacity-100 translate-y-0 border-t border-gray-100 pointer-events-auto'
            : 'opacity-0 -translate-y-2 border-t-0 pointer-events-none overflow-hidden'
        }`}
        style={{
          maxHeight: isMobileMenuOpen ? '85vh' : '0px',
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

        {/* Mobile BYOK Quick Access */}
        {isAuthenticated && (
          <div className="px-4 py-3 bg-gray-100/60 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">ספק AI ומפתח פעיל:</span>
            <BYOKStatusBadge />
          </div>
        )}

        {/* Navigation Links Area - Categorized for seamless Mobile/Tablet scanning */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 bg-white">
          {isAuthenticated ? (
            <>
              {/* Category 1: Daily Operations */}
              <div>
                <div className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider mb-1">
                  תפעול שוטף
                </div>
                <div className="space-y-1">
                  {PRIMARY_NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      onClick={closeAllMenus}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150 min-h-[44px] ${
                          isActive
                            ? 'bg-blue-100 text-blue-900 font-bold border-r-4 border-blue-600'
                            : 'font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-900'
                        }`
                      }
                    >
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Category 2: AI Tools & Models */}
              <div>
                <div className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider mb-1">
                  מעבדת AI ומודלים
                </div>
                <div className="space-y-1">
                  {SECONDARY_NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      onClick={closeAllMenus}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150 min-h-[44px] ${
                          isActive
                            ? 'bg-blue-100 text-blue-900 font-bold border-r-4 border-blue-600'
                            : 'font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-900'
                        }`
                      }
                    >
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Category 3: Administration */}
              {isAdmin && (
                <div>
                  <div className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider mb-1">
                    ניהול מערכת
                  </div>
                  <div className="space-y-1">
                    <NavLink
                      to={ADMIN_NAV_ITEM.path}
                      onClick={closeAllMenus}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150 min-h-[44px] ${
                          isActive
                            ? 'bg-purple-100 text-purple-900 font-bold border-r-4 border-purple-600'
                            : 'font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-900'
                        }`
                      }
                    >
                      <span>{ADMIN_NAV_ITEM.label}</span>
                      <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                        ניהול
                      </span>
                    </NavLink>
                  </div>
                </div>
              )}
            </>
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
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition text-center min-h-[44px]"
            >
              התנתק מהמערכת
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
