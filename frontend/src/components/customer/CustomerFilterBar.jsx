import React from 'react';
import { Search, Download } from 'lucide-react';

const CustomerFilterBar = ({ filters, search, onSearchChange, onFilterChange, onClearFilters, onExport }) => {
  return (
    <div className="bg-white border border-[#E0E0E0] p-4 flex flex-col xl:flex-row gap-4 items-center justify-between mb-6">
      <div className="flex flex-wrap gap-4 w-full xl:w-auto items-center">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[250px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search company, GSTIN..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full border border-[#E0E0E0] bg-white pl-10 pr-3 py-1.5 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2">
          <label htmlFor="customer_tier" className="text-sm font-medium text-slate-600 hidden sm:block">Tier:</label>
          <select
            id="customer_tier"
            name="customer_tier"
            value={filters.customer_tier}
            onChange={(e) => onFilterChange('customer_tier', e.target.value)}
            className="border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          >
            <option value="">All Tiers</option>
            <option value="A">Tier A</option>
            <option value="B">Tier B</option>
            <option value="C">Tier C</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="industry_segment" className="text-sm font-medium text-slate-600 hidden sm:block">Industry:</label>
          <select
            id="industry_segment"
            name="industry_segment"
            value={filters.industry_segment}
            onChange={(e) => onFilterChange('industry_segment', e.target.value)}
            className="border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          >
            <option value="">All Industries</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Retail">Retail</option>
            <option value="Hospitality">Hospitality</option>
            <option value="Hospital">Hospital</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
        <button
          onClick={onClearFilters}
          className="px-4 py-1.5 border border-[#E0E0E0] bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#0F172A] transition-colors whitespace-nowrap"
        >
          Clear Filters
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-1.5 border border-[#10B981] bg-[#10B981] text-sm font-medium text-white hover:bg-[#059669] transition-colors whitespace-nowrap"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>
    </div>
  );
};

export default CustomerFilterBar;
