import { useState, useMemo } from 'react';
import { Search, Plus, Download, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Transaction } from '../data';
import { TransactionRow } from '../components/TransactionRow';
import { cn, formatCurrency } from '../lib/utils';

interface LedgerPageProps {
  transactions: Transaction[];
  onAddEntry: () => void;
  onExport: () => void;
}

type SortKey = 'date' | 'dr' | 'cr' | 'person' | 'type' | 'mainCategory';
type SortDir = 'asc' | 'desc';

function parseDateVal(d: string): number {
  const m: Record<string,number> = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const p = d.split('-'); if (p.length<3) return 0;
  return parseInt('20'+p[2])*10000+(m[p[1]]||0)*100+parseInt(p[0]);
}

export function LedgerPage({ transactions, onAddEntry, onExport }: LedgerPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activePerson, setActivePerson] = useState<string|null>(null);
  const [activeType, setActiveType] = useState<string|null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const persons = useMemo(() => [...new Set(transactions.map(t => t.person).filter(Boolean))], [transactions]);
  const types = useMemo(() => [...new Set(transactions.map(t => t.type).filter(Boolean))], [transactions]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let r = transactions.filter(t => {
      const q = searchTerm.toLowerCase();
      const match = !q || t.description.toLowerCase().includes(q) || t.subCategory.toLowerCase().includes(q) ||
        t.mainCategory.toLowerCase().includes(q) || t.bank.toLowerCase().includes(q) || (t.nature||'').toLowerCase().includes(q);
      return match && (!activePerson || t.person === activePerson) && (!activeType || t.type === activeType);
    });
    return [...r].sort((a, b) => {
      let va: any, vb: any;
      if (sortKey === 'date') { va = parseDateVal(a.date); vb = parseDateVal(b.date); }
      else if (sortKey === 'dr' || sortKey === 'cr') { va = a[sortKey]; vb = b[sortKey]; }
      else { va = String(a[sortKey]||'').toLowerCase(); vb = String(b[sortKey]||'').toLowerCase(); }
      return sortDir === 'asc' ? (va<vb?-1:va>vb?1:0) : (va>vb?-1:va<vb?1:0);
    });
  }, [searchTerm, activePerson, activeType, transactions, sortKey, sortDir]);

  const totalDr = filtered.reduce((a,t) => a+t.dr, 0);
  const totalCr = filtered.reduce((a,t) => a+t.cr, 0);

  const SortIcon = ({k}:{k:SortKey}) => sortKey!==k ? <Minus className="w-2.5 h-2.5 ml-0.5 opacity-20"/> : sortDir==='asc' ? <ChevronUp className="w-2.5 h-2.5 ml-0.5"/> : <ChevronDown className="w-2.5 h-2.5 ml-0.5"/>;

  const TH = ({k,label,right}:{k:SortKey;label:string;right?:boolean}) => (
    <th className={cn("p-3 text-[10px] uppercase tracking-wider text-zinc-400 font-bold cursor-pointer hover:text-zinc-900 whitespace-nowrap select-none", right && "text-right")}
      onClick={() => toggleSort(k)}>
      <span className={cn("flex items-center gap-0.5", right && "justify-end")}>{label}<SortIcon k={k}/></span>
    </th>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Ledger</h2>
          <p className="text-sm text-zinc-400 mt-0.5">{transactions.length} total entries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 text-[10px] font-bold hover:bg-zinc-100 rounded-lg text-zinc-500">
            <Download className="w-3 h-3" /> CSV
          </button>
          <button onClick={onAddEntry} className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-[10px] font-bold hover:bg-zinc-700 rounded-lg">
            <Plus className="w-3 h-3" /> Add Entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center bg-white border border-zinc-200 px-2.5 py-1.5 rounded-lg focus-within:ring-1 focus-within:ring-zinc-900">
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <input type="text" placeholder="Search…" className="bg-transparent border-none focus:outline-none text-xs ml-2 w-40"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="text-zinc-300 hover:text-zinc-700 text-xs">✕</button>}
        </div>
        <div className="flex gap-1 flex-wrap">
          {[null, ...persons].map(p => (
            <button key={p??'all'} onClick={() => setActivePerson(p)}
              className={cn("px-3 py-1 text-[9px] font-bold uppercase border rounded-full transition-all",
                activePerson===p ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
              )}>{p ?? 'All'}</button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {[null, ...types].map(t => (
            <button key={t??'all'} onClick={() => setActiveType(t)}
              className={cn("px-3 py-1 text-[9px] font-bold uppercase border rounded-full transition-all",
                activeType===t ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
              )}>{t ?? 'All'}</button>
          ))}
        </div>
        {(searchTerm || activePerson || activeType) && (
          <span className="text-[10px] text-zinc-400 ml-2">{filtered.length} of {transactions.length}</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-auto">
        <table className="w-full text-left border-collapse" style={{minWidth:960}}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <TH k="date" label="Date" />
              <TH k="person" label="Person" />
              <TH k="type" label="Type" />
              <TH k="mainCategory" label="Category" />
              <th className="p-3 text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Description</th>
              <th className="p-3 text-[10px] uppercase tracking-wider text-zinc-400 font-bold text-center">Bank</th>
              <TH k="dr" label="Debit" right />
              <TH k="cr" label="Credit" right />
              <th className="p-3 text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Nature</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {filtered.map(t => <TransactionRow key={t.id} transaction={t} />)}
            </AnimatePresence>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-12 text-center text-zinc-400 text-xs italic">No matching records</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-900 text-white font-mono text-xs">
              <td className="p-3 font-bold" colSpan={5}>{filtered.length} entries</td>
              <td className="p-3" />
              <td className="p-3 text-right text-rose-400 font-bold">{formatCurrency(totalDr)}</td>
              <td className="p-3 text-right text-emerald-400 font-bold">{formatCurrency(totalCr)}</td>
              <td className="p-3 text-right text-zinc-400 text-[9px]">NET {formatCurrency(totalCr-totalDr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
