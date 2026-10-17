import { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

const BUCKET_OPTIONS = ['Essential', 'Discretionary', 'Financial/Obligatory', 'Income'];

export function BucketDropdown({ currentValue, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setIsOpen(false));

  const colorClasses = (val) => {
    if (val === 'Essential') return 'bg-green-100 text-green-700';
    if (val === 'Discretionary') return 'bg-blue-100 text-blue-700';
    if (val === 'Income') return 'bg-yellow-100 text-yellow-700';
    return 'bg-purple-100 text-purple-700';
  };

  const textColor = (val) => {
    if (val === 'Essential') return 'text-green-700';
    if (val === 'Discretionary') return 'text-blue-700';
    if (val === 'Income') return 'text-yellow-700';
    return 'text-purple-700';
  };

  return (
    <div ref={ref} className="relative w-full">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`text-xs font-semibold p-2 rounded-lg border-0 w-full text-left flex justify-between items-center ${colorClasses(currentValue)}`}
      >
        {currentValue}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {BUCKET_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onSelect(opt); setIsOpen(false); }}
              className={`w-full text-left p-2 text-xs font-semibold hover:bg-gray-100 ${textColor(opt)} ${opt === currentValue ? 'bg-gray-50' : ''}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
