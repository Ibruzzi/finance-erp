
import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useStore } from './store/useStore';
import { initSettings } from './db/database';
import { Plus, CreditCard, Settings, RefreshCw } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { syncAll } from './lib/sync';
import { AuthGate } from './components/AuthGate';
import { isCloudSyncOn } from './lib/cloudMode';
import { SyncStatus } from './components/SyncStatus';
import { LoadingScreen } from './components/LoadingScreen';

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
import { getQuickAddSuggestions } from './utils/quickAdd';
import { getDueRecurring } from './utils/recurring';
import { QuickAddBar } from './components/QuickAddBar';
import { RecurringSuggestions } from './components/RecurringSuggestions';

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
  const [prefill, setPrefill] = useState(null); // quick-add starting values
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isZakatPaidOpen, setIsZakatPaidOpen] = useState(false);
  const [isLoansOpen, setIsLoansOpen] = useState(false);
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const cloudOn = isCloudSyncOn(); // false = local-only mode (no login, no sync)

  // ---- Month-end bank balance reminder ----
  // `now` is refreshed when the app is reopened/refocused and every 30 minutes, so the
  // reminder appears on the last day of the month (or the next time the app is opened).
  const [now, setNow] = useState(() => new Date());
  // Months the user pressed "Remind me later" for: hidden until the app is reopened.
  const [snoozedMonths, setSnoozedMonths] = useState([]);

  // Quick-add options: recomputed from your recent activity (see utils/quickAdd.js).
  const quickSuggestions = useMemo(() => getQuickAddSuggestions(transactions, now), [transactions, now]);

  // ---- Phone back button (Android app) ----
  // Closes the top-most pop-up first, then returns to the Dashboard tab, then exits.
  // The handler reads the latest screen state through this ref (filled in below).
  const backRef = useRef({});
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listener = null;
    let cancelled = false;
    CapacitorApp.addListener('backButton', () => {
      const b = backRef.current;
      if (b.reminderOpen) b.snoozeReminder();
      else if (b.isModalOpen) b.closeAddModal();
      else if (b.isZakatPaidOpen) b.closeZakatPaid();
      else if (b.isLoansOpen) b.closeLoans();
      else if (b.isSettingsOpen) b.closeSettings();
      else if (b.activeTab !== 'dashboard') b.goDashboard();
      else CapacitorApp.exitApp();
    }).then((l) => { if (cancelled) l.remove(); else listener = l; });
    return () => { cancelled = true; if (listener) listener.remove(); };
  }, []);

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

  if (isLoading) return <LoadingScreen message="Loading Finance ERP..." />;

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

  backRef.current = {
    reminderOpen: !!reminderMonth && !isSettingsOpen,
    snoozeReminder: () => setSnoozedMonths(prev => [...prev, reminderMonth]),
    isModalOpen,
    closeAddModal: () => { setIsModalOpen(false); setEditingTransaction(null); setPrefill(null); },
    isZakatPaidOpen,
    closeZakatPaid: () => setIsZakatPaidOpen(false),
    isLoansOpen,
    closeLoans: () => setIsLoansOpen(false),
    isSettingsOpen,
    closeSettings: () => setIsSettingsOpen(false),
    activeTab,
    goDashboard: () => setActiveTab('dashboard'),
  };

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

  // ---- Recurring suggestions: approve (adds the transaction) or skip ----
  const dueRecurring = getDueRecurring(settings.recurring_rules || [], now);

  const markRecurring = async (ruleId, monthKey, status) => {
    const latest = useStore.getState().settings.recurring_rules || [];
    await updateSetting(
      'recurring_rules',
      latest.map(r => (r.id === ruleId ? { ...r, handled: { ...(r.handled || {}), [monthKey]: status } } : r))
    );
  };

  const approveRecurring = async (item, amount) => {
    const r = item.rule;
    await addTransaction({
      type: r.type,
      category: r.category,
      subcategory: r.subcategory,
      amount_original: amount,
      currency: r.currency,
      bucket: r.type === 'Income' ? 'Income' : getBucketFromMap(r.category, r.subcategory),
      notes: r.notes || r.name,
      loan_uuid: r.loan_uuid || null,
      date: item.dueDate.toISOString(),
    });
    await markRecurring(r.id, item.monthKey, 'approved');
  };

  const rejectRecurring = (item) => markRecurring(item.rule.id, item.monthKey, 'rejected');

  const openQuickAdd = (s) => {
    setEditingTransaction(null);
    setPrefill({ type: 'Expense', category: s.category, subcategory: s.subcategory, amount_original: s.amount_original, currency: s.currency });
    setIsModalOpen(true);
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
            {cloudOn && (
              <button 
                onClick={handleManualSync}
                disabled={isSyncing}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg flex-shrink-0"
                title="Sync Now"
              >
                <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
              </button>
            )}
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
          {cloudOn && <SyncStatus />}
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

            <QuickAddBar suggestions={quickSuggestions} onPick={openQuickAdd} />
            <RecurringSuggestions items={dueRecurring} onApprove={approveRecurring} onReject={rejectRecurring} />

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
        onClick={() => { setEditingTransaction(null); setPrefill(null); setIsModalOpen(true); }}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-transform active:scale-95 z-20"
      >
        <Plus size={28} />
      </button>

      {isModalOpen && (
        <AddTransactionModal
          onClose={() => { setIsModalOpen(false); setEditingTransaction(null); setPrefill(null); }}
          onSave={async (data) => {
            if (editingTransaction) {
              await updateTransaction(editingTransaction.id, data);
            } else {
              await addTransaction(data);
            }
            setIsModalOpen(false);
            setEditingTransaction(null);
            setPrefill(null);
          }}
          settings={settings}
          initialData={editingTransaction}
          prefill={prefill}
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
          getCategories={getCategories}
          getSubcategoriesFor={getSubcategoriesFor}
          loans={loans}
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

