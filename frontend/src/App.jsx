import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CustomerList from './pages/CustomerList';
import Customer360 from './pages/Customer360';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<CustomerList />} />
          <Route path="/customer/:id" element={<Customer360 />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}