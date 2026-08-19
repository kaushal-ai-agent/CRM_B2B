import { formatCount } from '../../lib/customerDirectory';

const toneClasses = {
  indigo: {
    accent: 'border-t-indigo-500',
    icon: 'bg-indigo-50 text-indigo-600',
  },
  emerald: {
    accent: 'border-t-emerald-500',
    icon: 'bg-emerald-50 text-emerald-600',
  },
  amber: {
    accent: 'border-t-amber-500',
    icon: 'bg-amber-50 text-amber-600',
  },
  slate: {
    accent: 'border-t-slate-500',
    icon: 'bg-slate-100 text-slate-600',
  },
};

export default function CustomerStatGrid({ metrics }) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const styles = toneClasses[metric.tone] || toneClasses.slate;
        const Icon = metric.icon;

        return (
          <article
            key={metric.label}
            className={`min-w-0 rounded-xl border border-slate-200 border-t-[3px] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${styles.accent}`}
          >
            <div className="flex h-full min-h-[108px] flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {metric.label}
                  </div>
                  <div className="mt-2 text-3xl font-semibold leading-none tracking-tight text-slate-900">
                    {formatCount(metric.value)}
                  </div>
                </div>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
              <p className="min-h-4 text-xs leading-4 text-slate-500">{metric.detail}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}
