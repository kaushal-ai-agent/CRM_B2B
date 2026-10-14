import React from 'react';
import { Link } from 'react-router-dom';

const CustomerTable = ({ customers, loading, error }) => {
  if (loading) {
    return (
      <div className="bg-white border border-[#E0E0E0] p-12 text-center text-slate-500 font-medium">
        Loading customers...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 p-12 text-center text-rose-600 font-medium">
        Error loading customers: {error.message || 'Unknown error'}
      </div>
    );
  }

  if (!customers || customers.length === 0) {
    return (
      <div className="bg-white border border-[#E0E0E0] p-12 text-center text-slate-500 font-medium">
        No customers found matching the selected filters.
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E0E0E0] overflow-hidden flex flex-col h-[500px]">
      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="min-w-full text-left text-sm whitespace-nowrap">
          <thead className="sticky top-0 bg-slate-50 border-b border-[#E0E0E0] z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-semibold text-[#0F172A]">Company Name</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A]">Contact Person</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A]">WhatsApp</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A]">Industry</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A]">City</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A]">Tier</th>
              <th className="px-4 py-3 font-semibold text-[#0F172A]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {customers.map((customer, idx) => (
              <tr 
                key={customer.id} 
                className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100 transition-colors`}
              >
                <td className="px-4 py-3 font-medium text-[#0F172A] whitespace-normal min-w-[200px]">
                  {customer.company_name}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-normal min-w-[150px]">
                  {customer.contact_person}
                </td>
                <td className="px-4 py-3 font-mono text-slate-600">
                  {customer.whatsapp_number}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {customer.industry_segment}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {customer.city}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs font-semibold border ${
                    customer.customer_tier === 'A' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    customer.customer_tier === 'B' ? 'border-sky-200 bg-sky-50 text-sky-700' :
                    'border-slate-200 bg-slate-100 text-slate-700'
                  }`}>
                    Tier {customer.customer_tier}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link 
                    to={`/customer/${customer.id}`}
                    className="text-[#2563EB] hover:underline font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerTable;
