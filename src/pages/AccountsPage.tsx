import { Transaction } from '../data';
import { BankBalances } from '../components/BankBalances';

interface AccountsPageProps {
  transactions: Transaction[];
}

export function AccountsPage({ transactions }: AccountsPageProps) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight">Accounts</h2>
        <p className="text-sm text-zinc-400 mt-0.5">All family bank accounts & live balances</p>
      </div>
      {transactions.length > 0 ? (
        <BankBalances transactions={transactions} />
      ) : (
        <div className="border-2 border-dashed border-zinc-200 rounded-lg p-12 text-center">
          <div className="text-4xl mb-3">🏦</div>
          <p className="text-sm font-bold text-zinc-500">No transactions loaded</p>
          <p className="text-xs text-zinc-400 mt-1">Sync a Google Sheet to see account balances</p>
        </div>
      )}
    </div>
  );
}
