import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { id: 'dashboard', path: '/dashboard', label: 'דאשבורד פיננסי' },
  { id: 'prompts', path: '/prompts', label: 'ניהול פרומפטים' },
  { id: 'sandbox', path: '/sandbox', label: 'טסטר חילוץ' },
  { id: 'review', path: '/review', label: 'בקרת חשבוניות' },
  { id: 'regression', path: '/regression', label: 'בדיקות רגרסיה' },
  { id: 'labeling', path: '/labeling', label: 'תיוג מסמכים' },
];

export default function Topbar() {
  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:justify-between md:h-16">
          {/* Logo Section */}
          <div className="flex items-center justify-center md:justify-start h-14 md:h-16 flex-shrink-0 gap-2 border-b md:border-b-0 border-gray-100">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">G</div>
            <span className="font-bold text-xl text-blue-900">GoldenCare AI</span>
          </div>

          {/* Nav Links Section - Scrolling on Mobile */}
          <div className="flex items-center overflow-x-auto overflow-y-hidden py-2 md:py-0 no-scrollbar md:mr-10">
            <div className="flex space-x-2 space-x-reverse min-w-max mx-auto md:mx-0 px-2 md:px-0">
              {navItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
