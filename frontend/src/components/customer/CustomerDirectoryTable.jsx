import { AlertTriangle, Building2, Mail, Phone, UserRoundCheck } from 'lucide-react';
import { getCustomerInitials, STATUS_STYLES, TIER_STYLES } from '../../lib/customerDirectory';

function TableBadge({ className, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      {children}
    </span>
  );
}

export default function CustomerDirectoryTable({ customers, onOpenCustomer }) {
  return (
    <div className="hidden overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.06)] lg:block">
      {/* Sticky headers keep the CRM table readable while scrolling through accounts. */}
      <div className="max-h-[620px] overflow-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 px-4 py-4 text-left text-sm font-semibold">Company</th>
              <th className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 px-4 py-4 text-left text-sm font-semibold">Contact</th>
              <th className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 px-4 py-4 text-left text-sm font-semibold">Location</th>
              <th className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 px-4 py-4 text-left text-sm font-semibold">Industry</th>
              <th className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 px-4 py-4 text-left text-sm font-semibold">Tier</th>
              <th className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 px-4 py-4 text-left text-sm font-semibold">Status</th>
              <th className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 px-4 py-4 text-left text-sm font-semibold">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {customers.map((customer, index) => {
              const isDormant = Boolean(customer.is_dormant);
              const tierClass = TIER_STYLES[customer.customer_tier] || TIER_STYLES.C;
              const statusClass = isDormant ? STATUS_STYLES.Dormant : STATUS_STYLES.Active;

              return (
                <tr
                  key={customer.id}
                  className={`align-top transition hover:bg-sky-50/60 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                        {getCustomerInitials(customer.company_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">{customer.company_name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {customer.gstin || 'GSTIN not shared'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{customer.lead_source || 'Lead source not set'}</div>
                      </div>
                    </div>
                  </td>

                  <td className="min-w-[230px] px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{customer.contact_person}</div>
                    <div className="mt-2 flex items-center gap-2 text-slate-500">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{customer.whatsapp_number}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-slate-500">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{customer.email || 'No email on file'}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div>{customer.city}</div>
                    <div className="mt-1 text-xs text-slate-500">{customer.state}</div>
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-700">{customer.industry_segment}</td>

                  <td className="px-4 py-4">
                    <TableBadge className={tierClass}>
                      <Building2 className="h-3.5 w-3.5" />
                      Tier {customer.customer_tier}
                    </TableBadge>
                  </td>

                  <td className="px-4 py-4">
                    <TableBadge className={statusClass}>
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
                    </TableBadge>
                  </td>

                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onOpenCustomer(customer.id)}
                      data-log-action="Open Customer360"
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-600"
                    >
                      Customer360
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
