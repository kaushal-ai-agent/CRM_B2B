import React from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Users, ShoppingCart, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import SettingsModal from '../SettingsModal';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Orders', path: '/orders', icon: ShoppingCart },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      {/* Sidebar */}
      <aside className="w-[260px] bg-white border-r border-[#E0E0E0] flex flex-col shrink-0">
        <div className="p-6 border-b border-[#E0E0E0]">
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">SalesOS</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#E0E0E0]">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-[#E2E8F0] flex items-center justify-center text-[#0F172A] font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none">{user.name}</span>
              <span className="text-xs text-[#64748B] mt-1">{user.role}</span>
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
        {/* Global Top Header */}
        <header className="h-16 bg-white border-b border-[#E0E0E0] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center">
             <span className="text-sm font-semibold text-[#0F172A] tracking-tight uppercase">Platform Overview</span>
          </div>
          <div className="flex items-center">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings size={16} />
              Settings
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6 relative">
          <Outlet />
          {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
