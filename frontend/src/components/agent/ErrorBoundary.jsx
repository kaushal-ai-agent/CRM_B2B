/**
 * ErrorBoundary.jsx
 * Generic React ErrorBoundary for AI Agent components.
 * Catches render-time errors so an offline agent doesn't crash the SPA.
 */

import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class AgentErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[AgentErrorBoundary] Component error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="border border-amber-200 bg-amber-50 p-6 flex items-start gap-4">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {this.props.label || 'AI Agent Component'}
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {this.state.error?.message?.includes('Network')
                ? 'The Agent service appears to be offline. Ensure it is running on port 8100.'
                : 'This component encountered an unexpected error.'}
            </p>
            <p className="font-mono text-xs text-amber-600 mt-2 break-all">
              {this.state.error?.message}
            </p>
            <button
              onClick={this.handleRetry}
              className="mt-3 inline-flex items-center gap-2 border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AgentErrorBoundary;
