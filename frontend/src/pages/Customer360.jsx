import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarRange,
  TrendingUp,
  Wallet,
  AlertTriangle,
  PackageOpen,
} from 'lucide-react';
import { fetchCustomer360, fetchEscalationsApi, resolveEscalationApi } from '../api/customerService';
import AgentChatWidget from '../components/agent/AgentChatWidget';
import AgentErrorBoundary from '../components/agent/ErrorBoundary';
import EscalationPill from '../components/EscalationPill';

function TierBadge({ tier }) {
  const map = {
    A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    B: 'bg-sky-50 text-sky-700 border-sky-200',
    C: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold border ${map[tier] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
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
  const [escalations, setEscalations] = useState([]);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [data, escRes] = await Promise.all([
          fetchCustomer360(id),
          fetchEscalationsApi({ customer_id: id, status: 'Escalated' })
        ]);
        setCustomer(data);
        setEscalations(escRes.data?.results || []);
      } catch (err) {
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
      <div className="flex h-full items-center justify-center p-12 text-slate-500 font-medium">
        Loading customer profile...
      </div>
    );
  }

  if (error) {
    return <div className="m-4 border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>;
  }

  if (!customer) {
    return <div className="m-4 border border-[#E0E0E0] bg-white p-6 text-slate-600">Customer not found.</div>;
  }

  const { company_name, gstin, city, state, contact_person, whatsapp_number, industry_segment, product_affinity, churn_risk_flag, is_dormant } = customer;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 border border-[#E0E0E0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Directory
        </button>
      </div>

      {/* Customer Header Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-[#E0E0E0] bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-[#0F172A] uppercase tracking-tight">{company_name}</h2>
              <div className="flex gap-2">
                {is_dormant && (
                  <span className="px-2 py-1 text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-700">
                    DORMANT
                  </span>
                )}
                {churn_risk_flag && (
                  <span className="px-2 py-1 text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    CHURN RISK
                  </span>
                )}
                <TierBadge tier={customer.customer_tier} />
              </div>
            </div>
            
            {escalations.length > 0 && (
              <div className="mb-4 flex items-center justify-between border border-rose-200 bg-rose-50 p-4">
                <div>
                  <EscalationPill label="ESCALATED" />
                  <p className="mt-2 text-sm text-rose-800">
                    This customer has an active AI escalation requiring human attention.
                  </p>
                  <p className="mt-1 text-xs text-rose-700 font-mono">
                    {escalations[0].error_details}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setResolving(true);
                    try {
                      await resolveEscalationApi(escalations[0].id, 'Resolved from 360 view');
                      setEscalations([]);
                    } catch (e) {
                      console.error('Failed to resolve', e);
                    } finally {
                      setResolving(false);
                    }
                  }}
                  disabled={resolving}
                  className="px-4 py-2 bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
                >
                  {resolving ? 'Resolving...' : 'Mark as Resolved'}
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 mt-6 text-sm text-slate-600">
              <div>
                <span className="block font-medium text-slate-400 mb-1 text-xs uppercase">GSTIN / Location</span>
                <span className="font-mono text-[#0F172A]">{gstin}</span> • {city}, {state}
              </div>
              <div>
                <span className="block font-medium text-slate-400 mb-1 text-xs uppercase">Industry Segment</span>
                <span className="text-[#0F172A]">{industry_segment}</span>
              </div>
              <div>
                <span className="block font-medium text-slate-400 mb-1 text-xs uppercase">Primary Contact</span>
                <span className="text-[#0F172A]">{contact_person}</span> • <span className="font-mono">{whatsapp_number}</span>
              </div>
              <div>
                <span className="block font-medium text-slate-400 mb-1 text-xs uppercase">Product Affinity</span>
                <span className="text-[#0F172A]">{product_affinity}</span>
              </div>
            </div>
          </div>
        </div>

        {/* High-Level KPIs */}
        <div className="flex flex-col gap-4">
          <div className="border border-[#E0E0E0] bg-white p-5 flex items-center justify-between">
            <div>
              <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Lifetime Value</span>
              <span className="font-mono text-2xl font-bold text-[#0F172A]">₹{metrics.lifetimeValue.toLocaleString()}</span>
            </div>
            <TrendingUp size={24} className="text-[#2563EB]" />
          </div>
          <div className="border border-[#E0E0E0] bg-white p-5 flex items-center justify-between">
            <div>
              <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Outstanding</span>
              <span className="font-mono text-2xl font-bold text-rose-600">₹{metrics.outstanding.toLocaleString()}</span>
            </div>
            <Wallet size={24} className="text-rose-500" />
          </div>
          <div className="border border-[#E0E0E0] bg-white p-5 flex items-center justify-between">
            <div>
              <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Orders</span>
              <span className="font-mono text-2xl font-bold text-[#0F172A]">{metrics.ordersCount}</span>
            </div>
            <PackageOpen size={24} className="text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Detail Tabs */}
      <div className="border border-[#E0E0E0] bg-white flex-1 flex flex-col min-h-[400px]">
        <div className="border-b border-[#E0E0E0] flex bg-slate-50">
          {[
            ['orders', 'Order History'],
            ['invoices', 'Invoices & Aging'],
            ['interactions', 'Interactions Log'],
            ['ai-chat', '🤖 AI Sales Assistant'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`px-6 py-3 text-sm font-medium border-r border-[#E0E0E0] transition-colors ${
                activeTab === key 
                  ? 'bg-white text-[#0F172A] border-b-2 border-b-[#2563EB]' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === 'orders' && (
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-50 border-b border-[#E0E0E0] z-10">
                <tr>
                  <th className="px-6 py-3 font-semibold text-[#0F172A]">Date</th>
                  <th className="px-6 py-3 font-semibold text-[#0F172A]">Priority</th>
                  <th className="px-6 py-3 font-semibold text-[#0F172A]">Freight</th>
                  <th className="px-6 py-3 font-semibold text-[#0F172A]">Status</th>
                  <th className="px-6 py-3 font-semibold text-[#0F172A] text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {(customer.orders || []).map((o, idx) => (
                  <tr key={o.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100`}>
                    <td className="px-6 py-3 font-mono text-slate-600">{new Date(o.order_date).toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 uppercase">
                        {o.order_priority}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-700">{o.freight_mode}</td>
                    <td className="px-6 py-3">
                      <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 uppercase">
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono font-medium text-[#0F172A] text-right">₹{Number(o.total_value || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {(!customer.orders || customer.orders.length === 0) && (
                  <tr>
                    <td className="p-12 text-center text-slate-500 font-medium" colSpan="5">No orders found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'invoices' && (
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-50 border-b border-[#E0E0E0] z-10">
                <tr>
                  <th className="px-6 py-3 font-semibold text-[#0F172A]">Invoice Date</th>
                  <th className="px-6 py-3 font-semibold text-[#0F172A]">Due Date</th>
                  <th className="px-6 py-3 font-semibold text-[#0F172A]">Total Amount</th>
                  <th className="px-6 py-3 font-semibold text-[#0F172A]">Outstanding</th>
                  <th className="px-6 py-3 font-semibold text-[#0F172A]">Aging Bucket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {(customer.invoices || []).map((inv, idx) => (
                  <tr key={inv.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100`}>
                    <td className="px-6 py-3 font-mono text-slate-600">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 font-mono text-slate-600">{new Date(inv.due_date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 font-mono text-slate-700">₹{Number(inv.total_amount || 0).toLocaleString()}</td>
                    <td className="px-6 py-3 font-mono font-medium">
                      <span className={`${Number(inv.outstanding_amount || 0) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        ₹{Number(inv.outstanding_amount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 uppercase">
                        {inv.aging_bucket || 'CURRENT'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!customer.invoices || customer.invoices.length === 0) && (
                  <tr>
                    <td className="p-12 text-center text-slate-500 font-medium" colSpan="5">No invoices found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'ai-chat' && (
            <AgentErrorBoundary label="AI Sales Assistant">
              <AgentChatWidget customerId={id} />
            </AgentErrorBoundary>
          )}

          {activeTab === 'interactions' && (
            <div className="p-6 space-y-4">
              {(!customer.interactions || customer.interactions.length === 0) ? (
                <div className="border border-dashed border-[#E0E0E0] p-12 text-center text-slate-500 font-medium">
                  No interactions found
                </div>
              ) : (
                [...(customer.interactions || [])]
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .map((it) => (
                    <div key={it.id} className="border border-[#E0E0E0] bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 font-mono">
                          <CalendarRange size={14} />
                          {new Date(it.timestamp).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-[#E0E0E0] bg-white px-2 py-1 text-xs font-semibold text-slate-600 uppercase">
                            {it.channel}
                          </span>
                          <span className="border border-[#E0E0E0] bg-white px-2 py-1 text-xs font-semibold text-slate-600 uppercase">
                            {it.interaction_type}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed">{it.content_transcript}</p>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
