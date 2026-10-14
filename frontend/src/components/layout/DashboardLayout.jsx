import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  LogOut,
  Settings,
  Bot,
  Activity,
  ShieldCheck,
  MessageCircle,
  Target,
  FileCode
} from 'lucide-react';
import SettingsModal from '../SettingsModal';

const DashboardLayout = () => {
  const { user, logout, isOwner } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[#2563EB] text-white'
        : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
    }`;

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      {/* Sidebar */}
      <aside className="w-[260px] bg-white border-r border-[#E0E0E0] flex flex-col shrink-0">
        <div className="p-6 border-b border-[#E0E0E0]">
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">SalesOS</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">{user?.role}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Main nav — all roles */}
          <NavLink to="/dashboard" className={navLinkClass}>
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </NavLink>
          <NavLink to="/customers" className={navLinkClass}>
            <Users className="w-5 h-5" /> Customers
          </NavLink>
          <NavLink to="/orders" className={navLinkClass}>
            <ShoppingCart className="w-5 h-5" /> Orders
          </NavLink>

          {/* AI Agent section — Owner only */}
          {isOwner && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                  AI Agent
                </p>
              </div>
              <NavLink to="/admin/agent-settings" className={navLinkClass}>
                <Bot className="w-5 h-5" /> Agent Config
              </NavLink>
              <NavLink to="/admin/agent-prompts" className={navLinkClass}>
                <FileCode className="w-5 h-5" /> Prompt Studio
              </NavLink>
              <NavLink to="/admin/agent-audit" className={navLinkClass}>
                <Activity className="w-5 h-5" /> Observability
              </NavLink>
              <NavLink to="/admin/agent-eval" className={navLinkClass}>
                <Target className="w-5 h-5" /> Evaluation
              </NavLink>
              <NavLink to="/admin/instagram-inbox" className={navLinkClass}>
                <MessageCircle className="w-5 h-5" /> Instagram Inbox
              </NavLink>
            </>
          )}

          {/* Admin section — Owner only */}
          {isOwner && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                  Admin
                </p>
              </div>
              <NavLink to="/admin/team" className={navLinkClass}>
                <ShieldCheck className="w-5 h-5" /> Team Management
              </NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-[#E0E0E0]">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-[#E2E8F0] flex items-center justify-center text-[#0F172A] font-bold text-sm shrink-0">
              {user?.name?.charAt(0) || '?'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium leading-none truncate">{user?.name}</span>
              <span className="font-mono text-xs text-[#64748B] mt-1 truncate">{user?.username}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-[#E0E0E0] flex items-center justify-between px-6 shrink-0">
          <span className="text-sm font-semibold text-[#0F172A] tracking-tight uppercase">Platform Overview</span>
          {isOwner && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings size={16} />
              Settings
            </button>
          )}
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6 relative">
          <Outlet />
          {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
