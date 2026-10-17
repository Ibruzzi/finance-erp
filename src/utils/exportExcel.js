import * as XLSX from 'xlsx';

export function exportMasterSheet(expenseData, incomeData) {
  const wb = XLSX.utils.book_new();

  const addSheetsForData = (data, prefix) => {
    const { years, rows, grandTotalByYear, grandTotal } = data;
    if (years.length === 0) return; // Skip if no data for this type

    // ---- Sheet 1: Master Matrix ----
    const header = ['Category', ...years, 'Avg', 'Total'];
    const body = rows.map(r => [
      r.category,
      ...years.map(y => r.byYear[y] || 0),
      Number(r.avg.toFixed(2)),
      Number(r.total.toFixed(2)),
    ]);

    const totalRow = [
      `All ${prefix}s`,
      ...years.map(y => grandTotalByYear[y] || 0),
      '',
      Number(grandTotal.toFixed(2)),
    ];

    const master = XLSX.utils.aoa_to_sheet([header, ...body, totalRow]);

    master['!cols'] = [
      { wch: 20 },
      ...years.map(() => ({ wch: 12 })),
      { wch: 12 },
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, master, `${prefix} Master`);

    // ---- Sheet 2: Averages & Totals ----
    const summaryHeader = ['Category', 'All Time Avg', 'All Time Total'];
    const summaryBody = rows.map(r => [
      r.category,
      Number(r.avg.toFixed(2)),
      Number(r.total.toFixed(2)),
    ]);
    const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryBody]);
    summarySheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, `${prefix} Averages`);

    // ---- Sheet 3: Year Totals ----
    const yearHeader = ['Year', 'Grand Total'];
    const yearBody = years.map(y => [y, Number((grandTotalByYear[y] || 0).toFixed(2))]);
    const yearSheet = XLSX.utils.aoa_to_sheet([yearHeader, ...yearBody]);
    yearSheet['!cols'] = [{ wch: 10 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, yearSheet, `${prefix} Year Totals`);
  };

  // Generate the sheets for both types
  addSheetsForData(expenseData, 'Expense');
  addSheetsForData(incomeData, 'Income');

  // Save the file
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `finance-master-${stamp}.xlsx`);
}
