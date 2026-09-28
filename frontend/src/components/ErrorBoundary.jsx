import { Component } from 'react';

/**
 * Last-resort safety net: a broken page/component shows a recoverable Hebrew
 * message instead of an unhandled crash leaving finance users at a blank
 * white screen mid-demo.
 */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6" dir="rtl">
        <div className="bg-white border border-red-200 rounded-lg shadow p-6 max-w-lg text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">משהו השתבש בממשק</h1>
          <p className="text-sm text-gray-600 mb-4">
            הנתונים בשרת בסדר – זו תקלת תצוגה בלבד. רענון הדף אמור לפתור זאת.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white font-medium py-2 px-5 rounded hover:bg-blue-700 transition"
          >
            רענן דף
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
