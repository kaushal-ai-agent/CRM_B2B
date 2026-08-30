import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const MOCK_USERS = {
  admin: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Rahul Sharma',
    email: 'rahul.s@clientdomain.com',
    role: 'Owner'
  },
  sales: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Vikram Singh',
    email: 'vikram.s@clientdomain.com',
    role: 'Sales'
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (role) => {
    if (role === 'Admin') {
      setUser(MOCK_USERS.admin);
    } else if (role === 'Sales') {
      setUser(MOCK_USERS.sales);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
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
