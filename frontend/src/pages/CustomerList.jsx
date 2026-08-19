import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  LayoutGrid,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import CustomerFeedbackState from '../components/customer/CustomerFeedbackState';
import CustomerFilters from '../components/customer/CustomerFilters';
import CustomerPageHero from '../components/customer/CustomerPageHero';
import CustomerResultsPanel from '../components/customer/CustomerResultsPanel';
import CustomerStatGrid from '../components/customer/CustomerStatGrid';
import useCustomerDirectory from '../hooks/useCustomerDirectory';
import useDebouncedValue from '../hooks/useDebouncedValue';
import {
  buildCustomerQuery,
  summarizeCustomerFilters,
} from '../lib/customerDirectory';
import {
  logFrontendEvent,
  logCustomerWarning,
  logCustomerResponse,
} from '../lib/customerDebug';

export default function CustomerList() {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('All');
  const [industry, setIndustry] = useState('All');
  const [status, setStatus] = useState('All');
  const navigate = useNavigate();
  const debouncedSearch = useDebouncedValue(search, 280);

  // The API query stays tiny and explicit so filters remain predictable.
  const query = useMemo(
    () =>
      buildCustomerQuery({
        search: debouncedSearch,
        tier,
        industry,
        status,
      }),
    [debouncedSearch, tier, industry, status],
  );

  const {
    customers,
    count,
    nextUrl,
    previousUrl,
    loading,
    error,
    reload,
    loadPageByUrl,
  } = useCustomerDirectory(query);

  // These metrics are page-level signals, which keeps them honest while still useful.
  const pageMetrics = useMemo(() => {
    const activeCount = customers.filter((customer) => !customer.is_dormant).length;
    const dormantCount = customers.filter((customer) => customer.is_dormant).length;

    return [
      {
        label: 'Matched accounts',
        value: count,
        detail: 'Across the current filter set',
        icon: Users,
        tone: 'indigo',
      },
      {
        label: 'Visible on page',
        value: customers.length,
        detail: 'Loaded into the current page',
        icon: LayoutGrid,
        tone: 'slate',
      },
      {
        label: 'Active on page',
        value: activeCount,
        detail: 'Accounts ready to engage',
        icon: UserRoundCheck,
        tone: 'emerald',
      },
      {
        label: 'Dormant on page',
        value: dormantCount,
        detail: 'Needs follow-up',
        icon: AlertTriangle,
        tone: 'amber',
      },
    ];
  }, [count, customers]);

  const activeFilters = useMemo(
    () => summarizeCustomerFilters({ search, tier, industry, status }),
    [search, tier, industry, status],
  );

  const hasFilters = activeFilters.length > 0;

  const handleResetFilters = () => {
    logFrontendEvent('Customer filters reset');
    setSearch('');
    setTier('All');
    setIndustry('All');
    setStatus('All');
  };

  // Filter chips reuse the existing state so removal immediately refreshes the same API query.
  const handleRemoveFilter = (filterLabel) => {
    logFrontendEvent('Customer filter removed', { filterLabel });

    if (filterLabel === 'Search') {
      setSearch('');
    }

    if (filterLabel === 'Tier') {
      setTier('All');
    }

    if (filterLabel === 'Industry') {
      setIndustry('All');
    }

    if (filterLabel === 'Status') {
      setStatus('All');
    }
  };

  const handleOpenCustomer = (customerId) => {
    logFrontendEvent('Customer360 opened', { customerId });
    navigate(`/customer/${customerId}`);
  };

  useEffect(() => {
    if (!loading && !error) {
      logCustomerResponse('CustomerList render', {
        count,
        visibleCount: customers.length,
        activeFilters: activeFilters.length,
      });

      if (count === 0 || customers.length === 0) {
        logCustomerWarning('CustomerList render', {
          message: 'CustomerList received no rows to display',
          query,
          activeFilters,
        });
      }
    }
  }, [activeFilters, count, customers.length, error, loading, query]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
        <CustomerPageHero />
        <CustomerStatGrid metrics={pageMetrics} />
        <CustomerFilters
          search={search}
          onSearchChange={setSearch}
          tier={tier}
          onTierChange={setTier}
          industry={industry}
          onIndustryChange={setIndustry}
          status={status}
          onStatusChange={setStatus}
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onReset={handleResetFilters}
        />

        <main className="space-y-4">
          {loading ? (
            <CustomerFeedbackState
              variant="loading"
              title="Loading customer accounts"
              description="Pulling the latest CRM data and applying your selected filters."
            />
          ) : error ? (
            <CustomerFeedbackState
              variant="error"
              title="We could not load the directory"
              description={error}
              onRetry={reload}
              hasFilters={hasFilters}
              onResetFilters={handleResetFilters}
            />
          ) : customers.length === 0 ? (
            <CustomerFeedbackState
              variant="empty"
              title="No customers matched those filters"
              description="Try widening the search, switching segment filters, or clearing the current filter set."
              hasFilters={hasFilters}
              onResetFilters={handleResetFilters}
            />
          ) : (
            <CustomerResultsPanel
              customers={customers}
              count={count}
              onOpenCustomer={handleOpenCustomer}
              nextUrl={nextUrl}
              previousUrl={previousUrl}
              onNextPage={() => loadPageByUrl(nextUrl)}
              onPreviousPage={() => loadPageByUrl(previousUrl)}
              summary="Search, tier, industry, and dormant filters stay synced with the live API so every result stays actionable."
            />
          )}
        </main>
      </div>
    </div>
  );
}
