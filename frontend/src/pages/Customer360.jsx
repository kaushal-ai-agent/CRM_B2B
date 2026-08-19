import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  CreditCard,
  Mail,
  Phone,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { fetchCustomer360 } from '../api/client';
import { logCustomerError, logFrontendEvent } from '../lib/customerDebug';

function TierBadge({ tier }) {
  const map = {
    A: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    B: 'bg-sky-50 text-sky-700 ring-sky-200',
    C: 'bg-slate-100 text-slate-700 ring-slate-200',
  };

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${map[tier] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      Tier {tier}
    </span>
  );
}

export default function Customer360() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCustomer360(id);
        setCustomer(data);
        logFrontendEvent('Customer360 state updated', { id, hasCustomer: Boolean(data?.id) });
      } catch (err) {
        logCustomerError('Customer360 load', { id, message: err?.message });
        setError(err?.response?.data?.detail || err.message || 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const metrics = useMemo(() => {
    if (!customer) return { lifetimeValue: 0, outstanding: 0, ordersCount: 0 };

    const lifetimeValue = (customer.orders || []).reduce((s, o) => s + Number(o.total_value || 0), 0);
    const outstanding = (customer.invoices || []).reduce((s, i) => s + Number(i.outstanding_amount || 0), 0);
    const ordersCount = (customer.orders || []).length;

    return { lifetimeValue, outstanding, ordersCount };
  }, [customer]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_100%)]">
        <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4 shadow-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-dashed" />
          Loading customer profile...
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="m-4 rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>;
  }

  if (!customer) {
    return <div className="m-4 rounded-[24px] border border-slate-200 bg-white p-6 text-slate-600">Customer not found.</div>;
  }

  const { company_name, gstin, city, state, contact_person, whatsapp_number, email, industry_segment } = customer;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.15),_transparent_24%),linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_100%)] px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <button
          onClick={() => navigate(-1)}
          data-log-action="Return to customer directory"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur"
        >
          <ArrowLeft size={16} />
          Back to directory
        </button>

        <header className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-slate-100">
                <Sparkles size={16} />
                Customer 360 overview
              </div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{company_name}</h2>
              <p className="mt-3 text-base leading-7 text-slate-300">
                {gstin} • {city}, {state} • {industry_segment}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5">
                  <Building2 size={15} />
                  {contact_person}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5">
                  <Phone size={15} />
                  {whatsapp_number}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5">
                  <Mail size={15} />
                  {email || 'No email on file'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TierBadge tier={customer.customer_tier} />
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <TrendingUp size={16} className="text-indigo-500" />
              Lifetime value
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">₹{metrics.lifetimeValue.toLocaleString()}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Wallet size={16} className="text-amber-500" />
              Outstanding balance
            </div>
            <div className="mt-3 text-2xl font-semibold text-rose-600">₹{metrics.outstanding.toLocaleString()}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <CreditCard size={16} className="text-emerald-500" />
              Orders placed
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">{metrics.ordersCount}</div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap gap-2">
            {[
              ['orders', 'Orders history'],
              ['invoices', 'Invoices & receivables'],
              ['interactions', 'Interaction audit log'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                onClick={() => setActiveTab(key)}
                data-log-action={`Customer360 ${key} tab`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {activeTab === 'orders' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Priority</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Freight</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(customer.orders || []).map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-3 text-sm text-slate-700">{new Date(o.order_date).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            {o.order_priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{o.freight_mode}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">₹{Number(o.total_value || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {(!customer.orders || customer.orders.length === 0) && (
                      <tr>
                        <td className="p-6 text-center text-sm text-slate-500" colSpan="5">
                          No orders found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Invoice date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Due date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Total</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Outstanding</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Aging</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(customer.invoices || []).map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-3 text-sm text-slate-700">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{new Date(inv.due_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">₹{Number(inv.total_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`${Number(inv.outstanding_amount || 0) > 0 ? 'font-semibold text-rose-600' : 'text-slate-700'}`}>
                            ₹{Number(inv.outstanding_amount || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {inv.aging_bucket || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!customer.invoices || customer.invoices.length === 0) && (
                      <tr>
                        <td className="p-6 text-center text-sm text-slate-500" colSpan="5">
                          No invoices found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'interactions' && (
              <div className="space-y-4">
                {(!customer.interactions || customer.interactions.length === 0) ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No interactions found</div>
                ) : (
                  [...(customer.interactions || [])]
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .map((it) => (
                      <div key={it.id} className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <CalendarRange size={15} className="text-slate-400" />
                            {new Date(it.timestamp).toLocaleString()}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                              {it.channel}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                              {it.interaction_type}
                            </span>
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-slate-800">{it.content_transcript}</div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
