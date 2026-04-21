import { useMemo } from 'react';
import { Transaction } from '../data';
import { formatCurrency, cn } from '../lib/utils';
import { TrendingUp, TrendingDown, Minus, Gem, Landmark, LineChart as LineChartIcon } from 'lucide-react';

interface InvestmentPortfolioProps {
  transactions: Transaction[];
}

// Known stock positions from ledger (grouped by ticker)
function parseStockName(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('irctc')) return 'IRCTC';
  if (d.includes('rvnl') || d.includes('rail vikas')) return 'RVNL';
  if (d.includes('suzlon')) return 'Suzlon';
  if (d.includes('silver etf') || d.includes('icici pru silver')) return 'Silver ETF';
  if (d.includes('tatsilv')) return 'TATSILV';
  if (d.includes('meesho')) return 'Meesho';
  if (d.includes('bob') || d.includes('bank of baroda')) return 'Bank of Baroda';
  if (d.includes('bol') || d.includes('boi')) return 'BOI FD';
  return desc.slice(0, 20);
}

// Simple mock current price ratio (in production, use real API)
// Showing as "cost basis" only since we don't have live prices
const STOCK_COLORS = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];

export function InvestmentPortfolio({ transactions }: InvestmentPortfolioProps) {
  const { stocks, gold, fd, totalInvested, goldValue } = useMemo(() => {
    // Group stock investments by ticker
    const stockMap: Record<string, { invested: number; items: string[] }> = {};
    let goldInvested = 0;
    let fdValue = 0;
    let goldCrValue = 0;

    transactions.filter(t => t.type === 'Investment' || t.mainCategory === 'Investments').forEach(t => {
      if (t.subCategory === 'Stocks' && t.dr > 0) {
        const name = parseStockName(t.description);
        if (!stockMap[name]) stockMap[name] = { invested: 0, items: [] };
        stockMap[name].invested += t.dr;
        stockMap[name].items.push(t.description);
      } else if (t.subCategory === 'Gold') {
        if (t.dr > 0) goldInvested += t.dr;
        if (t.cr > 0) goldCrValue += t.cr; // Legacy vault entries
      } else if (t.subCategory === 'Opening' && t.mainCategory === 'Balance' && t.cr > 0) {
        fdValue += t.cr;
      }
    });

    // FD from BOI
    transactions.filter(t => t.bank?.includes('BOI') && t.cr > 0).forEach(t => {
      fdValue = Math.max(fdValue, t.cr);
    });
    // Gold vault from "Family Vault" transactions
    const vaultCr = transactions.filter(t => t.bank === 'Family Vault').reduce((s, t) => s + t.cr, 0);

    const stocks = Object.entries(stockMap)
      .map(([name, { invested, items }]) => ({ name, invested, items }))
      .sort((a, b) => b.invested - a.invested);

    const totalStockInvested = stocks.reduce((s, st) => s + st.invested, 0);
    const totalInvested = totalStockInvested + goldInvested + fdValue;

    return { stocks, gold: goldInvested, fd: fdValue, totalInvested, goldValue: vaultCr };
  }, [transactions]);

  const stockTotal = stocks.reduce((s, st) => s + st.invested, 0);

  const assetMix = [
    { label: 'Stocks', value: stockTotal, color: '#3b82f6', icon: LineChartIcon },
    { label: 'Gold (Bought)', value: gold, color: '#f59e0b', icon: Gem },
    { label: 'Gold (Vault)', value: goldValue, color: '#d97706', icon: Gem },
    { label: 'Fixed Deposit', value: fd, color: '#8b5cf6', icon: Landmark },
  ].filter(a => a.value > 0);
  const mixTotal = assetMix.reduce((s, a) => s + a.value, 0);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Investment Portfolio</h2>
          <p className="text-sm font-bold text-zinc-700 mt-0.5">Stocks · Gold · Fixed Deposits</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold block">Total Deployed</span>
          <span className="text-2xl font-black font-mono tracking-tighter text-blue-600">
            {formatCurrency(totalInvested + goldValue)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Asset Mix summary ────────────────── */}
        <div className="bg-white border border-zinc-200 p-5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">Asset Mix</h3>
          <div className="space-y-3">
            {assetMix.map((asset) => {
              const pct = mixTotal > 0 ? (asset.value / mixTotal) * 100 : 0;
              const Icon = asset.icon;
              return (
                <div key={asset.label}>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3" style={{ color: asset.color }} />
                      <span className="uppercase tracking-widest text-zinc-600">{asset.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 text-[9px]">{pct.toFixed(0)}%</span>
                      <span className="font-mono text-zinc-900">{formatCurrency(asset.value)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: asset.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Stock positions ───────────────────── */}
        <div className="bg-white border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stock Positions</h3>
            <span className="text-[10px] font-mono text-blue-600 font-bold">{formatCurrency(stockTotal)}</span>
          </div>
          <div className="space-y-3">
            {stocks.length === 0 && <p className="text-zinc-400 text-xs italic">No stock records</p>}
            {stocks.map((st, i) => {
              const pct = stockTotal > 0 ? (st.invested / stockTotal) * 100 : 0;
              return (
                <div key={st.name}>
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span className="uppercase tracking-widest text-zinc-700">{st.name}</span>
                    <span className="font-mono text-zinc-900">{formatCurrency(st.invested)}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: STOCK_COLORS[i % STOCK_COLORS.length] }}
                    />
                  </div>
                  {/* Qty hint from first item desc */}
                  <span className="text-[9px] text-zinc-300 font-mono">{st.items[st.items.length - 1]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Gold & FD detail ──────────────────── */}
        <div className="bg-white border border-zinc-200 p-5 space-y-4">
          {/* Gold */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Gem className="w-3.5 h-3.5 text-amber-500" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Gold Holdings</h3>
              </div>
            </div>
            {[
              { name: 'Newly Purchased', value: gold, color: 'text-amber-600' },
              { name: 'Legacy Vault (~25.5T)', value: goldValue, color: 'text-amber-500' },
            ].filter(g => g.value > 0).map(g => (
              <div key={g.name} className="flex justify-between items-center py-2 border-b border-zinc-50 last:border-0">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{g.name}</span>
                <span className={cn("text-sm font-black font-mono", g.color)}>{formatCurrency(g.value)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] text-zinc-900 font-black uppercase tracking-widest">Total Gold</span>
              <span className="text-base font-black font-mono text-amber-600">{formatCurrency(gold + goldValue)}</span>
            </div>
          </div>
          {/* FD */}
          {fd > 0 && (
            <div className="border-t border-zinc-100 pt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Landmark className="w-3.5 h-3.5 text-purple-500" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fixed Deposit</h3>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">BOI FD (Suyash)</span>
                <span className="text-base font-black font-mono text-purple-600">{formatCurrency(fd)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
