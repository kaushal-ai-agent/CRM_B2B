import { AlertTriangle, Loader2, Search } from 'lucide-react';

export default function CustomerFeedbackState({
  variant,
  title,
  description,
  onRetry,
  onResetFilters,
  hasFilters,
}) {
  const isError = variant === 'error';
  const isLoading = variant === 'loading';

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
          {isError ? <AlertTriangle className="h-6 w-6" /> : isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Search className="h-6 w-6" />}
        </div>

        <h2 className="mt-5 text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {isError ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-600"
            >
              Try again
            </button>
          ) : null}

          {hasFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
