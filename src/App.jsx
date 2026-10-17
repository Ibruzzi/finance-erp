import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { initSettings } from './db/database';
import { Plus, CreditCard, Settings } from 'lucide-react';

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

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'insights', label: 'Insights' },
  { key: 'summary', label: 'Summary' },
  { key: 'range', label: 'Range' },
];

function App() {
  const {
    loadData, isLoading, settings, getBucketBalances, getCategoryTotals,
    calculateZakat, addTransaction, updateTransaction, deleteTransaction,
    getMonthTransactions, bucketMap, getBucketFromMap, getSubcategoriesFor,
    getCategories, updateSetting, loans, getLoanPaid, getTotalDebtPayable
  } = useStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isZakatPaidOpen, setIsZakatPaidOpen] = useState(false);
  const [isLoansOpen, setIsLoansOpen] = useState(false);

  // Dashboard Historical Toggle
  const [includeHistorical, setIncludeHistorical] = useState(false);

  useEffect(() => {
    initSettings().then(() => loadData());
  }, [loadData]);

  if (isLoading) return <div className="p-10 text-center text-gray-500">Loading Finance ERP...</div>;

  const buckets = getBucketBalances(selectedMonth); // Always live
  const zakat = calculateZakat(selectedMonth); // Always live
  const { totals, grandTotal } = getCategoryTotals(selectedMonth, includeHistorical);
  const monthTransactions = getMonthTransactions(selectedMonth, includeHistorical);
  const totalDebt = getTotalDebtPayable();
  const allCategories = getCategories();

  const handleEdit = (t) => {
    setEditingTransaction(t);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this transaction?')) {
      await deleteTransaction(id);
    }
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
      date: new Date().toISOString()
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
            
            {/* Bucket balances remain live-only */}
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

        {activeTab === 'range' && <RangeReport allCategories={allCategories} />}
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

export default App;
