/**
 * Topbar Navigation Header Orchestrator Component.
 */
import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTopbarMenus } from '../../hooks/useTopbarMenus';
import BYOKStatusBadge from '../byok/BYOKStatusBadge';
import DesktopNav from './DesktopNav';
import UserMenuDropdown from './UserMenuDropdown';
import MobileDrawer from './MobileDrawer';
import { ADMIN_NAV_ITEM, SECONDARY_NAV_ITEMS } from './navConfig';

/**
 * Renders the sticky application header, brand identity, grouped desktop navigation,
 * categorized mobile drawer, BYOK badge, and user profile menu.
 * @component
 * @returns {JSX.Element}
 */
export default function Topbar() {
  const { isAuthenticated, isAdmin, profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isMobileMenuOpen, isUserDropdownOpen, isMoreDropdownOpen,
    userDropdownRef, moreDropdownRef, closeAllMenus,
    toggleMoreDropdown, toggleUserDropdown, toggleMobileMenu,
  } = useTopbarMenus();

  const handleLogout = async () => {
    closeAllMenus();
    await logout();
    navigate('/login', { replace: true });
  };

  const secondaryPaths = [
    ...SECONDARY_NAV_ITEMS.map((item) => item.path),
    ...(isAdmin ? [ADMIN_NAV_ITEM.path] : []),
  ];
  const isMoreActive = secondaryPaths.some((path) => location.pathname.startsWith(path));

  const userInitial = ((profile?.full_name || user?.email || 'U')[0] || 'U').toUpperCase();
  const displayName = profile?.full_name || 'משתמש';
  const roleLabel = isAdmin ? 'מנהל מערכת' : 'משתמש מאושר';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs w-full max-w-[100vw]" dir="rtl">
      <div className="max-w-7xl mx-auto px-[0.75rem] sm:px-[1.25rem] lg:px-[2rem] w-full">
        <div className="flex items-center justify-between h-[3.75rem] sm:h-[4rem] w-full gap-[0.5rem]">
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

          {isAuthenticated && (
            <DesktopNav
              isAdmin={isAdmin}
              isMoreActive={isMoreActive}
              isMoreDropdownOpen={isMoreDropdownOpen}
              onToggleMoreDropdown={toggleMoreDropdown}
              moreDropdownRef={moreDropdownRef}
              onNavigate={closeAllMenus}
            />
          )}

          <div className="flex items-center gap-[0.5rem] sm:gap-[0.75rem] flex-shrink-0">
            {isAuthenticated && <div className="hidden md:flex"><BYOKStatusBadge /></div>}
            {isAuthenticated ? (
              <>
                <UserMenuDropdown
                  userInitial={userInitial}
                  displayName={displayName}
                  email={user?.email}
                  roleLabel={roleLabel}
                  isAdmin={isAdmin}
                  isOpen={isUserDropdownOpen}
                  onToggle={toggleUserDropdown}
                  dropdownRef={userDropdownRef}
                  onLogout={handleLogout}
                />

                <div className="flex items-center gap-[0.35rem] sm:gap-[0.5rem] lg:hidden">
                  <div className="w-[1.85rem] h-[1.85rem] sm:w-[2rem] sm:h-[2rem] rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[0.75rem] font-bold select-none flex-shrink-0">
                    {userInitial}
                  </div>
                  <button
                    type="button"
                    onClick={toggleMobileMenu}
                    className={`px-[0.65rem] sm:px-[0.85rem] py-[0.35rem] rounded-lg border text-[clamp(0.7rem,2vw,0.75rem)] font-bold transition shadow-xs whitespace-nowrap cursor-pointer ${
                      isMobileMenuOpen ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
                    }`}
                    aria-label={isMobileMenuOpen ? 'סגור תפריט ניווט' : 'פתח תפריט ניווט'}
                    aria-expanded={isMobileMenuOpen}
                  >
                    {isMobileMenuOpen ? 'סגור' : 'תפריט'}
                  </button>
                </div>
              </>
            ) : (
              <NavLink to="/login" className="text-xs font-semibold bg-blue-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-blue-700 transition">
                התחבר למערכת
              </NavLink>
            )}
          </div>
        </div>
      </div>

      <MobileDrawer
        isOpen={isMobileMenuOpen}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        userInitial={userInitial}
        displayName={displayName}
        email={user?.email}
        roleLabel={roleLabel}
        onClose={closeAllMenus}
        onLogout={handleLogout}
      />
    </nav>
  );
}
