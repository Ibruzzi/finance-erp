
import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { initSettings } from './db/database';
import { Plus, CreditCard, Settings, RefreshCw } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { syncAll } from './lib/sync';
import { AuthGate } from './components/AuthGate';
import { SyncStatus } from './components/SyncStatus';

import { MonthPicker } from './components/MonthPicker';
import { AppTabs } from './components/AppTabs';
import { ZakatCard } from './components/ZakatCard';
import { TotalDebtCard } from './components/TotalDebtCard';
import { CategoryTotals } from './components/CategoryTotals';
import { BucketBalances } from './components/BucketBalances';
import { RecentTransactions } from './components/RecentTransactions';
import { AddTransactionModal } from './components/AddTransactionModal';
import { ZakatPaidModal } from './components/ZakatPaidModal';
import { LoansModal } from './components/LoansModal';
import { SettingsModal } from './components/SettingsModal';
import { YearlySummary } from './components/YearlySummary';
import { RangeReport } from './components/RangeReport';
import { InsightsTab } from './components/InsightsTab';
import { BalanceReminderModal } from './components/BalanceReminderModal';
import { getDueReminderMonths } from './utils/balanceReminder';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'insights', label: 'Insights' },
  { key: 'summary', label: 'Summary' },
  { key: 'range', label: 'Range' },
];

