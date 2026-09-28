import React, { useState } from 'react';
import HomePage from './pages/HomePage';
import SandboxPage from './pages/SandboxPage';

function App() {
  const [currentPage, setCurrentPage] = useState('prompts');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans" dir="rtl">
      {/* Topbar Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">G</div>
                <span className="font-bold text-xl text-blue-900 hidden sm:block">GoldenCare AI</span>
              </div>
              <div className="ml-6 sm:ml-10 flex space-x-4 space-x-reverse items-center">
                <button
                  onClick={() => setCurrentPage('prompts')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                    currentPage === 'prompts' 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ניהול פרומפטים
                </button>
                <button
                  onClick={() => setCurrentPage('sandbox')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                    currentPage === 'sandbox' 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  טסטר חילוץ (Sandbox)
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col items-center justify-start gap-8">
        {currentPage === 'prompts' ? <HomePage /> : <SandboxPage />}
      </main>
    </div>
  );
}

export default App;
