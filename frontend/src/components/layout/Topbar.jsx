/**
 * Topbar Navigation Header Component.
 * 
 * Renders the top navigation bar, logo, responsive module links,
 * authenticated user profile snippet, role badge, and logout action.
 */
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Shield, User } from 'lucide-react';

const baseNavItems = [
  { id: 'dashboard', path: '/dashboard', label: 'דאשבורד פיננסי' },
  { id: 'prompts', path: '/prompts', label: 'ניהול פרומפטים' },
  { id: 'sandbox', path: '/sandbox', label: 'טסטר חילוץ' },
  { id: 'review', path: '/review', label: 'בקרת חשבוניות' },
  { id: 'regression', path: '/regression', label: 'בדיקות רגרסיה' },
  { id: 'labeling', path: '/labeling', label: 'תיוג מסמכים' },
];

/**
 * Topbar Component
 * 
 * @component
 * @returns {JSX.Element}
 */
export default function Topbar() {
  const { isAuthenticated, isApproved, isAdmin, profile, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navItems = [...baseNavItems];
  if (isAdmin) {
    navItems.push({ id: 'admin-users', path: '/admin/users', label: 'ניהול משתמשים' });
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:justify-between md:h-16">
          {/* Logo Section */}
          <div className="flex items-center justify-between md:justify-start h-14 md:h-16 flex-shrink-0 gap-3 border-b md:border-b-0 border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
                B
              </div>
              <span className="font-bold text-xl text-blue-900 tracking-tight">BillingStream AI</span>
            </div>

            {/* Mobile User Profile snippet */}
            {isAuthenticated && (
              <div className="flex items-center gap-2 md:hidden">
                <span className="text-xs font-semibold text-gray-700 truncate max-w-[120px]">
                  {profile?.full_name || user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                  title="התנתק"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links (Visible only when user is approved) */}
          {isAuthenticated && isApproved && (
            <div className="flex items-center overflow-x-auto overflow-y-hidden py-2 md:py-0 no-scrollbar md:mr-6 flex-1">
              <div className="flex space-x-1 space-x-reverse min-w-max mx-auto md:mx-0 px-2 md:px-0">
                {navItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {/* Desktop User Section */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0 mr-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 py-1 px-2.5 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-800 leading-tight">
                      {profile?.full_name || 'משתמש'}
                    </div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1">
                      {isAdmin ? (
                        <span className="text-purple-600 font-semibold flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5" /> מנהל
                        </span>
                      ) : (
                        <span>{user?.email}</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 py-1.5 px-2.5 rounded-lg transition"
                  title="התנתק מהמערכת"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>התנתק</span>
                </button>
              </div>
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
    </nav>
  );
}
