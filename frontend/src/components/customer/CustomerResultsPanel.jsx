import CustomerDirectoryCards from './CustomerDirectoryCards';
import CustomerDirectoryTable from './CustomerDirectoryTable';
import CustomerPagination from './CustomerPagination';
import { formatCount } from '../../lib/customerDirectory';

export default function CustomerResultsPanel({
  customers,
  count,
  onOpenCustomer,
  nextUrl,
  previousUrl,
  onNextPage,
  onPreviousPage,
  summary,
}) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Customer directory</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {summary || 'Live results from the CRM backend, ready for search, filters, and Customer360 handoff.'}
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-slate-100">
            {formatCount(count)} matched accounts
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <CustomerDirectoryTable customers={customers} onOpenCustomer={onOpenCustomer} />
        <CustomerDirectoryCards customers={customers} onOpenCustomer={onOpenCustomer} />
      </div>

      <div className="border-t border-slate-200 p-4 sm:p-5">
        <CustomerPagination
          count={count}
          visibleCount={customers.length}
          hasPrevious={Boolean(previousUrl)}
          hasNext={Boolean(nextUrl)}
          onPrevious={onPreviousPage}
          onNext={onNextPage}
        />
      </div>
    </section>
  );
}
