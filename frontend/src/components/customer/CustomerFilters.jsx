import { Search, X } from 'lucide-react';
import {
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_TIER_OPTIONS,
  INDUSTRY_OPTIONS,
} from '../../lib/customerDirectory';
import { logFrontendEvent } from '../../lib/customerDebug';

function SelectField({ id, label, value, onChange, options }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CustomerFilters({
  search,
  onSearchChange,
  tier,
  onTierChange,
  industry,
  onIndustryChange,
  status,
  onStatusChange,
  activeFilters,
  onRemoveFilter,
  onReset,
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      {/* Search and filters share one compact toolbar while keeping existing state handlers. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_8rem_11rem_8rem]">
        <div className="min-w-0">
          <label htmlFor="customer-search" className="mb-1.5 block text-xs font-medium text-slate-600">
            Search customers
          </label>
          <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              id="customer-search"
              type="search"
              value={search}
              onChange={(event) => {
                logFrontendEvent('Customer search changed', {
                  valueLength: event.target.value.length,
                });
                onSearchChange(event.target.value);
              }}
              placeholder="Search company, GSTIN, contact..."
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <SelectField
          id="tier-filter"
          label="Tier"
          value={tier}
          onChange={onTierChange}
          options={CUSTOMER_TIER_OPTIONS}
        />
        <SelectField
          id="industry-filter"
          label="Industry"
          value={industry}
          onChange={onIndustryChange}
          options={INDUSTRY_OPTIONS}
        />
        <SelectField
          id="status-filter"
          label="Status"
          value={status}
          onChange={onStatusChange}
          options={CUSTOMER_STATUS_OPTIONS}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <span className="mr-1 text-xs font-medium text-slate-600">
          Active filters
        </span>

        {activeFilters.length > 0 ? (
          activeFilters.map((filter) => (
            <button
              type="button"
              key={`${filter.label}-${filter.value}`}
              onClick={() => onRemoveFilter(filter.label)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <span className="font-medium text-slate-500">{filter.label}:</span>
              {filter.value}
              <X className="ml-0.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </button>
          ))
        ) : (
          <span className="text-xs text-slate-500">No filters applied</span>
        )}

        <button
          type="button"
          onClick={onReset}
          data-log-action="Clear customer filters"
          disabled={activeFilters.length === 0}
          className="ml-auto inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          Clear all
        </button>
      </div>
    </section>
  );
}
