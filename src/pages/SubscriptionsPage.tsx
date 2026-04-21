import { Transaction } from '../data';
import { SubscriptionTracker } from '../components/SubscriptionTracker';

interface SubscriptionsPageProps {
  transactions: Transaction[];
}

export function SubscriptionsPage({ transactions }: SubscriptionsPageProps) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight">Subscriptions & Bills</h2>
        <p className="text-sm text-zinc-400 mt-0.5">Recurring payments · Renewal tracking · Expiry alerts</p>
      </div>
      <SubscriptionTracker transactions={transactions} />
      {/* If no subscriptions found */}
      {transactions.filter(t => t.type === 'Fixed' && t.dr > 0).length === 0 && (
        <div className="border-2 border-dashed border-zinc-200 rounded-lg p-12 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-sm font-bold text-zinc-500">No recurring bills found</p>
          <p className="text-xs text-zinc-400 mt-1">Fixed-type transactions will appear here with expiry tracking</p>
        </div>
      )}
    </div>
  );
}
