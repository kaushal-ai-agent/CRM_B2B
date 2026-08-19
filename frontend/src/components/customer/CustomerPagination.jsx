import { ArrowLeft, ArrowRight } from 'lucide-react';
import { formatCount } from '../../lib/customerDirectory';

export default function CustomerPagination({
  count,
  visibleCount,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white/85 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-900">{formatCount(visibleCount)}</span> of{' '}
        <span className="font-semibold text-slate-900">{formatCount(count)}</span> matched customers
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPrevious}
          data-log-action="Previous customer page"
          disabled={!hasPrevious}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          data-log-action="Next customer page"
          disabled={!hasNext}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
