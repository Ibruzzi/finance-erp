import { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { db } from '../db/database';
import { CustomSelect } from './CustomSelect';

export function ImportModal({ onClose, onImportComplete }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  // Preview step: the cleaned-up rows, plus how many look like ones you already have.
  const [preview, setPreview] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const DB_FIELDS = [
    { key: 'date', label: 'Date', required: true },
    { key: 'category', label: 'Category', required: true },
    { key: 'subcategory', label: 'Subcategory', required: false },
    { key: 'amount_original', label: 'Amount', required: true },
    { key: 'currency', label: 'Currency', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ];

  const columnOptions = ['-- Skip --', ...headers.map((h, i) => h || `Column ${i + 1}`)];

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const reader = new FileReader();

    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      setSheets(workbook.SheetNames);
      setSelectedSheet(workbook.SheetNames[0]);

      if (workbook.SheetNames.length === 1) {
        loadSheet(workbook, workbook.SheetNames[0]);
      } else {
        setStep(1.5);
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  const loadSheet = (workbook, sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (jsonData.length === 0) {
      alert('That sheet is empty.');
      return;
    }

    const headerRow = jsonData[0].map(h => String(h).trim());
    const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== ''));

    setHeaders(headerRow);
    setRows(dataRows);

    const autoMap = {};
    DB_FIELDS.forEach(field => {
      const targetKey = field.key.toLowerCase();
      const targetLabel = field.label.toLowerCase();

      let idx = headerRow.findIndex(h => h.toLowerCase() === targetKey);
      if (idx === -1) idx = headerRow.findIndex(h => h.toLowerCase() === targetLabel);
      if (idx === -1) {
        idx = headerRow.findIndex(h => {
          const lower = h.toLowerCase();
          return lower.includes(targetKey) || lower.includes(targetLabel);
        });
      }

      if (idx !== -1) autoMap[field.key] = idx;
    });
    setMapping(autoMap);
    setStep(2);
  };

  const handleSheetSelect = (sheetName) => {
    setSelectedSheet(sheetName);
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      loadSheet(workbook, sheetName);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMapChange = (dbField, selectedLabel) => {
    if (!selectedLabel || selectedLabel === '-- Skip --') {
      setMapping({ ...mapping, [dbField]: undefined });
      return;
    }
    const idx = columnOptions.indexOf(selectedLabel) - 1;
    setMapping({ ...mapping, [dbField]: idx });
  };

  // Reads every spreadsheet row and turns it into a clean transaction.
  // Rows with missing/invalid data are counted as "invalid" and skipped.
  const buildBatch = () => {
    let invalid = 0;
    const batch = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const dateVal = mapping.date !== undefined ? row[mapping.date] : null;
      const catVal = mapping.category !== undefined ? row[mapping.category] : null;
      const subVal = mapping.subcategory !== undefined ? row[mapping.subcategory] : '';
      const amtVal = mapping.amount_original !== undefined ? row[mapping.amount_original] : null;
      const currVal = mapping.currency !== undefined ? row[mapping.currency] : 'MVR';
      const notesVal = mapping.notes !== undefined ? row[mapping.notes] : '';

      if (!dateVal || !catVal || amtVal === null || amtVal === '') {
        invalid++;
        continue;
      }

      let finalDate;
      if (typeof dateVal === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const msPerDay = 24 * 60 * 60 * 1000;
        finalDate = new Date(excelEpoch.getTime() + dateVal * msPerDay).toISOString();
      } else if (typeof dateVal === 'string') {
        const ddmmyyyy = dateVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (ddmmyyyy) {
          const [, d, m, yRaw] = ddmmyyyy;
          const y = yRaw.length === 2 ? '20' + yRaw : yRaw;
          const dt = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
          finalDate = dt.toISOString();
        } else {
          const parsed = new Date(dateVal);
          finalDate = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
        }
      } else {
        finalDate = new Date().toISOString();
      }

      const numericAmount = parseFloat(String(amtVal).replace(/[^0-9.-]+/g, ''));
      if (isNaN(numericAmount)) {
        invalid++;
        continue;
      }

      const type = String(catVal).toLowerCase().includes('income') ? 'Income' : 'Expense';
      const currency = String(currVal).toUpperCase() === 'USD' ? 'USD' : 'MVR';
      // For historical rows, we set exchange_rate to 15.42 but the rate is stored.
      // The app's logic will use the stored amount_mvr.
      const rate = currency === 'USD' ? 15.42 : 1;
      const amount_mvr = currency === 'USD' ? numericAmount * rate : numericAmount;

      batch.push({
        date: finalDate,
        category: String(catVal).trim(),
        subcategory: String(subVal).trim(),
        amount_original: numericAmount,
        currency: currency,
        amount_mvr: amount_mvr,
        exchange_rate_at_time: rate,
        type: type,
        is_historical: true,
        notes: String(notesVal).trim(),
        bucket: 'Discretionary' // Fallback bucket for imported data
      });
    }

    return { batch, invalid };
  };

  // Two entries are "the same" if day, category, subcategory, amount and notes all match.
  const duplicateKey = (t) =>
    [
      String(t.date).slice(0, 10),
      t.category,
      t.subcategory || '',
      Number(t.amount_original).toFixed(2),
      (t.notes || '').trim(),
    ].join('|');

  // Step 2 -> Step 3: build the rows and compare them with what is already saved.
  const handlePreview = async () => {
    setIsImporting(true);
    try {
      const { batch, invalid } = buildBatch();

      // Count what is already on this device, so repeated legitimate rows
      // (e.g. two identical purchases on one day) are matched one-for-one.
      const existing = await db.transactions.toArray();
      const existingCounts = new Map();
      existing.forEach(t => {
        if (t.deleted === true) return;
        const k = duplicateKey(t);
        existingCounts.set(k, (existingCounts.get(k) || 0) + 1);
      });

      const flagged = batch.map(t => {
        const k = duplicateKey(t);
        const left = existingCounts.get(k) || 0;
        if (left > 0) {
          existingCounts.set(k, left - 1);
          return { ...t, _isDuplicate: true };
        }
        return { ...t, _isDuplicate: false };
      });

      const dates = batch.map(t => t.date).sort();
      setPreview({
        rows: flagged,
        invalid,
        duplicates: flagged.filter(t => t._isDuplicate).length,
        firstDate: dates[0] ? dates[0].slice(0, 10) : null,
        lastDate: dates.length ? dates[dates.length - 1].slice(0, 10) : null,
      });
      setStep(3);
    } catch (err) {
      console.error('[Import] preview failed:', err);
      alert('Could not read the file: ' + (err.message || err));
    } finally {
      setIsImporting(false);
    }
  };

  // Step 3 -> Step 4: write to the database.
  const handleImport = async () => {
    if (!preview) return;
    setIsImporting(true);
    let successCount = 0;

    try {
      const nowISO = new Date().toISOString();
      const toWrite = preview.rows
        .filter(t => !(skipDuplicates && t._isDuplicate))
        .map(({ _isDuplicate, ...t }) => ({
          ...t,
          // These make the rows sync to the cloud like everything else.
          uuid: uuidv4(),
          syncStatus: 'pending',
          updated_at: nowISO,
          deleted: false,
        }));

      const BATCH_SIZE = 1000;
      for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
        const chunk = toWrite.slice(i, i + BATCH_SIZE);
        await db.transactions.bulkAdd(chunk);
        successCount += chunk.length;
      }

      setImportResult({
        success: successCount,
        errors: preview.invalid,
        skippedDuplicates: skipDuplicates ? preview.duplicates : 0,
      });
      setStep(4);
    } catch (err) {
      console.error('[Import] FATAL:', err);
      setImportResult({ success: successCount, errors: preview.invalid + 1, fatalError: err.message || String(err) });
      setStep(4);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (importResult) {
      if (onImportComplete) onImportComplete();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-3xl rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col">

        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-lg font-bold">Import Historical Data</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={24} />
          </button>
        </div>

        {step === 1 && (
          <div className="text-center space-y-4 py-4">
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 bg-blue-50">
              <Upload size={48} className="mx-auto text-blue-500 mb-3" />
              <p className="text-sm text-gray-600 mb-4">Select your .xlsx or .csv file</p>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" id="excel-upload" />
              <label htmlFor="excel-upload" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-bold cursor-pointer hover:bg-blue-700">
                Browse File
              </label>
            </div>
            <p className="text-xs text-gray-400">
              Imported data is marked as <strong>historical</strong> and will not affect current Zakat or Bucket calculations. It will be uploaded to your cloud backup on the next sync.
            </p>
          </div>
        )}

        {step === 1.5 && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">This file has multiple sheets. Pick one:</p>
            <div className="grid grid-cols-2 gap-2">
              {sheets.map(sheet => (
                <button key={sheet} onClick={() => handleSheetSelect(sheet)} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-sm font-semibold">
                  {sheet}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && rows.length > 0 && (
          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 flex-shrink-0">
              Sheet: <strong>{selectedSheet}</strong> • {rows.length} rows found
            </div>

            <p className="text-sm text-gray-600">Map your columns to our database fields:</p>

            <div className="space-y-3">
              {DB_FIELDS.map(field => {
                const currentIndex = mapping[field.key];
                const currentLabel = currentIndex !== undefined
                  ? (headers[currentIndex] || `Column ${currentIndex + 1}`)
                  : '-- Skip --';

                return (
                  <div key={field.key} className="flex flex-col gap-2 bg-gray-50 p-3 rounded-lg">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-gray-700">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </div>
                    </div>
                    <CustomSelect
                      value={currentLabel}
                      onChange={(label) => handleMapChange(field.key, label)}
                      options={columnOptions}
                      searchable={columnOptions.length > 8}
                      required={false}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => { setStep(1); setRows([]); setHeaders([]); setFile(null); }} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold">
                Back
              </button>
              <button
                onClick={handlePreview}
                disabled={isImporting || mapping.date === undefined || mapping.category === undefined || mapping.amount_original === undefined}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold disabled:opacity-50"
              >
                {isImporting ? 'Checking...' : 'Review Import'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && preview && (
          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-700">
              <div className="flex justify-between"><span>Rows ready to import</span><strong>{preview.rows.length}</strong></div>
              <div className="flex justify-between"><span>Look like duplicates of entries you already have</span><strong className={preview.duplicates > 0 ? 'text-orange-600' : ''}>{preview.duplicates}</strong></div>
              <div className="flex justify-between"><span>Skipped (missing or invalid data)</span><strong className={preview.invalid > 0 ? 'text-red-500' : ''}>{preview.invalid}</strong></div>
              {preview.firstDate && (
                <div className="flex justify-between"><span>Date range</span><strong>{preview.firstDate} → {preview.lastDate}</strong></div>
              )}
            </div>

            {preview.duplicates > 0 && (
              <label className="flex items-start gap-2 text-sm text-gray-700 bg-orange-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="accent-blue-600 mt-0.5"
                />
                <span>
                  Skip the {preview.duplicates} likely duplicates
                  <span className="block text-xs text-gray-500">Matched on date, category, subcategory, amount and notes.</span>
                </span>
              </label>
            )}

            <div className="flex gap-2 pt-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => { setPreview(null); setStep(2); }} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || (skipDuplicates ? preview.rows.length - preview.duplicates : preview.rows.length) === 0}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold disabled:opacity-50"
              >
                {isImporting
                  ? 'Importing...'
                  : `Import ${skipDuplicates ? preview.rows.length - preview.duplicates : preview.rows.length} Rows`}
              </button>
            </div>
          </div>
        )}

        {step === 4 && importResult && (
          <div className="text-center space-y-4 py-8">
            {importResult.fatalError ? (
              <>
                <AlertCircle size={48} className="mx-auto text-red-500" />
                <p className="text-lg font-bold text-red-600">Import Failed</p>
                <p className="text-sm text-gray-600">{importResult.fatalError}</p>
              </>
            ) : (
              <>
                <CheckCircle size={48} className="mx-auto text-green-500" />
                <p className="text-lg font-bold text-green-600">Import Complete</p>
                <div className="text-sm text-gray-600">
                  <p><strong>{importResult.success}</strong> rows imported successfully.</p>
                  {importResult.skippedDuplicates > 0 && (
                    <p className="text-orange-600 mt-1"><strong>{importResult.skippedDuplicates}</strong> likely duplicates skipped.</p>
                  )}
                  {importResult.errors > 0 && (
                    <p className="text-red-500 mt-1"><strong>{importResult.errors}</strong> rows skipped due to invalid data.</p>
                  )}
                </div>
              </>
            )}
            <button onClick={handleClose} className="mt-4 bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700">
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
