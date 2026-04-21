import { Transaction } from '../data';
import { StatsGrid } from '../components/StatsGrid';
import { formatCurrency } from '../lib/utils';
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, ArrowRight, Wallet, PiggyBank, CreditCard, Users } from 'lucide-react';

interface DashboardPageProps {
  transactions: Transaction[];
  selectedMonth: string | null;
  onNavigate: (page: string) => void;
}

export function DashboardPage({ transactions, selectedMonth, onNavigate }: DashboardPageProps) {
  const summary = useMemo(() => {
    const totalCr = transactions.reduce((s, t) => s + t.cr, 0);
    const totalDr = transactions.reduce((s, t) => t.type !== 'Transfer' ? s + t.dr : s, 0);
    const persons = [...new Set(transactions.map(t => t.person).filter(Boolean))];
    const accounts = [...new Set(transactions.map(t => t.bank).filter(Boolean))];
    const recentTx = [...transactions].sort((a, b) => {
      const months: Record<string,number> = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
      const pa = a.date.split('-'), pb = b.date.split('-');
      const va = parseInt('20'+pa[2])*10000 + (months[pa[1]]||0)*100 + parseInt(pa[0]);
      const vb = parseInt('20'+pb[2])*10000 + (months[pb[1]]||0)*100 + parseInt(pb[0]);
      return vb - va;
    }).slice(0, 5);

    return { netWorth: totalCr - totalDr, persons, accounts, recentTx, totalEntries: transactions.length };
  }, [transactions]);

  const quickCards = [
    { label: 'Ledger', desc: `${summary.totalEntries} entries`, icon: Wallet, page: 'ledger', color: 'bg-zinc-900 text-white' },
    { label: 'Accounts', desc: `${summary.accounts.length} accounts`, icon: CreditCard, page: 'accounts', color: 'bg-emerald-600 text-white' },
    { label: 'Investments', desc: 'Stocks · Gold · FD', icon: PiggyBank, page: 'investments', color: 'bg-blue-600 text-white' },
    { label: 'Analytics', desc: 'Charts & Reports', icon: TrendingUp, page: 'analytics', color: 'bg-purple-600 text-white' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight">Dashboard</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Welcome back · {selectedMonth ?? 'All Time'} · {summary.persons.join(', ')}
        </p>
      </div>

      {/* Stats row */}
      <StatsGrid transactions={transactions} selectedMonth={selectedMonth} />

      {/* Quick-nav cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {quickCards.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => onNavigate(card.page)}
              className={`${card.color} p-4 rounded-lg text-left group hover:opacity-90 transition-all active:scale-[0.98]`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-5 h-5 opacity-70" />
                <ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-sm font-bold">{card.label}</p>
              <p className="text-[10px] opacity-60">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Recent transactions */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Recent Transactions</span>
          <button onClick={() => onNavigate('ledger')} className="text-[10px] font-bold text-blue-600 hover:text-blue-800">
            View All →
          </button>
        </div>
        <div className="divide-y divide-zinc-50">
          {summary.recentTx.map(t => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  t.dr > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                }`}>
                  {t.dr > 0 ? '↓' : '↑'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-800 truncate">{t.description}</p>
                  <p className="text-[10px] text-zinc-400">{t.date} · {t.person} · {t.bank}</p>
                </div>
              </div>
              <span className={`text-sm font-bold font-mono shrink-0 ml-3 ${t.dr > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                {t.dr > 0 ? `-${formatCurrency(t.dr)}` : `+${formatCurrency(t.cr)}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
