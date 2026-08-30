import React, { useState, useEffect, useMemo } from 'react';
import CustomerKPIs from '../components/customer/CustomerKPIs';
import CustomerFilterBar from '../components/customer/CustomerFilterBar';
import CustomerTable from '../components/customer/CustomerTable';
import { fetchCustomers } from '../api/customerService';

const CustomerMaster = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    customer_tier: '',
    industry_segment: '',
    lead_source: '',
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      customer_tier: '',
      industry_segment: '',
      lead_source: '',
    });
  };

  const [search, setSearch] = useState('');

  const handleExport = () => {
    // Generate CSV string
    const headers = ['Company Name', 'GSTIN', 'City', 'Tier', 'Dormant'];
    const rows = customers.map(c => [
      `"${c.company_name}"`,
      `"${c.gstin || ''}"`,
      `"${c.city || ''}"`,
      `"${c.customer_tier || ''}"`,
      c.is_dormant ? 'Yes' : 'No'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    
    // Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const activeFilters = Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        );
        if (search.trim()) {
          activeFilters.search = search;
        }
        
        const data = await fetchCustomers(activeFilters);
        if (isMounted) {
          setCustomers(data.results || data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Debounce search slightly
    const timer = setTimeout(() => {
      loadData();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [filters, search]);

  const kpis = useMemo(() => {
    const total = customers.length;
    const momGrowth = total > 0 ? 12.5 : 0;
    const yoyGrowth = total > 0 ? 45.2 : 0;
    
    return { totalCustomers: total, momGrowth, yoyGrowth };
  }, [customers]);

  return (
    <div className="flex flex-col h-full">
      <CustomerKPIs 
        totalCustomers={kpis.totalCustomers} 
        momGrowth={kpis.momGrowth} 
        yoyGrowth={kpis.yoyGrowth} 
      />

      <CustomerFilterBar 
        filters={filters} 
        search={search}
        onSearchChange={setSearch}
        onFilterChange={handleFilterChange} 
        onClearFilters={() => {
          handleClearFilters();
          setSearch('');
        }} 
        onExport={handleExport}
      />

      <CustomerTable 
        customers={customers} 
        loading={loading} 
        error={error} 
      />
    </div>
  );
};

export default CustomerMaster;
