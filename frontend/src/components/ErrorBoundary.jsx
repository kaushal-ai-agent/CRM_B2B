import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import logger from '../utils/logger';

/**
 * ErrorBoundary component that catches React lifecycle and render errors,
 * logs them automatically to the centralized logging pipeline, and renders
 * a clean Pragmatic Modernism fallback card instead of crashing to a blank screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      actionTraceback: '',
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const actionTraceback = logger.getActionTraceback();
    this.setState({ errorInfo, actionTraceback });
    // Automatically log this critical render crash to the logging service
    logger.error('React Component Crash', {
      message: error?.message || 'Unknown render error',
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      path: window.location.pathname,
      actionTraceback,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'An unexpected rendering error occurred.';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="p-8 max-w-4xl mx-auto my-8">
          <div className="border border-rose-300 bg-white">
            {/* Header */}
            <div className="px-5 py-4 border-b border-rose-200 bg-rose-50 flex items-center gap-3">
              <AlertTriangle className="text-rose-600 shrink-0" size={20} />
              <div>
                <h2 className="text-sm font-bold text-rose-900 tracking-tight">
                  View Render Error Encountered
                </h2>
                <p className="text-xs text-rose-700 mt-0.5">
                  The application caught an unhandled error and prevented a blank screen. A diagnostic report has been logged.
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Error Details
                </span>
                <div className="border border-[#E0E0E0] bg-slate-50 p-3 text-xs font-mono text-[#0F172A] whitespace-pre-wrap break-all">
                  {errorMsg}
                </div>
              </div>

              {this.state.actionTraceback && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    User Actions Traceback (Preceding Error)
                  </span>
                  <div className="border border-[#E0E0E0] bg-slate-50 p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap break-all">
                    {this.state.actionTraceback}
                  </div>
                </div>
              )}

              {componentStack && (
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer hover:text-[#2563EB] font-medium text-[11px]">
                    Technical Component Stack Trace
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-900 text-slate-200 font-mono text-[10px] whitespace-pre-wrap border border-slate-700 max-h-56 overflow-y-auto">
                    {componentStack}
                  </pre>
                </details>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center gap-3 border-t border-[#E0E0E0]">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="bg-[#2563EB] text-white px-4 py-2 text-xs font-semibold flex items-center gap-2 hover:bg-[#1D4ED8] transition-colors"
                >
                  <RefreshCw size={13} />
                  Reload Page
                </button>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="border border-[#E0E0E0] bg-white text-slate-700 px-4 py-2 text-xs font-semibold flex items-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <Home size={13} />
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
