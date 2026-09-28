import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, LogIn, ChevronDown, ChevronUp } from 'lucide-react';

// ---------------------------------------------------------------------------
// Demo credential sets for quick-fill pills
// ---------------------------------------------------------------------------
const DEMO_CREDS = {
  Owner: [{ label: 'owner', username: 'owner', password: 'owner123' }],
  Team: [
    { label: 'amit.sales', username: 'amit.sales', password: 'sales123' },
    { label: 'priya.sales', username: 'priya.sales', password: 'sales123' },
  ],
};

// ---------------------------------------------------------------------------
// Main Login Component
// ---------------------------------------------------------------------------
export default function Login() {
  const { user, login, authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('Owner'); // 'Owner' | 'Team'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  // Already logged in — redirect
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm text-slate-500 font-mono">Loading…</div>
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;

  // ── Handle form submit ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError('');
    try {
      const loggedInUser = await login(username.trim(), password, activeTab);
      navigate(loggedInUser.role === 'Owner' ? '/dashboard' : '/dashboard', { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Auto-fill demo credentials ────────────────────────────────────────────
  const fillDemo = (cred) => {
    setUsername(cred.username);
    setPassword(cred.password);
    setError('');
  };

  // ── Tab switch (clears form) ──────────────────────────────────────────────
  const switchTab = (tab) => {
    setActiveTab(tab);
    setUsername('');
    setPassword('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-[#0F172A]">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white border border-[#E2E8F0]">

          {/* Brand header */}
          <div className="flex items-center gap-3 px-8 pt-8 pb-6 border-b border-[#E2E8F0]">
            <div className="w-10 h-10 bg-[#0F172A] flex items-center justify-center shrink-0">
              <LogIn size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">SalesOS</h1>
              <p className="text-xs text-slate-500 mt-0.5">B2B CRM Platform</p>
            </div>
          </div>

          {/* Login type tabs */}
          <div className="flex border-b border-[#E2E8F0]">
            {['Owner', 'Team'].map((tab) => (
              <button
                key={tab}
                id={`login-tab-${tab.toLowerCase()}`}
                onClick={() => switchTab(tab)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-[#2563EB] text-[#2563EB] bg-white'
                    : 'border-transparent text-slate-500 bg-slate-50 hover:text-[#0F172A]'
                }`}
              >
                {tab === 'Owner' ? 'Owner Login' : 'Team Member Login'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            {/* Tab description */}
            <p className="text-xs text-slate-500 pb-1">
              {activeTab === 'Owner'
                ? 'Full admin access — configuration, analytics, and team management.'
                : 'CRM & sales operations access.'}
            </p>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder={activeTab === 'Owner' ? 'owner' : 'e.g. amit.sales'}
                disabled={loading}
                className="w-full border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm font-mono text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full border border-[#E2E8F0] bg-white px-3 py-2.5 pr-10 text-sm font-mono text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full bg-[#2563EB] text-white py-2.5 text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo Credentials strip */}
          <div className="border-t border-[#E2E8F0] px-8 py-4">
            <button
              onClick={() => setShowDemo((v) => !v)}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#0F172A] transition-colors w-full"
            >
              {showDemo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span className="font-mono">Demo Credentials</span>
            </button>

            {showDemo && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-400">
                  Click a pill to auto-fill the form for the <strong>{activeTab}</strong> tab:
                </p>
                <div className="flex flex-wrap gap-2">
                  {DEMO_CREDS[activeTab].map((cred) => (
                    <button
                      key={cred.username}
                      type="button"
                      onClick={() => fillDemo(cred)}
                      className="border border-[#E2E8F0] bg-slate-50 hover:border-[#2563EB] hover:bg-blue-50 px-3 py-1.5 font-mono text-xs text-[#0F172A] transition-colors"
                    >
                      {cred.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  pw: {activeTab === 'Owner' ? 'owner123' : 'sales123'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
