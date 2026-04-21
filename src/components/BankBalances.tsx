import { useMemo } from 'react';
import { Transaction } from '../data';
import { formatCurrency, cn } from '../lib/utils';
import { TrendingUp, TrendingDown, Minus, Vault, CreditCard, LineChart, Landmark } from 'lucide-react';

interface BankBalancesProps {
  transactions: Transaction[];
}

// Classify account type from bank name
function getAccountMeta(bank: string): {
  type: 'savings' | 'cc' | 'investment' | 'vault' | 'fd';
  icon: typeof Landmark;
  colorClass: string;
  bgClass: string;
} {
  const b = bank.toLowerCase();
  if (b.includes('cc') || b.includes('credit')) return { type: 'cc', icon: CreditCard, colorClass: 'text-rose-600', bgClass: 'bg-rose-50 border-rose-200' };
  if (b.includes('groww')) return { type: 'investment', icon: LineChart, colorClass: 'text-blue-600', bgClass: 'bg-blue-50 border-blue-200' };
  if (b.includes('vault')) return { type: 'vault', icon: Vault, colorClass: 'text-amber-600', bgClass: 'bg-amber-50 border-amber-200' };
  if (b.includes('fd') || b.includes('boi')) return { type: 'fd', icon: Landmark, colorClass: 'text-purple-600', bgClass: 'bg-purple-50 border-purple-200' };
  return { type: 'savings', icon: Landmark, colorClass: 'text-zinc-700', bgClass: 'bg-white border-zinc-200' };
}

const ACCOUNT_LABELS: Record<string, string> = {
  'cc': 'Credit Card',
  'savings': 'Savings A/C',
  'investment': 'Investment',
  'fd': 'Fixed Deposit',
  'vault': 'Physical Asset',
};

// Map bank name → person (best-effort from naming convention)
function getBankPerson(bank: string): string {
  const b = bank.toLowerCase();
  if (b.includes('rohini')) return 'Rohini';
  if (b.includes('mummy') || b.includes('family vault')) return 'Mummy';
  if (b.includes('savings') || b === '-') return 'Suyash';
  if (b.includes('suyash') || b.includes('groww') || b.includes('boi')) return 'Suyash';
  return 'Suyash';
}

const PERSON_COLORS: Record<string, string> = {
  Suyash: 'bg-zinc-900 text-white',
  Rohini: 'bg-pink-600 text-white',
  Mummy: 'bg-amber-600 text-white',
};

export function BankBalances({ transactions }: BankBalancesProps) {
  const bankSummary = useMemo(() => {
    const map: Record<string, { cr: number; dr: number; person: string }> = {};

    transactions.forEach(t => {
      // Credit side — money entering the bank
      if (t.cr > 0 && t.bank) {
        if (!map[t.bank]) map[t.bank] = { cr: 0, dr: 0, person: getBankPerson(t.bank) };
        map[t.bank].cr += t.cr;
      }
      // Debit side — money leaving the bank
      if (t.dr > 0 && t.bank) {
        if (!map[t.bank]) map[t.bank] = { cr: 0, dr: 0, person: getBankPerson(t.bank) };
        map[t.bank].dr += t.dr;
      }
    });

    // Build per-bank balance list
    return Object.entries(map)
      .filter(([bank]) => bank && bank !== '-')
      .map(([bank, { cr, dr, person }]) => ({
        bank,
        cr,
        dr,
        balance: cr - dr,
        person,
        meta: getAccountMeta(bank),
      }))
      .sort((a, b) => {
        // Sort: Suyash first, then Rohini, then Mummy
        const order = ['Suyash', 'Rohini', 'Mummy'];
        const pa = order.indexOf(a.person);
        const pb = order.indexOf(b.person);
        if (pa !== pb) return pa - pb;
        // Within person, sort by balance desc (excluding vault/FD)
        return b.balance - a.balance;
      });
  }, [transactions]);

  // Group by person
  const grouped = useMemo(() => {
    const g: Record<string, typeof bankSummary> = {};
    bankSummary.forEach(item => {
      if (!g[item.person]) g[item.person] = [];
      g[item.person].push(item);
    });
    return g;
  }, [bankSummary]);

  const totalNetWorth = useMemo(() =>
    bankSummary.reduce((sum, b) => {
      // Exclude CC accounts (they are liabilities if negative)
      if (b.meta.type === 'cc') return sum;
      return sum + b.balance;
    }, 0), [bankSummary]);

  const persons = ['Suyash', 'Rohini', 'Mummy'].filter(p => grouped[p]);

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Account Vault</h2>
          <p className="text-sm font-bold text-zinc-700 mt-0.5">All Family Bank Accounts & Balances</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold block">Combined Liquid + Assets</span>
          <span className={cn("text-2xl font-black font-mono tracking-tighter", totalNetWorth >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {formatCurrency(totalNetWorth)}
          </span>
        </div>
      </div>

      {/* Person groups */}
      <div className="space-y-5">
        {persons.map(person => {
          const accounts = grouped[person] || [];
          const personTotal = accounts
            .filter(a => a.meta.type !== 'cc')
            .reduce((sum, a) => sum + a.balance, 0);

          return (
            <div key={person}>
              {/* Person header */}
              <div className="flex items-center gap-3 mb-2">
                <span className={cn("px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest", PERSON_COLORS[person])}>
                  {person}
                </span>
                <div className="flex-1 h-px bg-zinc-200" />
                <span className={cn("text-sm font-black font-mono tracking-tighter", personTotal >= 0 ? 'text-zinc-700' : 'text-rose-600')}>
                  {formatCurrency(personTotal)}
                </span>
              </div>

              {/* Account cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {accounts.map(({ bank, cr, dr, balance, meta }) => {
                  const Icon = meta.icon;
                  const isPositive = balance > 0;
                  const isCC = meta.type === 'cc';

                  return (
                    <div
                      key={bank}
                      className={cn(
                        "border rounded-none p-3 flex flex-col gap-2 transition-shadow hover:shadow-md",
                        meta.bgClass
                      )}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 block mb-0.5">
                            {ACCOUNT_LABELS[meta.type]}
                          </span>
                          <span className="text-[11px] font-black text-zinc-900 leading-tight break-words">
                            {bank.replace('Suyash ', '').replace('Rohini ', '').replace('Mummy ', '')}
                          </span>
                        </div>
                        <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", meta.colorClass)} />
                      </div>

                      {/* Balance */}
                      <div>
                        <span className={cn(
                          "text-base font-black font-mono tracking-tighter block",
                          isCC
                            ? (balance < 0 ? 'text-rose-600' : 'text-emerald-600')
                            : (isPositive ? 'text-zinc-900' : 'text-rose-600')
                        )}>
                          {formatCurrency(Math.abs(balance))}
                          {isCC && balance < 0 && <span className="text-[8px] ml-1 text-rose-400 font-bold">DUE</span>}
                        </span>
                      </div>

                      {/* In/Out micro-stats */}
                      <div className="flex gap-2 pt-1 border-t border-black/5">
                        <div className="flex items-center gap-0.5">
                          <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                          <span className="text-[8px] font-mono text-zinc-400">
                            {cr > 0 ? `₹${(cr/1000).toFixed(0)}k` : '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <TrendingDown className="w-2.5 h-2.5 text-rose-400" />
                          <span className="text-[8px] font-mono text-zinc-400">
                            {dr > 0 ? `₹${(dr/1000).toFixed(0)}k` : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
