import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';

export function ZakatPaidModal({ onClose, onConfirm, suggestedAmount }) {
  const [amount, setAmount] = useState(suggestedAmount.toFixed(2));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CheckCircle size={20} className="text-green-600" /> Mark Zakat Paid
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Records a transaction under <strong>Personal → Zakat</strong>. It reduces the Financial bucket and marks this month's Zakat as paid.
        </p>

        <label className="text-xs font-semibold text-gray-500 mb-1 block">Amount Paid</label>
        <input 
          type="number" 
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4 text-lg font-bold"
        />

        <button 
          onClick={() => onConfirm(parseFloat(amount))}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition"
        >
          Confirm Payment
        </button>
      </div>
    </div>
  );
}
