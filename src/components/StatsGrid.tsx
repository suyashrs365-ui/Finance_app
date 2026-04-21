import { Transaction } from '../data';
import { formatCurrency, cn } from '../lib/utils';
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Wallet, PiggyBank } from 'lucide-react';

interface StatsGridProps {
  transactions: Transaction[];
  selectedMonth?: string | null; // 'Apr-26' format
}

export function StatsGrid({ transactions, selectedMonth }: StatsGridProps) {
  const stats = useMemo(() => {
    // ── Net Worth: ALL TIME (never month-filtered) ──────────────────────
    const totalCr = transactions.reduce((sum, t) => sum + t.cr, 0);
    const totalDr = transactions.reduce((sum, t) => {
      if (t.type === 'Transfer') return sum;
      return sum + t.dr;
    }, 0);
    const netWorth = totalCr - totalDr;

    // ── Monthly filter for budget tracking ────────────────────────────
    const monthTx = selectedMonth
      ? transactions.filter(t => {
          // date format: "20-Apr-26" → match "Apr-26"
          const parts = t.date.split('-');
          if (parts.length < 3) return false;
          return `${parts[1]}-${parts[2]}` === selectedMonth;
        })
      : transactions;

    // ── Income (month) ─────────────────────────────────────────────────
    const monthIncome = monthTx
      .filter(t => t.type === 'Income')
      .reduce((sum, t) => sum + t.cr, 0);

    // ── Survival spend: ONLY Fixed + Variable (NOT Investment) ─────────
    const fixedSpend = monthTx
      .filter(t => t.type === 'Fixed')
      .reduce((sum, t) => sum + t.dr, 0);
    const variableSpend = monthTx
      .filter(t => t.type === 'Variable')
      .reduce((sum, t) => sum + t.dr, 0);
    const survivalSpend = fixedSpend + variableSpend;

    // ── Investment this month ──────────────────────────────────────────
    const investmentSpend = monthTx
      .filter(t => t.type === 'Investment' && t.dr > 0)
      .reduce((sum, t) => sum + t.dr, 0);

    // ── Savings = Income - Fixed - Variable - Investment ───────────────
    const savings = monthIncome - survivalSpend - investmentSpend;

    const SURVIVAL_TARGET = 23000;
    const isOverBudget = survivalSpend > SURVIVAL_TARGET;
    const budgetUsageRaw = SURVIVAL_TARGET > 0 ? (survivalSpend / SURVIVAL_TARGET) * 100 : 0;
    const budgetUsage = Math.min(100, Math.max(0, budgetUsageRaw));

    // ── Savings rate ───────────────────────────────────────────────────
    const savingsRate = monthIncome > 0 ? ((savings / monthIncome) * 100) : 0;

    return {
      netWorth,
      monthIncome,
      fixedSpend,
      variableSpend,
      survivalSpend,
      investmentSpend,
      savings,
      savingsRate,
      SURVIVAL_TARGET,
      isOverBudget,
      budgetUsage,
    };
  }, [transactions, selectedMonth]);

  return (
    <div className="grid grid-cols-12 gap-4 mb-6">

      {/* ── Net Worth (dark hero card) ───────────── */}
      <div className="col-span-12 md:col-span-5 bg-zinc-900 text-white p-6 flex flex-col justify-between min-h-[160px]">
        <span className="text-[10px] uppercase tracking-widest opacity-50 font-black">
          Total Family Net Worth
        </span>
        <div>
          <div className={cn(
            "text-5xl font-light italic tracking-tighter mb-1",
            stats.netWorth >= 0 ? 'text-white' : 'text-rose-400'
          )}>
            {formatCurrency(stats.netWorth)}
          </div>
          <div className="h-0.5 w-full bg-emerald-500 mb-2" />
          <p className="text-[9px] opacity-40 uppercase tracking-tighter">
            Live Vault Evaluation · Liquid + Physical Assets Combined
          </p>
        </div>
      </div>

      {/* ── Survival Budget ──────────────────────── */}
      <div className="col-span-12 md:col-span-4 bg-white border border-zinc-200 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Survival Budget
              <span className="text-[8px] font-medium ml-1 text-zinc-300">{selectedMonth ?? 'All Time'}</span>
            </h3>
            {stats.isOverBudget
              ? <AlertTriangle className="w-4 h-4 text-rose-500" />
              : <CheckCircle className="w-4 h-4 text-emerald-500" />
            }
          </div>
          <span className={cn("text-4xl font-mono tracking-tighter font-bold", stats.isOverBudget ? "text-rose-600" : "text-zinc-900")}>
            {formatCurrency(stats.survivalSpend)}
          </span>
          <span className="text-[11px] font-mono text-zinc-400 block mt-0.5">
            TARGET: {formatCurrency(stats.SURVIVAL_TARGET)}/mo
          </span>
        </div>
        {/* Sub-breakdown */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-400 font-bold uppercase tracking-widest">Fixed</span>
            <span className="font-mono font-bold text-zinc-700">{formatCurrency(stats.fixedSpend)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-400 font-bold uppercase tracking-widest">Variable</span>
            <span className="font-mono font-bold text-zinc-700">{formatCurrency(stats.variableSpend)}</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden mt-2">
            <div
              className={cn("h-full transition-all duration-500", stats.isOverBudget ? "bg-rose-500" : "bg-zinc-800")}
              style={{ width: `${stats.budgetUsage}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
            <span className="text-zinc-400">Burn Rate</span>
            <span className={stats.isOverBudget ? "text-rose-500" : "text-emerald-600"}>
              {stats.budgetUsage.toFixed(1)}%
              {stats.isOverBudget && ' ⚠ OVER'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Income / Savings / Investment column ── */}
      <div className="col-span-12 md:col-span-3 grid grid-rows-3 gap-3">
        {/* Income */}
        <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block">Income</span>
            <span className="text-lg font-black font-mono tracking-tighter text-emerald-700">
              {formatCurrency(stats.monthIncome)}
            </span>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>
        {/* Investment */}
        <div className="bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 block">Invested</span>
            <span className="text-lg font-black font-mono tracking-tighter text-blue-700">
              {formatCurrency(stats.investmentSpend)}
            </span>
          </div>
          <PiggyBank className="w-5 h-5 text-blue-400" />
        </div>
        {/* Net Savings */}
        <div className={cn(
          "px-4 py-3 flex items-center justify-between border",
          stats.savings >= 0 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"
        )}>
          <div>
            <span className={cn("text-[9px] font-black uppercase tracking-widest block",
              stats.savings >= 0 ? "text-amber-600" : "text-rose-500"
            )}>
              Net Savings {stats.savingsRate !== 0 && `(${Math.abs(stats.savingsRate).toFixed(0)}%)`}
            </span>
            <span className={cn("text-lg font-black font-mono tracking-tighter",
              stats.savings >= 0 ? "text-amber-700" : "text-rose-600"
            )}>
              {formatCurrency(stats.savings)}
            </span>
          </div>
          {stats.savings >= 0
            ? <Wallet className="w-5 h-5 text-amber-400" />
            : <TrendingDown className="w-5 h-5 text-rose-400" />
          }
        </div>
      </div>
    </div>
  );
}
