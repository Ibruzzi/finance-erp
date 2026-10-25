
import { useState } from 'react';
import { X, Search, ChevronLeft, ChevronRight, Trash2, Plus } from 'lucide-react';
import { BucketDropdown } from './BucketDropdown';
import { CustomSelect } from './CustomSelect';
import { isCloudSyncOn, setCloudSync } from '../lib/cloudMode';
import { isProtectedCategory, isProtectedEntry } from '../store/useStore';
import { ImportModal } from './ImportModal';
import { RecurringManager } from './RecurringManager';
import { downloadBackup } from '../utils/backup';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const NEW_CATEGORY_OPTION = '+ New category…';

export function SettingsModal({
  onClose, settings, updateSetting, bucketMap, updateBucketFor, onDataChanged,
  addCategoryEntry, removeCategoryEntry, removeWholeCategory,
  getCategories, getSubcategoriesFor, loans
}) {
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

  // Insights → Budget Pulse: should it also count imported historical entries?
  const [budgetPulseHist, setBudgetPulseHist] = useState(settings.budget_pulse_include_historical === true);

  const [backupMsg, setBackupMsg] = useState('');

  // ----- Add / remove categories (Bucket Map tab) -----
  const [addCategory, setAddCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [addBucket, setAddBucket] = useState('Discretionary');
  const [catMessage, setCatMessage] = useState(null); // { ok, text }

  const categoryNames = [...new Set(bucketMap.map(r => r.category))].sort((a, b) => a.localeCompare(b));
  const effectiveCategory = addCategory === NEW_CATEGORY_OPTION ? newCategoryName.trim() : addCategory;

  const handleAddEntry = async () => {
    const result = await addCategoryEntry(effectiveCategory, newSubcategory, addBucket);
    setCatMessage({ ok: result.ok, text: result.message });
    if (result.ok) {
      setNewSubcategory('');
      if (addCategory === NEW_CATEGORY_OPTION) {
        // Switch the picker to the category we just created.
        setAddCategory(effectiveCategory);
        setNewCategoryName('');
      }
    }
  };

  const handleRemoveEntry = async (category, subcategory) => {
    const ok = window.confirm(
      `Remove "${subcategory}" from ${category}?\n\n` +
      'Your past transactions keep their category exactly as they are. ' +
      'It will only stop appearing when you add NEW transactions.'
    );
    if (!ok) return;
    const result = await removeCategoryEntry(category, subcategory);
    setCatMessage({ ok: result.ok, text: result.message });
  };

  const handleRemoveCategory = async (category, count) => {
    const ok = window.confirm(
      `Remove the whole "${category}" category (${count} subcategories)?\n\n` +
      'Your past transactions keep their category exactly as they are. ' +
      'It will only stop appearing when you add NEW transactions.'
    );
    if (!ok) return;
    const result = await removeWholeCategory(category);
    setCatMessage({ ok: result.ok, text: result.message });
  };

  const handleBackup = async () => {
    try {
      const counts = await downloadBackup();
      setBackupMsg(
        `Backup saved: ${counts.transactions} transactions, ${counts.loans} loans, ` +
        `${counts.bucket_map} bucket rules, ${counts.settings} settings. Check your Downloads folder.`
      );
    } catch (err) {
      console.error('Backup failed:', err);
      setBackupMsg('Backup failed: ' + (err.message || err));
    }
  };

  const [zakatInputs, setZakatInputs] = useState({
    debt_receivable: settings.debt_receivable || 0,
    month_balances: settings.month_balances || {},
    prev_year_balances: settings.prev_year_balances || {},
  });

  // Which year's month-end balances are being edited on the Zakat tab.
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());

  const handleLocalChange = (key, value) => setLocalRates({ ...localRates, [key]: value });
  const handleZakatInputChange = (key, value) => setZakatInputs({ ...zakatInputs, [key]: value });

  const handlePrevMonthChange = (monthIdx, value) => {
    const key = String(monthIdx + 1).padStart(2, '0');
    setZakatInputs({
      ...zakatInputs,
      prev_year_balances: { ...zakatInputs.prev_year_balances, [key]: value }
    });
  };

  const handleMonthBalanceChange = (monthIdx, value) => {
    const key = `${balanceYear}-${String(monthIdx + 1).padStart(2, '0')}`;
    setZakatInputs({
      ...zakatInputs,
      month_balances: { ...zakatInputs.month_balances, [key]: value }
    });
  };

  const saveGeneral = async () => {
    await updateSetting('current_usd_rate', parseFloat(localRates.current_usd_rate) || 15.42);
    await updateSetting('nisab_threshold', parseFloat(localRates.nisab_threshold) || 10000);
    await updateSetting('essential_pct', parseFloat(localRates.essential_pct) || 40);
    await updateSetting('discretionary_pct', parseFloat(localRates.discretionary_pct) || 10);
    await updateSetting('financial_pct', parseFloat(localRates.financial_pct) || 15);
    await updateSetting('savings_pct', parseFloat(localRates.savings_pct) || 35);
    await updateSetting('budget_pulse_include_historical', budgetPulseHist);
    alert('General settings saved!');
  };

  const saveZakatInputs = async () => {
    await updateSetting('debt_receivable', parseFloat(zakatInputs.debt_receivable) || 0);
    // Drop empty boxes so a blank month means "not entered", not zero.
    const cleanedBalances = {};
    Object.entries(zakatInputs.month_balances).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined && !Number.isNaN(parseFloat(v))) {
        cleanedBalances[k] = parseFloat(v);
      }
    });
    await updateSetting('month_balances', cleanedBalances);
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
            <button onClick={() => setActiveTab('recurring')} className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${activeTab === 'recurring' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Recurring</button>
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

              <label className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={budgetPulseHist}
                  onChange={(e) => setBudgetPulseHist(e.target.checked)}
                  className="accent-blue-600 mt-0.5"
                />
                <span>
                  Include imported historical entries in Insights → Budget Pulse
                  <span className="block text-xs text-gray-400">Off by default. Turn on to see budget usage for past months.</span>
                </span>
              </label>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-sm font-semibold text-gray-700 mb-1">
                  Cloud sync &amp; login: {isCloudSyncOn() ? 'ON' : 'OFF'}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {isCloudSyncOn()
                    ? 'You sign in and your data is backed up to and synced through the cloud. Turning this off keeps everything on this device only (nothing is deleted).'
                    : 'No login. Your data stays on this device only, so it is not backed up anywhere else. Turn this on to sign in and sync with the cloud.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const turningOn = !isCloudSyncOn();
                    const ok = window.confirm(
                      turningOn
                        ? 'Turn cloud sync ON? The app will restart and ask you to sign in.'
                        : 'Turn cloud sync OFF? The app will restart without a login. Your data stays on this device.'
                    );
                    if (ok) setCloudSync(turningOn);
                  }}
                  className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100"
                >
                  {isCloudSyncOn() ? 'Turn cloud sync off' : 'Turn cloud sync on'}
                </button>
              </div>

              <button onClick={saveGeneral} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">Save General Settings</button>

              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Backup</label>
                <p className="text-xs text-gray-400 mb-2">
                  Saves all your data to a file on this device. Do this now and then, and before anything risky.
                </p>
                <button onClick={handleBackup} className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-200 transition">
                  Download Backup (.json)
                </button>
                {backupMsg && <div className="text-xs text-gray-600 mt-2">{backupMsg}</div>}
              </div>
            </div>
          )}

          {activeTab === 'buckets' && (
            <div>
              {/* ---------- Add a category / subcategory ---------- */}
              <div className="bg-blue-50 rounded-lg p-3 mb-4 space-y-2">
                <div className="text-xs font-semibold text-blue-700">Add a category or subcategory</div>

                <CustomSelect
                  value={addCategory}
                  onChange={setAddCategory}
                  options={[...categoryNames, NEW_CATEGORY_OPTION]}
                  placeholder="Choose a category"
                  required={false}
                />

                {addCategory === NEW_CATEGORY_OPTION && (
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    className="w-full p-2 bg-white rounded-lg border border-gray-200 text-sm"
                  />
                )}

                <input
                  type="text"
                  value={newSubcategory}
                  onChange={(e) => setNewSubcategory(e.target.value)}
                  placeholder="Subcategory name"
                  className="w-full p-2 bg-white rounded-lg border border-gray-200 text-sm"
                />

                {effectiveCategory === 'Income' ? (
                  <div className="text-xs text-gray-500">Bucket: Income (set automatically)</div>
                ) : (
                  <div>
                    <div className="text-[11px] text-gray-500 mb-1">Bucket for this subcategory</div>
                    <BucketDropdown currentValue={addBucket} onSelect={setAddBucket} />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddEntry}
                  disabled={!effectiveCategory || !newSubcategory.trim()}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Plus size={16} /> Add
                </button>

                {catMessage && (
                  <div className={`text-xs ${catMessage.ok ? 'text-green-700' : 'text-red-600'}`}>
                    {catMessage.text}
                  </div>
                )}
              </div>

              {/* ---------- Search ---------- */}
              <div className="relative mb-4">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search category or subcategory..." className="w-full p-3 pl-10 bg-gray-50 rounded-lg border border-gray-200" />
              </div>

              {/* ---------- Grouped list ---------- */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredMap.length === 0 ? (
                  <div className="text-center p-4 text-gray-400 text-sm">No matches.</div>
                ) : (
                  [...new Set(filteredMap.map(r => r.category))]
                    .sort((a, b) => a.localeCompare(b))
                    .map(cat => {
                      const rows = filteredMap.filter(r => r.category === cat);
                      const totalInCategory = bucketMap.filter(r => r.category === cat).length;
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-1 px-1">
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                              {cat} <span className="font-normal text-gray-400">({totalInCategory})</span>
                            </div>
                            {!isProtectedCategory(cat) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCategory(cat, totalInCategory)}
                                className="text-gray-400 hover:text-red-600 p-1"
                                title={`Remove the ${cat} category`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          <div className="space-y-2">
                            {rows.map((row) => (
                              <div key={row.id} className="flex flex-col gap-2 bg-gray-50 p-3 rounded-lg">
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <div className="text-sm font-semibold text-gray-700 truncate">{row.subcategory}</div>
                                  {isProtectedEntry(row.category, row.subcategory) ? (
                                    <span className="text-[10px] text-gray-400 flex-shrink-0">used by app</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEntry(row.category, row.subcategory)}
                                      className="text-gray-400 hover:text-red-600 p-1 flex-shrink-0"
                                      title={`Remove ${row.subcategory}`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                                <BucketDropdown
                                  currentValue={row.bucket}
                                  onSelect={(newBucket) => updateBucketFor(row.category, row.subcategory, newBucket)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <p className="text-xs text-gray-400 mt-3 text-center">
                Bucket changes apply only to <strong>future</strong> transactions.
                Removing a category never changes past transactions.
              </p>
            </div>
          )}

          {activeTab === 'recurring' && (
            <RecurringManager
              rules={settings.recurring_rules || []}
              onChange={(rules) => updateSetting('recurring_rules', rules)}
              getCategories={getCategories}
              getSubcategoriesFor={getSubcategoriesFor}
              loans={loans || []}
            />
          )}

          {activeTab === 'zakat' && (
            <div className="space-y-5">
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                <strong>Zakat Formula:</strong> (Bank Balance − Debt Payable + Debt Receivable) × 2.5%<br/>
                <strong>Eligible if:</strong> Bank Balance {'>'} Last Year Same Month OR Bank Balance {'>'} Nisab
              </div>

              <label className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={settings.balance_reminder_enabled !== false}
                  onChange={(e) => updateSetting('balance_reminder_enabled', e.target.checked)}
                  className="accent-blue-600 mt-0.5"
                />
                <span>
                  Remind me to enter my bank balance on the last day of each month
                  <span className="block text-xs text-gray-400">If the app isn't opened that day, the reminder appears the next time you open it.</span>
                </span>
              </label>

              <div className="min-w-0">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Debt Receivable (MVR)</label>
                <input type="number" step="0.01" value={zakatInputs.debt_receivable} onChange={(e) => handleZakatInputChange('debt_receivable', e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200" placeholder="Money others owe you" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Bank Balance by Month (MVR)</label>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg border border-gray-200 mb-3">
                  <button type="button" onClick={() => setBalanceYear(balanceYear - 1)} className="p-2 text-gray-500 hover:text-gray-800">
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm font-bold text-gray-700">{balanceYear}</span>
                  <button type="button" onClick={() => setBalanceYear(balanceYear + 1)} className="p-2 text-gray-500 hover:text-gray-800">
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MONTH_NAMES.map((name, idx) => {
                    const key = `${balanceYear}-${String(idx + 1).padStart(2, '0')}`;
                    const val = zakatInputs.month_balances[key];
                    return (
                      <div key={key} className="min-w-0">
                        <label className="text-[10px] text-gray-400">{name}</label>
                        <input type="number" step="0.01" value={val ?? ''} onChange={(e) => handleMonthBalanceChange(idx, e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm" placeholder="—" />
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-400 mt-2">Type your actual bank balance for each month, as in your Excel sheet. A month left blank shows no zakat figure.</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Previous Year Monthly Balances — 2025 (MVR)</label>
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
                <div className="text-xs text-gray-400 mt-2">Used for "same month last year" when viewing 2026. For later years, the balances you enter above are used automatically.</div>
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

