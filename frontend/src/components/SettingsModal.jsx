import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import client from '../api/customerService';

const SettingsModal = ({ onClose }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await client.get('config/');
        // Ensure defaults if missing
        const data = res.data || {};
        setConfig({
          dormancy_days: data.dormancy_days || 90,
          tiering_thresholds: data.tiering_thresholds || { A: 500000, B: 250000, C: 0 },
          churn_risk_baseline: data.churn_risk_baseline || 'selling_price'
        });
      } catch (err) {
        setError('Failed to load configuration.');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleTierChange = (tier, value) => {
    setConfig(prev => ({
      ...prev,
      tiering_thresholds: {
        ...prev.tiering_thresholds,
        [tier]: Number(value)
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await client.put('config/', config);
      onClose();
    } catch (err) {
      setError('Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm">
      <div className="w-[450px] bg-white border-l border-[#E0E0E0] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-6 border-b border-[#E0E0E0] bg-slate-50">
          <h2 className="text-lg font-bold text-[#0F172A] tracking-tight uppercase">Platform Configuration</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {error && (
            <div className="p-3 border border-rose-200 bg-rose-50 text-rose-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-slate-500 text-sm font-medium">Loading settings...</div>
          ) : config ? (
            <>
              {/* Dormancy Settings */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#E0E0E0] pb-2">Customer Dormancy</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Dormancy Threshold (Days)</label>
                  <p className="text-xs text-slate-500 mb-2">Customers with no orders in this period will be flagged as dormant.</p>
                  <input 
                    type="number"
                    value={config.dormancy_days}
                    onChange={(e) => handleChange('dormancy_days', Number(e.target.value))}
                    className="w-full border border-[#E0E0E0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
              </section>

              {/* Tiering Settings */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#E0E0E0] pb-2">Value Tiering (LTV)</h3>
                <p className="text-xs text-slate-500 mb-2">Minimum lifetime spend required to qualify for each tier.</p>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tier A Threshold (₹)</label>
                  <input 
                    type="number"
                    value={config.tiering_thresholds.A}
                    onChange={(e) => handleTierChange('A', e.target.value)}
                    className="w-full border border-[#E0E0E0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tier B Threshold (₹)</label>
                  <input 
                    type="number"
                    value={config.tiering_thresholds.B}
                    onChange={(e) => handleTierChange('B', e.target.value)}
                    className="w-full border border-[#E0E0E0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
              </section>

              {/* Churn Risk */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#E0E0E0] pb-2">Churn-Risk Flagging</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Baseline Price Catalog</label>
                  <p className="text-xs text-slate-500 mb-2">Flag customers who paid more than the benchmark price.</p>
                  <select
                    value={config.churn_risk_baseline}
                    onChange={(e) => handleChange('churn_risk_baseline', e.target.value)}
                    className="w-full border border-[#E0E0E0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  >
                    <option value="selling_price">Standard Selling Price</option>
                    <option value="landed_cost">Landed Cost</option>
                  </select>
                </div>
              </section>
            </>
          ) : null}
        </div>

        <div className="p-6 border-t border-[#E0E0E0] bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-[#E0E0E0] bg-white text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading || saving}
            className="flex items-center gap-2 px-4 py-2 border border-[#2563EB] bg-[#2563EB] text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Apply Rules'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
