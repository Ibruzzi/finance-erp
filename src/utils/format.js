// src/utils/format.js

export function formatMoney(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
