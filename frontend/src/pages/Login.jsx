import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

const Login = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = (role) => {
    login(role);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-[#0F172A]">
      <div className="bg-white w-full max-w-md border border-[#E0E0E0] p-8 flex flex-col items-center">
        <div className="w-12 h-12 bg-[#2563EB] flex items-center justify-center mb-6">
          <LogIn className="w-6 h-6 text-white" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Sign in to SalesOS</h1>
        <p className="text-sm text-[#64748B] mb-8 text-center">
          Select a demo role to continue to the dashboard.
        </p>

        <div className="w-full space-y-4">
          <button
            onClick={() => handleLogin('Admin')}
            className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white py-3 px-4 text-sm font-medium transition-colors flex justify-between items-center"
          >
            <span>Continue as Admin (Owner)</span>
            <span className="font-mono text-xs opacity-75">Full Access</span>
          </button>
          
          <button
            onClick={() => handleLogin('Sales')}
            className="w-full bg-white hover:bg-[#F1F5F9] border border-[#E0E0E0] text-[#0F172A] py-3 px-4 text-sm font-medium transition-colors flex justify-between items-center"
          >
            <span>Continue as Sales Rep</span>
            <span className="font-mono text-xs text-[#64748B]">Sales Access</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
