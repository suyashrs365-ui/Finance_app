import { Transaction } from '../data';
import { Analytics } from '../components/Analytics';

interface AnalyticsPageProps {
  transactions: Transaction[];
  selectedMonth: string | null;
}

export function AnalyticsPage({ transactions, selectedMonth }: AnalyticsPageProps) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight">Analytics</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Charts & Reports {selectedMonth ? `· ${selectedMonth}` : '· All Time'}
        </p>
      </div>
      <Analytics transactions={transactions} selectedMonth={selectedMonth} />
    </div>
  );
}
