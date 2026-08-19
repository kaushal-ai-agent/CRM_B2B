const countFormatter = new Intl.NumberFormat('en-IN');
const moneyFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

export const CUSTOMER_TIER_OPTIONS = ['All', 'A', 'B', 'C'];

export const INDUSTRY_OPTIONS = ['All', 'Hospital', 'Hospitality', 'Manufacturing', 'Retail'];

export const CUSTOMER_STATUS_OPTIONS = ['All', 'Active', 'Dormant'];

export const TIER_STYLES = {
  A: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  B: 'bg-sky-50 text-sky-700 ring-sky-200',
  C: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export const STATUS_STYLES = {
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Dormant: 'bg-amber-50 text-amber-700 ring-amber-200',
};

export function buildCustomerQuery({
  search = '',
  tier = 'All',
  industry = 'All',
  status = 'All',
} = {}) {
  const params = {};
  const trimmedSearch = search.trim();

  if (trimmedSearch) {
    params.search = trimmedSearch;
  }

  if (tier !== 'All') {
    params.customer_tier = tier;
  }

  if (industry !== 'All') {
    params.industry_segment = industry;
  }

  if (status === 'Active') {
    params.is_dormant = 'false';
  }

  if (status === 'Dormant') {
    params.is_dormant = 'true';
  }

  return params;
}

export function summarizeCustomerFilters({ search = '', tier = 'All', industry = 'All', status = 'All' } = {}) {
  const chips = [];
  const trimmedSearch = search.trim();

  if (trimmedSearch) {
    chips.push({ label: 'Search', value: trimmedSearch });
  }

  if (tier !== 'All') {
    chips.push({ label: 'Tier', value: `Tier ${tier}` });
  }

  if (industry !== 'All') {
    chips.push({ label: 'Industry', value: industry });
  }

  if (status !== 'All') {
    chips.push({ label: 'Status', value: status });
  }

  return chips;
}

export function normalizeCustomerPageResponse(data) {
  if (data && typeof data === 'object' && 'results' in data) {
    const results = Array.isArray(data.results) ? data.results : [];

    return {
      results,
      next: data.next || null,
      previous: data.previous || null,
      count: Number(data.count) || results.length,
    };
  }

  const results = Array.isArray(data) ? data : [];

  return {
    results,
    next: null,
    previous: null,
    count: results.length,
  };
}

export function formatCount(value) {
  return countFormatter.format(Number(value || 0));
}

export function formatMoney(value) {
  return `Rs. ${moneyFormatter.format(Number(value || 0))}`;
}

export function formatDate(value, options = {}) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

export function getCustomerInitials(name = '') {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return initials ? initials.toUpperCase() : 'CU';
}
