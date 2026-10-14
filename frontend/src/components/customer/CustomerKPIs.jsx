import React from 'react';

const CustomerKPIs = ({ totalCustomers, momGrowth, yoyGrowth }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div className="bg-white border border-[#E0E0E0] p-6">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Total Unique Customers</h3>
        <p className="font-mono text-3xl font-bold text-[#0F172A]">{totalCustomers}</p>
      </div>
      <div className="bg-white border border-[#E0E0E0] p-6">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">MoM Growth</h3>
        <p className={`font-mono text-3xl font-bold ${momGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {momGrowth >= 0 ? '+' : ''}{momGrowth}%
        </p>
      </div>
      <div className="bg-white border border-[#E0E0E0] p-6">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">YoY Growth</h3>
        <p className={`font-mono text-3xl font-bold ${yoyGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {yoyGrowth >= 0 ? '+' : ''}{yoyGrowth}%
        </p>
      </div>
    </div>
  );
};

export default CustomerKPIs;
