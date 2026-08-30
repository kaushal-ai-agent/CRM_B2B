import React, { useState, useEffect } from 'react';
import { IndianRupee, Users, AlertCircle, Package, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 m-6">
          <h2 className="font-bold mb-2">Dashboard Render Error</h2>
          <pre className="text-xs whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          <pre className="text-xs whitespace-pre-wrap mt-2">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function formatIndianCurrencyCompact(value) {
  const num = Number(value) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

function formatExactCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value) || 0);
}

function KPIStrip({ data }) {
  const { mtdRevenue = 0, smlyRevenue = 0, totalCustomers = 0, dormantCustomers = 0, todaysEnquiries = 0 } = data;
  
  const revGrowth = smlyRevenue ? ((mtdRevenue - smlyRevenue) / smlyRevenue) * 100 : 0;
  const isPositive = revGrowth >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="border border-[#E0E0E0] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-tight">MTD Revenue</h3>
          <IndianRupee size={20} className="text-[#2563EB]" />
        </div>
        <p 
          className="text-3xl font-mono text-[#0F172A] mb-2 font-medium cursor-help"
          title={formatExactCurrency(mtdRevenue)}
        >
          {formatIndianCurrencyCompact(mtdRevenue)}
        </p>
        <div className="flex items-center gap-1 text-xs font-medium">
          {isPositive ? <TrendingUp size={14} className="text-emerald-600" /> : <TrendingDown size={14} className="text-rose-600" />}
          <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
            {Math.abs(revGrowth).toFixed(1)}%
          </span>
          <span className="text-slate-500 ml-1">vs SMLY</span>
        </div>
      </div>

      <div className="border border-[#E0E0E0] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-tight">Total Customers</h3>
          <Users size={20} className="text-[#2563EB]" />
        </div>
        <p className="text-3xl font-mono text-[#0F172A] font-medium">{totalCustomers}</p>
      </div>

      <div className="border border-[#E0E0E0] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-tight">Dormant Customers</h3>
          <Clock size={20} className="text-[#2563EB]" />
        </div>
        <p className="text-3xl font-mono text-[#0F172A] font-medium">{dormantCustomers}</p>
        <p className="text-xs text-slate-500 mt-2 font-medium">&gt; 90 days no order</p>
      </div>

      <div className="border border-[#E0E0E0] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-tight">Today's Enquiries</h3>
          <AlertCircle size={20} className="text-[#2563EB]" />
        </div>
        <p className="text-3xl font-mono text-[#0F172A] font-medium">{todaysEnquiries}</p>
        <p className="text-xs text-slate-500 mt-2 font-medium">From IndiaMART & Portals</p>
      </div>
    </div>
  );
}

function SeasonalDemandChart({ data }) {
  const chartData = data?.map(d => ({ ...d, value: Number(d.value) })) || [];
  return (
    <div className="border border-[#E0E0E0] bg-white p-6 h-[300px] flex flex-col">
      <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-tight mb-6">Seasonal Demand (Revenue This Year)</h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(val) => `₹${(val/1000)}k`} tick={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }} axisLine={false} tickLine={false} />
            <RechartsTooltip 
              contentStyle={{ borderRadius: '0px', border: '1px solid #E2E8F0', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px' }}
              formatter={(val) => [formatExactCurrency(val), 'Revenue']}
            />
            <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} dot={{ r: 4, fill: '#2563EB' }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AgingReceivablesChart({ data }) {
  const chartData = data?.map(d => ({ ...d, value: Number(d.value) })) || [];
  return (
    <div className="border border-[#E0E0E0] bg-white p-6 h-[300px] flex flex-col">
      <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-tight mb-6">Accounts Receivable Aging</h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(val) => `₹${(val/1000)}k`} tick={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }} axisLine={false} tickLine={false} />
            <RechartsTooltip 
              cursor={{ fill: '#F1F5F9' }} 
              contentStyle={{ borderRadius: '0px', border: '1px solid #E2E8F0', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px' }}
              formatter={(val) => [formatExactCurrency(val), 'Outstanding']}
            />
            <Bar dataKey="value" fill="#2563EB" radius={[0, 0, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MarginVelocityTables({ data }) {
  const rows = data || [];
  return (
    <div className="border border-[#E0E0E0] bg-white p-6">
      <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-tight mb-6">Top Products & Margin Snapshot</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-y border-[#E0E0E0]">
            <tr>
              <th className="px-4 py-2 font-medium text-slate-600">Product</th>
              <th className="px-4 py-2 font-medium text-slate-600 text-right">Revenue</th>
              <th className="px-4 py-2 font-medium text-slate-600 text-right">Units</th>
              <th className="px-4 py-2 font-medium text-slate-600 text-right">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-[#0F172A] font-medium flex items-center gap-2">
                  {row.productName}
                  {row.isDeadStock && (
                    <span className="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider">Dead Stock</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-right cursor-help" title={formatExactCurrency(row.revenue)}>
                  {formatIndianCurrencyCompact(row.revenue)}
                </td>
                <td className="px-4 py-2 font-mono text-right">{Number(row.units).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 font-mono text-right">{Number(row.margin).toFixed(1)}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="4" className="px-4 py-4 text-center text-slate-500">No product data available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParetoAnalysisTable({ data }) {
  const rows = data || [];
  return (
    <div className="border border-[#E0E0E0] bg-white p-6">
      <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-tight mb-6">Pareto 80/20 Analysis (Top 10 Customers)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-y border-[#E0E0E0]">
            <tr>
              <th className="px-4 py-2 font-medium text-slate-600">Company</th>
              <th className="px-4 py-2 font-medium text-slate-600 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-[#0F172A] font-medium">{row.companyName}</td>
                <td className="px-4 py-2 font-mono text-right cursor-help" title={formatExactCurrency(row.revenue)}>
                  {formatIndianCurrencyCompact(row.revenue)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="2" className="px-4 py-4 text-center text-slate-500">No data available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // We assume backend runs on same host but port 8000. 
    // Usually Vite is configured to proxy /api requests, or we use full URL.
    // Let's use the local dev proxy or direct URL. Assuming proxy is set up.
    // If proxy isn't set up, we should fetch from http://localhost:8000/api/v1/analytics/dashboard/
    fetch('http://localhost:8000/api/v1/analytics/dashboard/')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading Dashboard Data...</div>;
  }
  
  if (error) {
    return <div className="p-6 text-sm text-rose-500">Failed to load dashboard: {error}</div>;
  }

  return (
    <DashboardErrorBoundary>
      <div className="flex flex-col gap-6">
        <KPIStrip data={data.kpis} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AgingReceivablesChart data={data.charts.agingReceivables} />
          <SeasonalDemandChart data={data.charts.seasonalDemand} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MarginVelocityTables data={data.charts.marginVelocity} />
          <ParetoAnalysisTable data={data.charts.paretoAnalysis} />
        </div>
      </div>
    </DashboardErrorBoundary>
  );
}
