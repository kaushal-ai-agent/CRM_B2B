/**
 * TeamManagement.jsx — /admin/team
 * Owner-only page to view, add, reset passwords, toggle active, and delete CRM users.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  KeyRound,
  Check,
  X,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { fetchUsersApi, createUserApi, patchUserApi, deleteUserApi } from '../api/customerService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ROLE_COLORS = {
  Owner:    'border-[#0F172A] bg-[#0F172A] text-white',
  Sales:    'border-[#2563EB] bg-blue-50 text-[#2563EB]',
  Accounts: 'border-purple-400 bg-purple-50 text-purple-700',
};

function RoleBadge({ role }) {
  return (
    <span className={`border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${ROLE_COLORS[role] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {role}
    </span>
  );
}

function StatusBadge({ isActive }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
      <span className="w-1.5 h-1.5 bg-emerald-500 inline-block" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
      <span className="w-1.5 h-1.5 bg-slate-300 inline-block" />
      Inactive
    </span>
  );
}

// ---------------------------------------------------------------------------
// Password reset inline row
// ---------------------------------------------------------------------------
function ResetPasswordRow({ userId, onDone, onCancel }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (pw.length < 6) { setError('Minimum 6 characters.'); return; }
    setLoading(true);
    try {
      await patchUserApi(userId, { password: pw });
      onDone();
    } catch {
      setError('Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="relative flex-1 max-w-xs">
        <input
          type={show ? 'text' : 'password'}
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(''); }}
          placeholder="New password (min 6 chars)"
          className="w-full border border-[#E2E8F0] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#2563EB] pr-8"
        />
        <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
      <button
        onClick={handleSave}
        disabled={loading}
        className="flex items-center gap-1 border border-emerald-500 bg-emerald-50 text-emerald-700 px-2 py-1.5 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50"
      >
        <Check size={12} /> Save
      </button>
      <button onClick={onCancel} className="flex items-center gap-1 border border-[#E2E8F0] px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
        <X size={12} /> Cancel
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add User Form (inline panel)
// ---------------------------------------------------------------------------
function AddUserForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', role: 'Sales' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  const set = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setErrors(p => ({ ...p, [field]: '' }));
    setApiError('');
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!form.username.trim()) errs.username = 'Required';
    if (form.password.length < 6) errs.password = 'Min 6 characters';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError('');
    try {
      const res = await createUserApi(form);
      onCreated(res.data);
      setForm({ name: '', username: '', email: '', password: '', role: 'Sales' });
      setOpen(false);
    } catch (err) {
      const data = err?.response?.data;
      if (typeof data === 'object') {
        // DRF field errors
        const fieldErrs = {};
        for (const [k, v] of Object.entries(data)) {
          fieldErrs[k] = Array.isArray(v) ? v[0] : v;
        }
        setErrors(fieldErrs);
      } else {
        setApiError('Failed to create user. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (field) =>
    `w-full border px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB] ${errors[field] ? 'border-rose-400 bg-rose-50' : 'border-[#E2E8F0] bg-white'}`;

  return (
    <div className="border border-[#E2E8F0] bg-white">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full px-5 py-3 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors"
      >
        <Plus size={15} className="text-[#2563EB]" />
        Add Team Member
        <span className="ml-auto text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-[#E2E8F0] p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Full Name *</label>
              <input id="add-name" type="text" value={form.name} onChange={set('name')} placeholder="Ravi Kumar" className={inputCls('name')} />
              {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Username *</label>
              <input id="add-username" type="text" value={form.username} onChange={set('username')} placeholder="ravi.sales" className={`${inputCls('username')} font-mono`} />
              {errors.username && <p className="text-xs text-rose-600 mt-1">{errors.username}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Email (optional)</label>
              <input id="add-email" type="email" value={form.email} onChange={set('email')} placeholder="ravi@company.com" className={inputCls('email')} />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Role *</label>
              <select id="add-role" value={form.role} onChange={set('role')} className={inputCls('role')}>
                <option value="Sales">Sales</option>
                <option value="Accounts">Accounts</option>
              </select>
            </div>

            {/* Password */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Password *</label>
              <div className="relative">
                <input
                  id="add-password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min 6 characters"
                  className={`${inputCls('password')} font-mono pr-9`}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-rose-600 mt-1">{errors.password}</p>}
            </div>
          </div>

          {apiError && (
            <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{apiError}</div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              id="add-user-submit"
              disabled={loading}
              className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? 'Creating…' : 'Create Member'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setErrors({}); setApiError(''); }}
              className="border border-[#E2E8F0] px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function TeamManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetingPw, setResetingPw] = useState(null); // user id
  const [deleteConfirm, setDeleteConfirm] = useState(null); // user id
  const [actionLoading, setActionLoading] = useState(null); // user id + action

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchUsersApi();
      setUsers(res.data);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Failed to load team members. Ensure you are logged in as Owner.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Toggle active ────────────────────────────────────────────────────────
  const handleToggleActive = async (u) => {
    setActionLoading(`${u.id}-toggle`);
    try {
      const res = await patchUserApi(u.id, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? res.data : x));
    } catch {
      /* silent */
    } finally {
      setActionLoading(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (userId) => {
    setActionLoading(`${userId}-delete`);
    try {
      await deleteUserApi(userId);
      setUsers(prev => prev.filter(x => x.id !== userId));
      setDeleteConfirm(null);
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to delete user.';
      setError(detail);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight uppercase flex items-center gap-2">
            <ShieldCheck size={22} className="text-[#2563EB]" />
            Team Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage CRM user accounts — Owner access only.</p>
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Add user form */}
      <AddUserForm onCreated={(newUser) => setUsers(prev => [...prev, newUser])} />

      {/* Error banner */}
      {error && (
        <div className="border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2 text-sm text-rose-700">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* Team directory table */}
      <div className="border border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0] bg-slate-50">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-slate-500" />
            <span className="text-sm font-semibold text-[#0F172A] uppercase tracking-wide">Directory</span>
          </div>
          <span className="font-mono text-xs text-slate-500">{users.length} member{users.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
            Loading team…
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#0F172A]">
                <tr>
                  {['Name', 'Username', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {users.map((u, idx) => (
                  <tr key={u.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-5 py-4 font-medium text-[#0F172A]">{u.name}</td>
                    <td className="px-5 py-4 font-mono text-slate-600 text-xs">{u.username}</td>
                    <td className="px-5 py-4"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-4"><StatusBadge isActive={u.is_active} /></td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4">
                      {u.role === 'Owner' ? (
                        <span className="text-xs text-slate-400 italic">Protected</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {/* Action buttons row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Reset Password toggle */}
                            <button
                              onClick={() => setResetingPw(resetingPw === u.id ? null : u.id)}
                              className="inline-flex items-center gap-1 border border-[#E2E8F0] bg-white hover:border-[#2563EB] hover:text-[#2563EB] px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors"
                            >
                              <KeyRound size={12} />
                              Reset PW
                            </button>

                            {/* Toggle active */}
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={actionLoading === `${u.id}-toggle`}
                              title={u.is_active ? 'Deactivate account' : 'Activate account'}
                              className={`inline-flex items-center gap-1 border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                u.is_active
                                  ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {u.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>

                            {/* Delete */}
                            {deleteConfirm === u.id ? (
                              <>
                                <button
                                  onClick={() => handleDelete(u.id)}
                                  disabled={actionLoading === `${u.id}-delete`}
                                  className="inline-flex items-center gap-1 border border-rose-500 bg-rose-500 text-white px-2.5 py-1 text-xs font-semibold hover:bg-rose-600 disabled:opacity-50"
                                >
                                  <Check size={12} /> Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="inline-flex items-center gap-1 border border-[#E2E8F0] px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                                >
                                  <X size={12} /> Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(u.id)}
                                className="inline-flex items-center gap-1 border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 px-2.5 py-1 text-xs font-medium transition-colors"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            )}
                          </div>

                          {/* Reset password inline input */}
                          {resetingPw === u.id && (
                            <ResetPasswordRow
                              userId={u.id}
                              onDone={() => setResetingPw(null)}
                              onCancel={() => setResetingPw(null)}
                            />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
