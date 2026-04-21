import { useMemo } from 'react';
import { Transaction } from '../data';
import { cn } from '../lib/utils';
import { CalendarDays } from 'lucide-react';

interface MonthSelectorProps {
  transactions: Transaction[];
  selectedMonth: string | null;
  onChange: (month: string | null) => void;
}

export function MonthSelector({ transactions, selectedMonth, onChange }: MonthSelectorProps) {
  const months = useMemo(() => {
    const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const set = new Set<string>();
    transactions.forEach(t => {
      const parts = t.date.split('-');
      if (parts.length >= 3) set.add(`${parts[1]}-${parts[2]}`);
    });
    return Array.from(set).sort((a, b) => {
      const [am, ay] = a.split('-');
      const [bm, by] = b.split('-');
      if (ay !== by) return parseInt(ay) - parseInt(by);
      return monthOrder.indexOf(am) - monthOrder.indexOf(bm);
    });
  }, [transactions]);

  return (
    <div className="flex items-center gap-2 flex-wrap mb-5">
      <div className="flex items-center gap-1.5 mr-1">
        <CalendarDays className="w-3.5 h-3.5 text-zinc-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Period</span>
      </div>
      <button
        onClick={() => onChange(null)}
        className={cn(
          "px-3 py-1 text-[9px] font-black uppercase tracking-widest border transition-all",
          selectedMonth === null
            ? "bg-zinc-900 text-white border-zinc-900"
            : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-700"
        )}
      >
        All Time
      </button>
      {months.map(month => (
        <button
          key={month}
          onClick={() => onChange(month)}
          className={cn(
            "px-3 py-1 text-[9px] font-black uppercase tracking-widest border transition-all",
            selectedMonth === month
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-700"
          )}
        >
          {month}
        </button>
      ))}
    </div>
  );
}
