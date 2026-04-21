import { Transaction } from '../data';
import { InvestmentPortfolio } from '../components/InvestmentPortfolio';

interface InvestmentsPageProps {
  transactions: Transaction[];
}

export function InvestmentsPage({ transactions }: InvestmentsPageProps) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight">Investments</h2>
        <p className="text-sm text-zinc-400 mt-0.5">Stocks · Gold · Fixed Deposits</p>
      </div>
      <InvestmentPortfolio transactions={transactions} />
    </div>
  );
}
