import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, RefreshCcw, CheckCircle, X, ScanLine, Clock,
  TableProperties, Upload, FileSpreadsheet, Sparkles, Loader2,
  ArrowRight, AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface SheetConfig {
  id: string;
  name: string;
  spreadsheetId: string;
  range: string;
  lastSynced: string | null;
  rowCount?: number;
}

interface SheetManagerProps {
  sheets: SheetConfig[];
  activeSheetId: string | null;
  isConnected: boolean;
  isSyncing: boolean;
  onConnect: () => void;
  onAddSheet: (sheet: Omit<SheetConfig, 'id' | 'lastSynced'>) => void;
  onRemoveSheet: (id: string) => void;
  onSwitchSheet: (id: string) => void;
  onSyncSheet: (id: string) => void;
  onImportCSV?: (name: string, transactions: any[]) => void;
}

type TabMode = 'sheets' | 'csv';
type CsvState = 'idle' | 'reading' | 'analyzing' | 'done' | 'error';

interface AnalysisResult {
  transactions: any[];
  columnMapping: Record<string, string>;
  usedGemini: boolean;
  rowCount: number;
}

export function SheetManager({
  sheets, activeSheetId, isSyncing,
  onAddSheet, onRemoveSheet, onSwitchSheet, onSyncSheet, onImportCSV
}: SheetManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<TabMode>('sheets');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [newRange, setNewRange] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // CSV states
  const [csvState, setCsvState] = useState<CsvState>('idle');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvSheetName, setCsvSheetName] = useState('');
  const [csvError, setCsvError] = useState('');
  const [csvResult, setCsvResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const activeSheet = sheets.find(s => s.id === activeSheetId);

  const handleAdd = () => {
    if (!newName.trim() || !newId.trim()) return;
    let id = newId.trim();
    const urlMatch = id.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) id = urlMatch[1];
    onAddSheet({ name: newName.trim(), spreadsheetId: id, range: newRange.trim() || 'Sheet1!A1:K2000' });
    setNewName(''); setNewId(''); setNewRange('');
    setShowAddForm(false);
  };

  const handleSync = async (sheetId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSyncingId(sheetId);
    await onSyncSheet(sheetId);
    setSyncingId(null);
  };

  // ─── CSV Upload ──────────────────────────────────────────────────────────────

  const processCSVFile = useCallback(async (file: File, overrideName?: string) => {
    setCsvFile(file);
    setCsvError('');
    setCsvResult(null);
    const sheetLabel = overrideName || csvSheetName || file.name.replace(/\.csv$/i, '');
    if (!csvSheetName) setCsvSheetName(file.name.replace(/\.csv$/i, ''));

    setCsvState('reading');
    let csvText = '';
    try {
      csvText = await file.text();
    } catch {
      setCsvError('Failed to read file.');
      setCsvState('error');
      return;
    }

    setCsvState('analyzing');
    try {
      const geminiKey = localStorage.getItem('gemini_api_key') || '';

      const res = await fetch('/api/csv/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, apiKey: geminiKey, sheetName: sheetLabel })
      });
      const data = await res.json();
      if (data.error) {
        setCsvError(data.error);
        setCsvState('error');
        return;
      }
      setCsvResult(data);
      setCsvState('done');
    } catch {
      setCsvError('Analysis failed. Check your connection.');
      setCsvState('error');
    }
  }, [csvSheetName]);

  const handleFileSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setCsvError('Please select a .csv file'); setCsvState('error'); return; }
    processCSVFile(file, csvSheetName || file.name.replace(/\.csv$/i, ''));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDelete = (sheetId: string, sheetName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sheetId === 'primary') {
      alert('The primary Family Ledger sheet cannot be deleted.');
      return;
    }
    if (window.confirm(`Delete "${sheetName}"? This will remove the sheet from your workspace.`)) {
      onRemoveSheet(sheetId);
    }
  };

  const confirmImport = () => {
    if (!csvResult || !onImportCSV) return;
    const name = csvSheetName || csvFile?.name.replace(/\.csv$/i, '') || 'CSV Import';
    onImportCSV(name, csvResult.transactions);
    // Reset
    setCsvState('idle');
    setCsvFile(null);
    setCsvSheetName('');
    setCsvResult(null);
    setIsOpen(false);
  };

  const resetCSV = () => {
    setCsvState('idle');
    setCsvFile(null);
    setCsvSheetName('');
    setCsvError('');
    setCsvResult(null);
  };

  const FIELD_LABELS: Record<string, string> = {
    date: '📅 Date', person: '👤 Person', type: '🏷️ Type',
    mainCategory: '📁 Category', subCategory: '📂 SubCategory',
    description: '📝 Description', bank: '🏦 Bank', mode: '💳 Mode',
    dr: '📤 Debit', cr: '📥 Credit', nature: '🔖 Nature',
    amount_combined: '💰 Amount (±)'
  };

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border rounded-lg transition-all',
          isOpen ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-900'
        )}
      >
        <TableProperties className="w-3 h-3" />
        {activeSheet ? activeSheet.name : 'Master Ledger'}
        {isSyncing
          ? <RefreshCcw className="w-3 h-3 animate-spin text-blue-400" />
          : <span className={cn('w-1.5 h-1.5 rounded-full', activeSheet ? 'bg-emerald-500' : 'bg-zinc-300')} />
        }
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 w-[420px] bg-white border border-zinc-200 rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 text-white">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Data Sources</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-zinc-200 bg-zinc-50">
                <button
                  onClick={() => setTab('sheets')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all',
                    tab === 'sheets' ? 'bg-white text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                  )}
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  Google Sheets
                </button>
                <button
                  onClick={() => { setTab('csv'); resetCSV(); }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all',
                    tab === 'csv' ? 'bg-white text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                  )}
                >
                  <Upload className="w-3 h-3" />
                  Upload CSV
                  <span className="px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded text-[8px] font-black">AI</span>
                </button>
              </div>

              {/* ── GOOGLE SHEETS TAB ── */}
              {tab === 'sheets' && (
                <>
                  {/* Active sheet banner — only for Google Sheet sources */}
                  {activeSheet && activeSheet.spreadsheetId && (
                    <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Active: {activeSheet.name}</span>
                        </div>
                        {activeSheet.lastSynced && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-emerald-500" />
                            <span className="text-[9px] text-emerald-600">Last synced: {activeSheet.lastSynced}</span>
                            {activeSheet.rowCount && <span className="text-[9px] text-emerald-500 ml-1">· {activeSheet.rowCount} rows</span>}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleSync(activeSheet.id, e)}
                        disabled={isSyncing || syncingId === activeSheet.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg disabled:opacity-50 transition-colors"
                      >
                        <RefreshCcw className={cn('w-3 h-3', (isSyncing || syncingId === activeSheet.id) && 'animate-spin')} />
                        {(isSyncing || syncingId === activeSheet.id) ? 'Scanning…' : 'Scan Again'}
                      </button>
                    </div>
                  )}
                  {/* CSV import banner */}
                  {activeSheet && !activeSheet.spreadsheetId && (
                    <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-violet-500" />
                          <span className="text-[10px] font-black text-violet-800 uppercase tracking-wider">CSV: {activeSheet.name}</span>
                        </div>
                        <span className="text-[9px] text-violet-500">{activeSheet.rowCount} rows · imported {activeSheet.lastSynced}</span>
                      </div>
                      <span className="text-[9px] px-2 py-1 bg-violet-100 text-violet-600 rounded-lg font-bold">↑ Re-upload to refresh</span>
                    </div>
                  )}

                  {/* Sheet list */}
                  <div className="max-h-52 overflow-y-auto divide-y divide-zinc-50">
                    {sheets.length === 0 && (
                      <div className="p-8 text-center">
                        <ScanLine className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
                        <p className="text-zinc-400 text-xs italic">No sheets connected yet</p>
                        <p className="text-zinc-300 text-[10px] mt-1">Paste a Google Sheet link below</p>
                      </div>
                    )}
                    {sheets.map(sheet => (
                      <div
                        key={sheet.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 group cursor-pointer transition-colors',
                          activeSheetId === sheet.id ? 'bg-zinc-50' : 'hover:bg-zinc-50'
                        )}
                        onClick={() => onSwitchSheet(sheet.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {activeSheetId === sheet.id && <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />}
                            <span className="text-xs font-bold text-zinc-900 truncate">{sheet.name}</span>
                          </div>
                          <span className="text-[9px] text-zinc-400 font-mono block truncate mt-0.5">
                            {sheet.spreadsheetId ? `${sheet.spreadsheetId.slice(0, 28)}…` : 'CSV import'}
                          </span>
                          {sheet.lastSynced ? (
                            <span className="text-[9px] text-zinc-300">✓ {sheet.lastSynced}{sheet.rowCount ? ` · ${sheet.rowCount} rows` : ''}</span>
                          ) : (
                            <span className="text-[9px] text-amber-400">Not yet synced</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {sheet.id === 'primary' && (
                            <span className="text-[8px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-black border border-emerald-100">PRIMARY</span>
                          )}
                          {sheet.spreadsheetId && (
                            <button
                              onClick={(e) => handleSync(sheet.id, e)}
                              disabled={syncingId === sheet.id || isSyncing}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-wide disabled:opacity-40 transition-colors"
                              title="Re-scan this Google Sheet"
                            >
                              <RefreshCcw className={cn('w-2.5 h-2.5', syncingId === sheet.id && 'animate-spin')} />
                              {syncingId === sheet.id ? 'Scanning' : 'Scan'}
                            </button>
                          )}
                          {!sheet.spreadsheetId && sheet.id !== 'primary' && (
                            <span className="text-[8px] px-1.5 py-0.5 bg-violet-50 text-violet-500 rounded font-bold border border-violet-100">CSV</span>
                          )}
                          {sheet.id !== 'primary' && (
                            <button
                              onClick={e => handleDelete(sheet.id, sheet.name, e)}
                              className="p-1 rounded text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Delete sheet"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          {sheet.id === 'primary' && (
                            <span className="p-1 text-zinc-200" title="Primary sheet — cannot be deleted">
                              🔒
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add sheet form */}
                  <div className="p-4 border-t border-zinc-100 bg-zinc-50">
                    {showAddForm ? (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Add New Sheet</p>
                        <input
                          type="text"
                          placeholder="Name (e.g. Men's Sheet — April 2026)"
                          className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-900 bg-white"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          autoFocus
                        />
                        <input
                          type="text"
                          placeholder="Paste Google Sheet URL or ID"
                          className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-900 font-mono bg-white"
                          value={newId}
                          onChange={e => setNewId(e.target.value)}
                        />
                        <p className="text-[9px] text-zinc-400">💡 Works with any publicly shared sheet — just paste the link!</p>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleAdd}
                            disabled={!newName || !newId}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-zinc-900 text-white text-[10px] font-black rounded-lg disabled:opacity-40 hover:bg-zinc-700 transition-colors"
                          >
                            <ScanLine className="w-3 h-3" />
                            Scan & Add Sheet
                          </button>
                          <button
                            onClick={() => { setShowAddForm(false); setNewName(''); setNewId(''); }}
                            className="px-3 py-2 border border-zinc-200 text-[10px] font-black text-zinc-400 rounded-lg hover:bg-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-zinc-300 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 hover:bg-white transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        Connect New Sheet
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* ── CSV UPLOAD TAB ── */}
              {tab === 'csv' && (
                <div className="p-4">
                  <AnimatePresence mode="wait">

                    {/* IDLE — drop zone */}
                    {csvState === 'idle' && (
                      <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">
                          Upload & Auto-Analyze with Gemini AI
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={e => handleFileSelect(e.target.files)}
                        />
                        {/* Sheet name input */}
                        <input
                          type="text"
                          placeholder="Sheet name (e.g. Men's Sheet — May 2026)"
                          className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-900 bg-white mb-3"
                          value={csvSheetName}
                          onChange={e => setCsvSheetName(e.target.value)}
                        />
                        {/* Drop zone */}
                        <div
                          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                            isDragging
                              ? 'border-violet-400 bg-violet-50'
                              : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
                          )}
                        >
                          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3', isDragging ? 'bg-violet-100' : 'bg-zinc-100')}>
                            <Upload className={cn('w-5 h-5', isDragging ? 'text-violet-500' : 'text-zinc-400')} />
                          </div>
                          <p className="text-xs font-bold text-zinc-600">Drop your CSV here</p>
                          <p className="text-[10px] text-zinc-400 mt-1">or click to browse</p>
                          <div className="flex items-center justify-center gap-1.5 mt-3">
                            <Sparkles className="w-3 h-3 text-violet-400" />
                            <p className="text-[9px] text-violet-500 font-bold">Gemini AI auto-detects all columns</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-zinc-300 text-center mt-2">
                          Supports any bank export, custom formats, raw statements
                        </p>
                      </motion.div>
                    )}

                    {/* READING */}
                    {csvState === 'reading' && (
                      <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="py-10 text-center">
                        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin mx-auto mb-3" />
                        <p className="text-xs font-bold text-zinc-600">Reading file…</p>
                        <p className="text-[10px] text-zinc-400">{csvFile?.name}</p>
                      </motion.div>
                    )}

                    {/* ANALYZING */}
                    {csvState === 'analyzing' && (
                      <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="py-8 text-center">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                          <div className="absolute inset-0 rounded-full border-2 border-violet-100" />
                          <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-violet-500" />
                          </div>
                        </div>
                        <p className="text-xs font-black text-zinc-800">Gemini is analyzing…</p>
                        <p className="text-[10px] text-zinc-400 mt-1">Detecting column structure & mapping fields</p>
                        <div className="flex items-center justify-center gap-1 mt-3">
                          {['Date', 'Amount', 'Description', 'Bank'].map((label, i) => (
                            <motion.span
                              key={label}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: [0, 1, 0.4], scale: 1 }}
                              transition={{ delay: i * 0.3, duration: 1, repeat: Infinity }}
                              className="text-[8px] px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded font-bold"
                            >
                              {label}
                            </motion.span>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* DONE — success */}
                    {csvState === 'done' && csvResult && (
                      <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        {/* Success header */}
                        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-3">
                          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-black text-emerald-800">Analysis Complete!</p>
                            <p className="text-[10px] text-emerald-600">
                              {csvResult.rowCount} transactions detected
                              {csvResult.usedGemini && <span className="ml-1 font-bold">· Gemini ✨</span>}
                            </p>
                          </div>
                        </div>

                        {/* Column mapping */}
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Detected Column Mapping</p>
                        <div className="bg-zinc-50 rounded-lg p-2.5 space-y-1 max-h-36 overflow-y-auto mb-3">
                          {Object.entries(csvResult.columnMapping).map(([col, field]) => (
                            <div key={col} className="flex items-center gap-2 text-[10px]">
                              <span className="font-mono text-zinc-500 truncate flex-1">{col}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-zinc-300 shrink-0" />
                              <span className="font-bold text-zinc-700 shrink-0">
                                {FIELD_LABELS[field] || field}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Sheet name */}
                        <input
                          type="text"
                          placeholder="Sheet name"
                          className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-900 bg-white mb-3"
                          value={csvSheetName || csvFile?.name.replace(/\.csv$/i, '') || ''}
                          onChange={e => setCsvSheetName(e.target.value)}
                        />

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={confirmImport}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white text-[10px] font-black rounded-lg hover:bg-zinc-700 transition-colors"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Import {csvResult.rowCount} Rows
                          </button>
                          <button
                            onClick={resetCSV}
                            className="px-3 py-2 border border-zinc-200 text-[10px] font-black text-zinc-400 rounded-lg hover:bg-zinc-50 transition-colors"
                          >
                            Reset
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* ERROR */}
                    {csvState === 'error' && (
                      <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="py-6 text-center">
                        <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <AlertCircle className="w-6 h-6 text-rose-500" />
                        </div>
                        <p className="text-xs font-black text-zinc-700 mb-1">Analysis Failed</p>
                        <p className="text-[10px] text-rose-500 mb-4">{csvError}</p>
                        <button onClick={resetCSV}
                          className="px-5 py-2 bg-zinc-900 text-white text-[10px] font-black rounded-lg hover:bg-zinc-700 transition-colors">
                          Try Again
                        </button>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