function MainApp() {
  const {
    loadData, isLoading, settings, getBucketBalances, getCategoryTotals,
    calculateZakat, addTransaction, updateTransaction, deleteTransaction,
    getMonthTransactions, bucketMap, getBucketFromMap, getSubcategoriesFor,
    getCategories, updateSetting, loans, getLoanPaid, getTotalDebtPayable, transactions
  } = useStore();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isZakatPaidOpen, setIsZakatPaidOpen] = useState(false);
  const [isLoansOpen, setIsLoansOpen] = useState(false);
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // ---- Month-end bank balance reminder ----
  // `now` is refreshed when the app is reopened/refocused and every 30 minutes, so the
  // reminder appears on the last day of the month (or the next time the app is opened).
  const [now, setNow] = useState(() => new Date());
  // Months the user pressed "Remind me later" for: hidden until the app is reopened.
  const [snoozedMonths, setSnoozedMonths] = useState([]);

  useEffect(() => {
    initSettings().then(() => loadData());
  }, [loadData]);

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(refresh, 30 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncAll();
      await loadData();
    } catch (err) {
      console.error('Manual sync failed:', err);
      alert('Sync problem: ' + (err.message || err));
    } finally {
      // Always switch the spinner off, even if the sync failed.
      setIsSyncing(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center text-gray-500">Loading Finance ERP...</div>;

  const buckets = getBucketBalances(selectedMonth);
  const zakat = calculateZakat(selectedMonth);
  const { totals, grandTotal } = getCategoryTotals(selectedMonth, includeHistorical);
  const monthTransactions = getMonthTransactions(selectedMonth, includeHistorical);
  const totalDebt = getTotalDebtPayable();
  const allCategories = getCategories();

  // The Range report's category filter should also list categories that were removed
  // from the Bucket Map but still exist on past transactions.
  const rangeCategories = [
    ...allCategories,
    ...[...new Set(transactions.filter(t => t.deleted !== true).map(t => t.category).filter(Boolean))]
      .filter(c => !allCategories.includes(c))
      .sort((a, b) => a.localeCompare(b)),
  ];

  // Which month (if any) should we ask a bank balance for right now?
  const reminderEnabled = settings.balance_reminder_enabled !== false; // on unless switched off
  const dueReminderMonths = reminderEnabled
    ? getDueReminderMonths(now, settings.month_balances || {}, settings.balance_reminder_skipped || [])
        .filter(k => !snoozedMonths.includes(k))
    : [];
  const reminderMonth = dueReminderMonths[0] || null;

  const handleSaveReminderBalance = async (monthKey, amount) => {
    const latest = useStore.getState().settings.month_balances || {};
    await updateSetting('month_balances', { ...latest, [monthKey]: amount });
  };

  const handleSkipReminderMonth = async (monthKey) => {
    const latest = useStore.getState().settings.balance_reminder_skipped || [];
    if (!latest.includes(monthKey)) {
      await updateSetting('balance_reminder_skipped', [...latest, monthKey]);
    }
  };

  const handleEdit = (t) => {
    setEditingTransaction(t);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this transaction?')) {
      await deleteTransaction(id);
    }
  };

  // The payment must be dated INSIDE the month being viewed, because that is
  // where the zakat calculation looks for it. For the current month that is
  // right now; for any other month it is that month's last day.
  const zakatPaymentDate = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (selectedMonth === currentMonth) return new Date().toISOString();
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0, 12, 0, 0)).toISOString();
  };

  const handleMarkZakatPaid = async (amount) => {
    await addTransaction({
      type: 'Expense',
      category: 'Personal',
      subcategory: 'Zakat',
      amount_original: amount,
      currency: 'MVR',
      bucket: 'Financial/Obligatory',
      notes: `Zakat paid for ${selectedMonth}`,
      date: zakatPaymentDate()
    });
    setIsZakatPaidOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans overflow-x-hidden">
      <header className="bg-white sticky top-0 z-30 p-3 shadow-sm">
        <div className="flex flex-col gap-2 max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-gray-800">Finance ERP</h1>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <MonthPicker selectedMonth={selectedMonth} onChange={setSelectedMonth} />
            </div>
            <button 
              onClick={handleManualSync}
              disabled={isSyncing}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg flex-shrink-0"
              title="Sync Now"
            >
              <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={() => setIsLoansOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg flex-shrink-0 relative"
              title="Loans"
            >
              <CreditCard size={20} />
              {loans.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {loans.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg flex-shrink-0"
            >
              <Settings size={20} />
            </button>
          </div>
          <SyncStatus />
        </div>
      </header>

      <AppTabs active={activeTab} onChange={setActiveTab} tabs={TABS} />

      <div className="p-3 max-w-4xl mx-auto overflow-hidden">
        {activeTab === 'dashboard' && (
          <>
            <div className="flex justify-end mb-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 select-none bg-white px-3 py-1.5 rounded-lg shadow-sm">
                <input
                  type="checkbox"
                  checked={includeHistorical}
                  onChange={(e) => setIncludeHistorical(e.target.checked)}
                  className="accent-blue-600"
                />
                Include Historical
              </label>
            </div>

            <ZakatCard
              zakat={zakat}
              selectedMonth={selectedMonth}
              onMarkPaid={() => setIsZakatPaidOpen(true)}
            />
            <TotalDebtCard
              totalDebt={totalDebt}
              loans={loans}
              onManage={() => setIsLoansOpen(true)}
            />
            <CategoryTotals totals={totals} grandTotal={grandTotal} />
            <BucketBalances buckets={buckets} />
            <RecentTransactions
              transactions={monthTransactions}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </>
        )}

        {activeTab === 'insights' && <InsightsTab selectedMonth={selectedMonth} />}
        {activeTab === 'summary' && <YearlySummary />}
        {activeTab === 'range' && <RangeReport allCategories={rangeCategories} />}
      </div>

      <button
        onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-transform active:scale-95 z-20"
      >
        <Plus size={28} />
      </button>

      {isModalOpen && (
        <AddTransactionModal
          onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
          onSave={async (data) => {
            if (editingTransaction) {
              await updateTransaction(editingTransaction.id, data);
            } else {
              await addTransaction(data);
            }
            setIsModalOpen(false);
            setEditingTransaction(null);
          }}
          settings={settings}
          initialData={editingTransaction}
          getBucketFromMap={getBucketFromMap}
          getSubcategoriesFor={getSubcategoriesFor}
          getCategories={getCategories}
          loans={loans}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          updateSetting={updateSetting}
          bucketMap={bucketMap}
          updateBucketFor={useStore.getState().updateBucketFor}
          addCategoryEntry={useStore.getState().addCategoryEntry}
          removeCategoryEntry={useStore.getState().removeCategoryEntry}
          removeWholeCategory={useStore.getState().removeWholeCategory}
          onDataChanged={() => useStore.getState().loadData()}
        />
      )}

      {isZakatPaidOpen && (
        <ZakatPaidModal
          onClose={() => setIsZakatPaidOpen(false)}
          onConfirm={handleMarkZakatPaid}
          suggestedAmount={zakat.zakatDue}
        />
      )}

      {reminderMonth && !isSettingsOpen && (
        <BalanceReminderModal
          key={reminderMonth}
          monthKey={reminderMonth}
          remaining={dueReminderMonths.length}
          onSave={handleSaveReminderBalance}
          onLater={() => setSnoozedMonths(prev => [...prev, reminderMonth])}
          onSkip={() => handleSkipReminderMonth(reminderMonth)}
        />
      )}

      {isLoansOpen && (
        <LoansModal
          onClose={() => setIsLoansOpen(false)}
          loans={loans}
          getLoanPaid={getLoanPaid}
          addLoan={useStore.getState().addLoan}
          updateLoan={useStore.getState().updateLoan}
          deleteLoan={useStore.getState().deleteLoan}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthGate>
      <MainApp />
    </AuthGate>
  );
}

export default App;

