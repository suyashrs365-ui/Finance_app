import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, RefreshCcw, CheckCircle, X, ScanLine, Clock, TableProperties } from 'lucide-react';
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
}

export function SheetManager({
  sheets, activeSheetId, isSyncing,
  onAddSheet, onRemoveSheet, onSwitchSheet, onSyncSheet
}: SheetManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [newRange, setNewRange] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const activeSheet = sheets.find(s => s.id === activeSheetId);

  const handleAdd = () => {
    if (!newName.trim() || !newId.trim()) return;
    // Extract spreadsheet ID from full URL if pasted
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

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border rounded-lg transition-all",
          isOpen ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-900"
        )}
      >
        <TableProperties className="w-3 h-3" />
        {activeSheet ? activeSheet.name : 'Master Ledger'}
        {isSyncing
          ? <RefreshCcw className="w-3 h-3 animate-spin text-blue-400" />
          : <span className={cn("w-1.5 h-1.5 rounded-full", activeSheet ? "bg-emerald-500" : "bg-zinc-300")} />
        }
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 w-96 bg-white border border-zinc-200 rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 text-white">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Google Sheet Sources</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Active sheet quick-scan banner */}
              {activeSheet && (
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
                        {activeSheet.rowCount && (
                          <span className="text-[9px] text-emerald-500 ml-1">· {activeSheet.rowCount} rows</span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleSync(activeSheet.id, e)}
                    disabled={isSyncing || syncingId === activeSheet.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <RefreshCcw className={cn("w-3 h-3", (isSyncing || syncingId === activeSheet.id) && "animate-spin")} />
                    {(isSyncing || syncingId === activeSheet.id) ? 'Scanning…' : 'Scan Again'}
                  </button>
                </div>
              )}

              {/* Sheet list */}
              <div className="max-h-56 overflow-y-auto divide-y divide-zinc-50">
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
                      "flex items-center gap-3 px-4 py-3 group cursor-pointer transition-colors",
                      activeSheetId === sheet.id ? "bg-zinc-50" : "hover:bg-zinc-50"
                    )}
                    onClick={() => onSwitchSheet(sheet.id)}
                  >
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {activeSheetId === sheet.id && <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />}
                        <span className="text-xs font-bold text-zinc-900 truncate">{sheet.name}</span>
                      </div>
                      <span className="text-[9px] text-zinc-400 font-mono block truncate mt-0.5">
                        {sheet.spreadsheetId.slice(0, 28)}…
                      </span>
                      {sheet.lastSynced ? (
                        <span className="text-[9px] text-zinc-300">
                          ✓ {sheet.lastSynced}{sheet.rowCount ? ` · ${sheet.rowCount} rows` : ''}
                        </span>
                      ) : (
                        <span className="text-[9px] text-amber-400">Not yet synced</span>
                      )}
                    </div>

                    {/* Right: actions — always visible */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleSync(sheet.id, e)}
                        disabled={syncingId === sheet.id || isSyncing}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-wide disabled:opacity-40 transition-colors"
                        title="Re-scan this sheet"
                      >
                        <RefreshCcw className={cn("w-2.5 h-2.5", syncingId === sheet.id && "animate-spin")} />
                        {syncingId === sheet.id ? 'Scanning' : 'Scan'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onRemoveSheet(sheet.id); }}
                        className="p-1 rounded text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                        title="Remove sheet"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
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
                      placeholder="Name (e.g. April 2026)"
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
