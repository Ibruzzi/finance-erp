import { useState } from 'react';
import { X, Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { LoanForm } from './LoanForm';
import { formatMoney } from '../utils/format';

export function LoansModal({ onClose, loans, getLoanPaid, addLoan, updateLoan, deleteLoan }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);

  const handleDelete = async (loan) => {
    const paid = getLoanPaid(loan.uuid);
    const confirmMsg =
      paid > 0
        ? `This loan has RF ${formatMoney(paid)} in recorded payments. Deleting will unlink those transactions but keep them as expenses. Continue?`
        : `Delete loan "${loan.name}"?`;
    if (window.confirm(confirmMsg)) {
      await deleteLoan(loan.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard size={20} className="text-red-500" /> Loans
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {!isAdding && !editingLoan && (
          <>
            <button
              onClick={() => setIsAdding(true)}
              className="w-full mb-4 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Plus size={18} /> Add Loan
            </button>

            {loans.length === 0 ? (
              <div className="text-center p-8 text-gray-400 bg-gray-50 rounded-xl text-sm">
                No loans yet. Add your first loan above.
              </div>
            ) : (
              <div className="space-y-3">
                {loans.map(loan => {
                  const paid = getLoanPaid(loan.uuid);
                  const remaining = Math.max(0, loan.total_amount - paid);
                  const pct = loan.total_amount > 0 ? (paid / loan.total_amount) * 100 : 0;
                  return (
                    <div key={loan.id} className="bg-gray-50 p-4 rounded-xl">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-gray-800 truncate">{loan.name}</div>
                          {loan.start_date && (
                            <div className="text-xs text-gray-400">
                              Started {new Date(loan.start_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingLoan(loan)}
                            className="p-1.5 text-blue-500 hover:bg-blue-100 rounded"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(loan)}
                            className="p-1.5 text-red-500 hover:bg-red-100 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                        <div>
                          <div className="text-gray-400">Total</div>
                          <div className="font-semibold text-gray-700">
                            RF {formatMoney(loan.total_amount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Paid</div>
                          <div className="font-semibold text-green-600">RF {formatMoney(paid)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Remaining</div>
                          <div className="font-semibold text-red-600">
                            RF {formatMoney(remaining)}
                          </div>
                        </div>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-500 h-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 text-right">
                        {pct.toFixed(1)}% paid
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {(isAdding || editingLoan) && (
          <LoanForm
            initialData={editingLoan}
            onCancel={() => {
              setIsAdding(false);
              setEditingLoan(null);
            }}
            onSave={async (data) => {
              if (editingLoan) {
                await updateLoan(editingLoan.id, data);
              } else {
                await addLoan(data);
              }
              setIsAdding(false);
              setEditingLoan(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
