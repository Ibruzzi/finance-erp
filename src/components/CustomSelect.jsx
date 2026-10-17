import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

export function CustomSelect({ 
  value, 
  onChange, 
  options, 
  placeholder = '-- Select --',
  required = false,
  className = '',
  buttonClassName = '',
  searchable = true,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);
  useClickOutside(ref, () => setIsOpen(false));

  // Reset search when closed
  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && searchRef.current && options.length > 8) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen, options.length]);

  const showSearch = searchable && options.length > 8;
  const filtered = showSearch && search.trim()
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  const handleSelect = (opt) => {
    onChange(opt);
    setIsOpen(false);
  };

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-left flex justify-between items-center gap-2 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300'
        } ${buttonClassName}`}
      >
        <span className={`text-sm truncate ${isPlaceholder ? 'text-gray-400' : 'text-gray-700'}`}>
          {displayValue}
        </span>
        <ChevronDown 
          size={16} 
          className={`text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {showSearch && (
            <div className="relative border-b border-gray-100">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-2 text-sm outline-none"
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {!required && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                  !value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-400 italic'
                }`}
              >
                {placeholder}
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">No matches.</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 truncate ${
                    opt === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
