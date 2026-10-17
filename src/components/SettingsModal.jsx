import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { BucketDropdown } from './BucketDropdown';
import { ImportModal } from './ImportModal';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function SettingsModal({ onClose, settings, updateSetting, bucketMap, updateBucketFor, onDataChanged }) {
  const [activeTab, setActiveTab] = useState('general');
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [localRates, setLocalRates] = useState({
    current_usd_rate: settings.current_usd_rate || 15.42,
    nisab_threshold: settings.nisab_threshold || 10000,
    essential_pct: settings.essential_pct || 40,
    discretionary_pct: settings.discretionary_pct || 10,
    financial_pct: settings.financial_pct || 15,
    savings_pct: settings.savings_pct || 35,
  });

  const [zakatInputs, setZakatInputs] = useState({
    debt_receivable: settings.debt_receivable || 0,
    bank_balance_override: settings.bank_balance_override || '',
    prev_year_balances: settings.prev_year_balances || {},
  });

  const handleLocalChange = (key, value) => setLocalRates({ ...localRates, [key]: value });
  const handleZakatInputChange = (key, value) => setZakatInputs({ ...zakatInputs, [key]: value });

  const handlePrevMonthChange = (monthIdx, value) => {
    const key = String(monthIdx + 1).padStart(2, '0');
    setZakatInputs({
      ...zakatInputs,
      prev_year_balances: { ...zakatInputs.prev_year_balances, [key]: value }
    });
  };

  const saveGeneral = async () => {
    await updateSetting('current_usd_rate', parseFloat(localRates.current_usd_rate) || 15.42);
    await updateSetting('nisab_threshold', parseFloat(localRates.nisab_threshold) || 10000);
    await updateSetting('essential_pct', parseFloat(localRates.essential_pct) || 40);
    await updateSetting('discretionary_pct', parseFloat(localRates.discretionary_pct) || 10);
    await updateSetting('financial_pct', parseFloat(localRates.financial_pct) || 15);
    await updateSetting('savings_pct', parseFloat(localRates.savings_pct) || 35);
    alert('General settings saved!');
  };

  const saveZakatInputs = async () => {
    await updateSetting('debt_receivable', parseFloat(zakatInputs.debt_receivable) || 0);
    await updateSetting('bank_balance_override', zakatInputs.bank_balance_override);
    await updateSetting('prev_year_balances', zakatInputs.prev_year_balances);
    alert('Zakat inputs saved!');
  };

  const filteredMap = bucketMap.filter(row => 
    row.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.subcategory.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPct = 
    (parseFloat(localRates.essential_pct) || 0) + 
    (parseFloat(localRates.discretionary_pct) || 0) + 
    (parseFloat(localRates.financial_pct) || 0) + 
    (parseFloat(localRates.savings_pct) || 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Settings</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsImportOpen(true)}
                className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-200"
              >
                Import Data
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="flex gap-1 border-b mb-4 overflow-x-auto">
            <button onClick={() => setActiveTab('general')} className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${activeTab === 'general' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>General</button>
            <button onClick={() => setActiveTab('buckets')} className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${activeTab === 'buckets' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Bucket Map</button>
            <button onClick={() => setActiveTab('zakat')} className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${activeTab === 'zakat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Zakat Inputs</button>
          </div>

          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">USD → MVR Rate</label>
                  <input type="number" step="0.01" value={localRates.current_usd_rate} onChange={(e) => handleLocalChange('current_usd_rate', e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200" />
                </div>
                <div className="min-w-0">
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Nisab (MVR)</label>
                  <input type="number" step="0.01" value={localRates.nisab_threshold} onChange={(e) => handleLocalChange('nisab_threshold', e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200" />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Bucket Allocations (%)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0"><label className="text-xs text-gray-400">Essential</label><input type="number" value={localRates.essential_pct} onChange={(e) => handleLocalChange('essential_pct', e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200" /></div>
                  <div className="min-w-0"><label className="text-xs text-gray-400">Discretionary</label><input type="number" value={localRates.discretionary_pct} onChange={(e) => handleLocalChange('discretionary_pct', e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200" /></div>
                  <div className="min-w-0"><label className="text-xs text-gray-400">Financial/Obligatory</label><input type="number" value={localRates.financial_pct} onChange={(e) => handleLocalChange('financial_pct', e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200" /></div>
                  <div className="min-w-0"><label className="text-xs text-gray-400">Savings</label><input type="number" value={localRates.savings_pct} onChange={(e) => handleLocalChange('savings_pct', e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200" /></div>
                </div>
                <div className={`text-xs mt-1 ${totalPct === 100 ? 'text-green-600' : 'text-red-500'}`}>
                  Total: {totalPct.toFixed(0)}% {totalPct !== 100 && '(should equal 100%)'}
                </div>
              </div>

              <button onClick={saveGeneral} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">Save General Settings</button>
            </div>
          )}

          {activeTab === 'buckets' && (
            <div>
              <div className="relative mb-4">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search category or subcategory..." className="w-full p-3 pl-10 bg-gray-50 rounded-lg border border-gray-200" />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredMap.length === 0 ? (
                  <div className="text-center p-4 text-gray-400 text-sm">No matches.</div>
                ) : (
                  filteredMap.map((row) => (
                    <div key={row.id} className="flex flex-col gap-2 bg-gray-50 p-3 rounded-lg">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-400">{row.category}</div>
                        <div className="text-sm font-semibold text-gray-700 truncate">{row.subcategory}</div>
                      </div>
                      <BucketDropdown 
                        currentValue={row.bucket}
                        onSelect={(newBucket) => updateBucketFor(row.category, row.subcategory, newBucket)}
                      />
                    </div>
                  ))
                )}
              </div>

              <p className="text-xs text-gray-400 mt-3 text-center">
                Changes apply only to <strong>future</strong> transactions.
              </p>
            </div>
          )}

          {activeTab === 'zakat' && (
            <div className="space-y-5">
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                <strong>Zakat Formula:</strong> (Bank Balance − Debt Payable + Debt Receivable) × 2.5%<br/>
                <strong>Eligible if:</strong> Bank Balance {'>'} Last Year Same Month OR Bank Balance {'>'} Nisab
              </div>

              <div className="min-w-0">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Debt Receivable (MVR)</label>
                <input type="number" step="0.01" value={zakatInputs.debt_receivable} onChange={(e) => handleZakatInputChange('debt_receivable', e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200" placeholder="Money others owe you" />
              </div>

              <div className="min-w-0">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Bank Balance Override (MVR)</label>
                <input type="number" step="0.01" value={zakatInputs.bank_balance_override} onChange={(e) => handleZakatInputChange('bank_balance_override', e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200" placeholder="Leave blank to auto-calculate" />
                <div className="text-xs text-gray-400 mt-1">Auto-calc uses all-time income − expenses.</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Previous Year Monthly Balances (MVR)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MONTH_NAMES.map((name, idx) => {
                    const key = String(idx + 1).padStart(2, '0');
                    return (
                      <div key={key} className="min-w-0">
                        <label className="text-[10px] text-gray-400">{name}</label>
                        <input type="number" step="0.01" value={zakatInputs.prev_year_balances[key] || ''} onChange={(e) => handlePrevMonthChange(idx, e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm" placeholder="0" />
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-400 mt-2">Compare current month against the same month last year.</div>
              </div>

              <button onClick={saveZakatInputs} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">Save Zakat Inputs</button>
            </div>
          )}

        </div>
      </div>

      {isImportOpen && (
        <ImportModal 
          onClose={() => setIsImportOpen(false)} 
          onImportComplete={() => {
            if (onDataChanged) onDataChanged();
            // We no longer close the modal here. ImportModal closes itself when the user is ready.
          }}
        />
      )}
    </>
  );
}
