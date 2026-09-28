/**
 * OrdersDashboard.jsx — /orders
 *
 * Business-level analytics dashboard for order data.
 * Shows KPI cards, status breakdown, monthly trend, handler analysis,
 * and a drill-down order table with filters and export.
 *
 * Follows Pragmatic Modernism: IBM Plex Sans UI, IBM Plex Mono data,
 * Navy #0F172A, Blue #2563EB, 0px border-radius, 1px solid #E2E8F0.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  TrendingUp,
  IndianRupee,
  BarChart3,
  Download,
  Filter,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { authClient } from '../api/customerService';

// ---------------------------------------------------------------------------
// INR Formatter
// ---------------------------------------------------------------------------

const formatINR = (value) => {
  if (value == null) return '₹0';
  const num = Number(value);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const formatINRFull = (value) => {
  if (value == null) return '₹0';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

// ---------------------------------------------------------------------------
// Pie colors
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  Pending: '#F59E0B',
  Confirmed: '#10B981',
  Synced_To_Tally: '#2563EB',
  Shipped: '#6366F1',
  Delivered: '#059669',
  Cancelled: '#EF4444',
};

const HANDLER_COLORS = ['#2563EB', '#0F172A', '#6366F1', '#10B981'];

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ icon: Icon, label, value, subValue, subLabel, trend }) {
  return (
    <div className="bg-white border border-[#E2E8F0] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 bg-[#F1F5F9] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#2563EB]" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-mono ${trend >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold font-mono text-[#0F172A]">{value}</p>
      {subValue && (
        <p className="text-xs text-[#94A3B8] font-mono mt-1">
          {subLabel}: {subValue}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }) {
  const colors = {
    Pending: 'bg-[#FEF3C7] text-[#92400E]',
    Confirmed: 'bg-[#D1FAE5] text-[#065F46]',
    Synced_To_Tally: 'bg-[#DBEAFE] text-[#1E40AF]',
    Shipped: 'bg-[#E0E7FF] text-[#3730A3]',
    Delivered: 'bg-[#D1FAE5] text-[#065F46]',
    Cancelled: 'bg-[#FEE2E2] text-[#991B1B]',
  };
  const cls = colors[status] || 'bg-[#F1F5F9] text-[#475569]';
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-mono font-medium ${cls}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function OrdersDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [handlerFilter, setHandlerFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState({ statuses: [], handlers: [] });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, ordersRes] = await Promise.all([
        authClient.get('orders/analytics/'),
        authClient.get('orders/', {
          params: {
            limit: 200,
            ...(statusFilter && { status: statusFilter }),
            ...(handlerFilter && { handled_by: handlerFilter }),
          },
        }),
      ]);
      setAnalytics(analyticsRes.data);
      setOrders(ordersRes.data.results || []);
      setTotalOrders(ordersRes.data.total || 0);
      setFilterOptions(analyticsRes.data.filters || { statuses: [], handlers: [] });
    } catch (err) {
      console.error('Failed to fetch order data:', err);
      setError('Failed to load order data. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, handlerFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Export to CSV (client-side)
  // ---------------------------------------------------------------------------

  const handleExport = () => {
    if (!orders.length) return;
    const headers = ['Order ID', 'Date', 'Customer', 'Total Value', 'Handled By', 'Status', 'Priority', 'Freight'];
    const rows = orders.map((o) => [
      o.id,
      o.order_date ? new Date(o.order_date).toLocaleDateString('en-IN') : '',
      o.customer_name,
      o.total_value,
      o.handled_by,
      o.status,
      o.order_priority,
      o.freight_cost,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-[#2563EB] animate-spin" />
        <span className="ml-3 text-sm text-[#64748B]">Loading order analytics…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 border border-[#FCA5A5] bg-[#FEF2F2]">
        <AlertCircle className="w-5 h-5 text-[#EF4444]" />
        <span className="text-sm text-[#991B1B]">{error}</span>
        <button onClick={fetchData} className="ml-auto text-sm text-[#2563EB] font-medium hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const kpis = analytics?.kpis || {};
  const charts = analytics?.charts || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Orders Analytics</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Business intelligence on order performance, handler efficiency, and revenue trends.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-3 py-1.5 text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={ShoppingCart} label="Total Orders" value={kpis.totalOrders?.toLocaleString() || '0'} />
        <KpiCard icon={IndianRupee} label="Total Revenue" value={formatINR(kpis.totalRevenue)} />
        <KpiCard icon={TrendingUp} label="Avg Order Value" value={formatINR(kpis.avgOrderValue)} />
        <KpiCard icon={BarChart3} label="MTD Orders" value={kpis.mtdOrders?.toLocaleString() || '0'} />
        <KpiCard icon={IndianRupee} label="MTD Revenue" value={formatINR(kpis.mtdRevenue)} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Trend */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] p-5">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Monthly Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={charts.monthlyTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
              <YAxis tickFormatter={formatINR} tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
              <RechartsTooltip
                formatter={(v) => [formatINRFull(v), 'Revenue']}
                contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 0, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
              />
              <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown Pie */}
        <div className="bg-white border border-[#E2E8F0] p-5">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={charts.statusBreakdown || []}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                strokeWidth={1}
                stroke="#fff"
              >
                {(charts.statusBreakdown || []).map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name] || '#94A3B8'} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(v, n) => [v, n]}
                contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 0, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {(charts.statusBreakdown || []).map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5" style={{ backgroundColor: STATUS_COLORS[s.name] || '#94A3B8' }} />
                <span className="text-[#475569]">{s.name}</span>
                <span className="font-mono text-[#0F172A]">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Handler & Priority Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Handler breakdown */}
        <div className="bg-white border border-[#E2E8F0] p-5">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Orders by Handler</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.handlerBreakdown || []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans' }} width={120} />
              <RechartsTooltip
                formatter={(v) => [v, 'Orders']}
                contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 0, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#2563EB" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top customers */}
        <div className="bg-white border border-[#E2E8F0] p-5">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Top 10 Customers by Revenue</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.topCustomers || []}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'IBM Plex Sans' }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis tickFormatter={formatINR} tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
              <RechartsTooltip
                formatter={(v) => [formatINRFull(v), 'Revenue']}
                contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 0, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
              />
              <Bar dataKey="value" fill="#0F172A" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Order Table */}
      <div className="bg-white border border-[#E2E8F0]">
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0]">
          <h3 className="text-sm font-semibold text-[#0F172A]">
            Order Details
            <span className="ml-2 text-xs font-mono text-[#64748B]">({totalOrders})</span>
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-[#94A3B8]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-medium text-[#475569] focus:outline-none focus:border-[#2563EB]"
              >
                <option value="">All Statuses</option>
                {filterOptions.statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <select
              value={handlerFilter}
              onChange={(e) => setHandlerFilter(e.target.value)}
              className="border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-medium text-[#475569] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">All Handlers</option>
              {filterOptions.handlers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Order ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Customer</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Handled By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Priority</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#2563EB]">{order.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-xs text-[#475569]">
                    {order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-[#0F172A]">{order.customer_name}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#0F172A]">{formatINRFull(order.total_value)}</td>
                  <td className="px-4 py-3 text-xs text-[#475569]">{order.handled_by}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-xs text-[#475569]">{order.order_priority}</td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#94A3B8]">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
