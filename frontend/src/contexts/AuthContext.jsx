import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi } from '../api/customerService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // true until localStorage hydrated

  // ---------------------------------------------------------------------------
  // Restore session from localStorage on page load / refresh
  // ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('crm_user');
      const storedToken = localStorage.getItem('crm_auth_token');
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // Corrupt localStorage — clear it
      localStorage.removeItem('crm_user');
      localStorage.removeItem('crm_auth_token');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // login — calls backend, stores user + token
  // ---------------------------------------------------------------------------
  const login = async (username, password, loginType) => {
    const res = await loginApi(username, password, loginType);
    const { user: u, token } = res.data;
    setUser(u);
    localStorage.setItem('crm_user', JSON.stringify(u));
    localStorage.setItem('crm_auth_token', token);
    return u;
  };

  // ---------------------------------------------------------------------------
  // logout — clears state and localStorage
  // ---------------------------------------------------------------------------
  const logout = () => {
    setUser(null);
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_auth_token');
  };

  const isOwner = user?.role === 'Owner';

  return (
    <AuthContext.Provider value={{ user, login, logout, isOwner, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
