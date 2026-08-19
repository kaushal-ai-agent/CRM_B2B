import { AlertTriangle, Building2, Mail, Phone, UserRoundCheck } from 'lucide-react';
import { getCustomerInitials, STATUS_STYLES, TIER_STYLES } from '../../lib/customerDirectory';

function MobileBadge({ className, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      {children}
    </span>
  );
}

export default function CustomerDirectoryCards({ customers, onOpenCustomer }) {
  return (
    <div className="grid gap-4 lg:hidden">
      {customers.map((customer) => {
        const isDormant = Boolean(customer.is_dormant);
        const tierClass = TIER_STYLES[customer.customer_tier] || TIER_STYLES.C;
        const statusClass = isDormant ? STATUS_STYLES.Dormant : STATUS_STYLES.Active;

        return (
          <article
            key={customer.id}
            className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                {getCustomerInitials(customer.company_name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">{customer.company_name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{customer.gstin || 'GSTIN not shared'}</p>
                  </div>
                  <MobileBadge className={tierClass}>Tier {customer.customer_tier}</MobileBadge>
                </div>

                <p className="mt-2 text-sm text-slate-600">{customer.industry_segment}</p>

                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span>{customer.city}, {customer.state}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{customer.whatsapp_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>{customer.email || 'No email on file'}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <MobileBadge className={statusClass}>
                    {isDormant ? (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Dormant
                      </>
                    ) : (
                      <>
                        <UserRoundCheck className="h-3.5 w-3.5" />
                        Active
                      </>
                    )}
                  </MobileBadge>

                  <button
                    type="button"
                    onClick={() => onOpenCustomer(customer.id)}
                    data-log-action="Open Customer360"
                    className="ml-auto inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
                  >
                    Customer360
                  </button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
