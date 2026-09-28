import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardLayout from './components/layout/DashboardLayout';
import CustomerMaster from './pages/CustomerMaster';
import Customer360 from './pages/Customer360';
import AgentSettings from './pages/AgentSettings';
import AgentAudit from './pages/AgentAudit';
import TeamManagement from './pages/TeamManagement';
import OrdersDashboard from './pages/OrdersDashboard';

// ---------------------------------------------------------------------------
// Route guard — redirects to /login if not authenticated
// ---------------------------------------------------------------------------
function RequireAuth({ children }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return null; // Wait for localStorage hydration
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ---------------------------------------------------------------------------
// Owner-only route guard
// ---------------------------------------------------------------------------
function RequireOwner({ children }) {
  const { user, authLoading, isOwner } = useAuth();
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isOwner) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected — all roles */}
        <Route
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<CustomerMaster />} />
          <Route path="/customer/:id" element={<Customer360 />} />
          <Route path="/orders" element={<OrdersDashboard />} />

          {/* Owner only */}
          <Route
            path="/admin/agent-settings"
            element={<RequireOwner><AgentSettings /></RequireOwner>}
          />
          <Route
            path="/admin/agent-audit"
            element={<RequireOwner><AgentAudit /></RequireOwner>}
          />
          <Route
            path="/admin/team"
            element={<RequireOwner><TeamManagement /></RequireOwner>}
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}