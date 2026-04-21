import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Calendar, User, Tag, FileText, CreditCard, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Transaction } from '../data';
import { cn } from '../lib/utils';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (t: Transaction) => void;
}

const TYPES = ['Fixed', 'Variable', 'Investment', 'Transfer', 'Income'];
const MAIN_CATS = ['Household', 'Food', 'Transport', 'Health', 'Entertainment', 'Investments', 'Education', 'Utility', 'Business', 'Shopping', 'Travel', 'Income', 'Balance', 'Debt', 'Loans', 'Transfer'];
const BANKS = ['Suyash HDFC', 'Suyash BoB', 'Suyash Groww', 'Suyash BOI', 'Rohini SBI', 'Rohini Union', 'Suyash SBI CC', 'Suyash HDFC CC', 'Family Vault', 'Savings'];
const MODES = ['PH', 'NEFT', 'RTGS', 'Bill', 'App', 'Bank', 'Online', 'GP', 'Cash', '-'];
const PERSONS = ['Suyash', 'Rohini', 'Mummy'];

export function AddTransactionModal({ isOpen, onClose, onAdd }: AddTransactionModalProps) {
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2,'0')}-${today.toLocaleString('en', {month:'short'})}-${String(today.getFullYear()).slice(-2)}`;

  const [form, setForm] = useState({
    date: dateStr,
    person: 'Suyash',
    type: 'Variable',
    mainCategory: 'Food',
    subCategory: '',
    description: '',
    bank: 'Suyash BoB',
    mode: 'PH',
    dr: '',
    cr: '',
    nature: '',
    isCredit: false,
  });

  const set = (key: string, val: string | boolean) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    if (!form.description || (!form.dr && !form.cr)) return;
    const t: Transaction = {
      id: `manual-${Date.now()}`,
      date: form.date,
      person: form.person,
      type: form.type,
      mainCategory: form.mainCategory,
      subCategory: form.subCategory,
      description: form.description,
      bank: form.bank,
      mode: form.mode,
      dr: parseFloat(form.dr || '0'),
      cr: parseFloat(form.cr || '0'),
      nature: form.nature,
    };
    onAdd(t);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-white w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-900 text-white">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest">Append Entry</h2>
                  <p className="text-[10px] text-zinc-400 font-mono mt-0.5">Manual ledger entry</p>
                </div>
                <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6 space-y-4">
                {/* Credit / Debit toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => set('isCredit', false)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-widest border-2 transition-all",
                      !form.isCredit ? "bg-rose-600 text-white border-rose-600" : "bg-white text-zinc-400 border-zinc-200"
                    )}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" /> Debit (Out)
                  </button>
                  <button
                    onClick={() => set('isCredit', true)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-widest border-2 transition-all",
                      form.isCredit ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-zinc-400 border-zinc-200"
                    )}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" /> Credit (In)
                  </button>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full text-2xl font-bold border-b-2 border-zinc-900 focus:outline-none py-1 text-zinc-900 font-mono"
                    value={form.isCredit ? form.cr : form.dr}
                    onChange={e => set(form.isCredit ? 'cr' : 'dr', e.target.value)}
                  />
                </div>

                {/* Row 1: Date, Person */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Date</label>
                    <input
                      type="text"
                      className="w-full border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900 font-mono"
                      value={form.date}
                      onChange={e => set('date', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Person</label>
                    <select
                      className="w-full border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900 bg-white"
                      value={form.person}
                      onChange={e => set('person', e.target.value)}
                    >
                      {PERSONS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: Type, Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Type</label>
                    <select
                      className="w-full border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900 bg-white"
                      value={form.type}
                      onChange={e => set('type', e.target.value)}
                    >
                      {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Main Category</label>
                    <select
                      className="w-full border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900 bg-white"
                      value={form.mainCategory}
                      onChange={e => set('mainCategory', e.target.value)}
                    >
                      {MAIN_CATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Sub-category + Description */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Sub-Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Groceries"
                      className="w-full border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900"
                      value={form.subCategory}
                      onChange={e => set('subCategory', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Description *</label>
                    <input
                      type="text"
                      placeholder="What was this for?"
                      className="w-full border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900"
                      value={form.description}
                      onChange={e => set('description', e.target.value)}
                    />
                  </div>
                </div>

                {/* Bank + Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Bank</label>
                    <select
                      className="w-full border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900 bg-white"
                      value={form.bank}
                      onChange={e => set('bank', e.target.value)}
                    >
                      {BANKS.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Mode</label>
                    <select
                      className="w-full border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900 bg-white"
                      value={form.mode}
                      onChange={e => set('mode', e.target.value)}
                    >
                      {MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                {/* Nature */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Nature of Transaction</label>
                  <input
                    type="text"
                    placeholder="e.g. Daily food expense, Long-term investment..."
                    className="w-full border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900"
                    value={form.nature}
                    onChange={e => set('nature', e.target.value)}
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!form.description || (!form.dr && !form.cr)}
                  className="w-full py-3 bg-zinc-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-zinc-700 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4 inline-block mr-2" />
                  Add to Ledger
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
