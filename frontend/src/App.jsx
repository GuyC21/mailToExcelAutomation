import React from 'react';
import HomePage from './pages/HomePage';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-200">
      <main className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
        <HomePage />
      </main>
    </div>
  );
}

export default App;
