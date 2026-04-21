import { useMemo } from 'react';
import { Transaction } from '../data';
import { cn } from '../lib/utils';
import { Bell, AlertTriangle, Clock, CheckCircle, Shield, Wifi, Smartphone, Zap } from 'lucide-react';

interface SubscriptionTrackerProps {
  transactions: Transaction[];
}

interface SubscriptionItem {
  description: string;
  subCategory: string;
  date: string;
  daysFromDate: number;
  expiryDate: Date;
  daysLeft: number;
  bank: string;
  amount: number;
  icon: typeof Bell;
  status: 'expired' | 'critical' | 'warning' | 'active';
}

const MONTH_MAP: Record<string, number> = {
  Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11
};

function parseDate(dateStr: string): Date | null {
  const parts = dateStr.split('-');
  if (parts.length < 3) return null;
  const day = parseInt(parts[0]);
  const month = MONTH_MAP[parts[1]];
  const year = 2000 + parseInt(parts[2]);
  if (isNaN(day) || month === undefined || isNaN(year)) return null;
  return new Date(year, month, day);
}

function extractDuration(desc: string): number {
  const d = desc.toLowerCase();
  // "98 days" or "98days"
  const daysMatch = d.match(/(\d+)\s*day/);
  if (daysMatch) return parseInt(daysMatch[1]);
  // "5 month" or "5 months"
  const monthMatch = d.match(/(\d+)\s*mo/);
  if (monthMatch) return parseInt(monthMatch[1]) * 30;
  // "year" or "annual" or "yearly"
  if (d.includes('year') || d.includes('annual')) return 365;
  // default: monthly
  return 30;
}

function getIcon(subCat: string, desc: string): typeof Bell {
  const d = (subCat + desc).toLowerCase();
  if (d.includes('wifi') || d.includes('internet') || d.includes('broadband')) return Wifi;
  if (d.includes('mobile') || d.includes('jio') || d.includes('recharge') || d.includes('sim')) return Smartphone;
  if (d.includes('electric') || d.includes('light') || d.includes('power')) return Zap;
  if (d.includes('insur')) return Shield;
  return Bell;
}

// Fixed types that are subscription-like
const SUB_SUBCATS = [
  'Subscriptions', 'Mobile Recharge', 'Internet', 'Electricity',
  'Software', 'FASTag / Toll', 'College Fee', 'Insurance'
];

export function SubscriptionTracker({ transactions }: SubscriptionTrackerProps) {
  const now = new Date();

  const subscriptions = useMemo((): SubscriptionItem[] => {
    // Group by description to find LATEST occurrence
    const latestMap: Record<string, Transaction> = {};
    transactions
      .filter(t =>
        t.dr > 0 &&
        (t.type === 'Fixed' || SUB_SUBCATS.includes(t.subCategory))
      )
      .forEach(t => {
        const key = `${t.subCategory}__${t.bank}`;
        const existing = latestMap[key];
        if (!existing) { latestMap[key] = t; return; }
        // Keep latest date
        const existDate = parseDate(existing.date);
        const newDate = parseDate(t.date);
        if (existDate && newDate && newDate > existDate) latestMap[key] = t;
      });

    return Object.values(latestMap).map(t => {
      const startDate = parseDate(t.date);
      if (!startDate) return null;
      const daysFromDate = extractDuration(t.description);
      const expiryDate = new Date(startDate);
      expiryDate.setDate(expiryDate.getDate() + daysFromDate);
      const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let status: SubscriptionItem['status'];
      if (daysLeft < 0) status = 'expired';
      else if (daysLeft <= 7) status = 'critical';
      else if (daysLeft <= 30) status = 'warning';
      else status = 'active';

      return {
        description: t.description,
        subCategory: t.subCategory,
        date: t.date,
        daysFromDate,
        expiryDate,
        daysLeft,
        bank: t.bank,
        amount: t.dr,
        icon: getIcon(t.subCategory, t.description),
        status,
      } as SubscriptionItem;
    }).filter(Boolean)
      .sort((a, b) => a!.daysLeft - b!.daysLeft) as SubscriptionItem[];
  }, [transactions]);

  const alerts = subscriptions.filter(s => s.status !== 'active');
  const active = subscriptions.filter(s => s.status === 'active');

  const statusConfig = {
    expired:  { bg: 'bg-rose-50 border-rose-200',    badge: 'bg-rose-500 text-white',    text: 'EXPIRED',         icon: '🔴' },
    critical: { bg: 'bg-red-50 border-red-300',       badge: 'bg-red-500 text-white',     text: 'EXPIRES SOON',    icon: '⚠️' },
    warning:  { bg: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-500 text-white',   text: 'DUE THIS MONTH',  icon: '⏰' },
    active:   { bg: 'bg-white border-zinc-200',       badge: 'bg-emerald-100 text-emerald-700', text: 'ACTIVE',    icon: '✅' },
  };

  if (subscriptions.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 mb-4">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-rose-700 mb-1">
              {alerts.length} Subscription{alerts.length > 1 ? 's' : ''} Need Attention
            </p>
            <p className="text-xs text-rose-500">
              {alerts.map(a => `${a.description}${a.status === 'expired' ? ' (EXPIRED)' : ` (${a.daysLeft} days left)`}`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Subscriptions & Recurring</h2>
          <p className="text-sm font-bold text-zinc-700 mt-0.5">Fixed Bills · Renewals · Expiry Tracker</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
          {alerts.length > 0 && <span className="text-rose-500 flex items-center gap-1"><Bell className="w-3 h-3" /> {alerts.length} alerts</span>}
          <span className="text-zinc-400">{subscriptions.length} tracked</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {subscriptions.map((sub, i) => {
          const cfg = statusConfig[sub.status];
          const Icon = sub.icon;
          const expiryStr = sub.expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
          return (
            <div key={i} className={cn("border p-4 flex flex-col gap-2", cfg.bg)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4 shrink-0",
                    sub.status === 'expired' ? 'text-rose-400' :
                    sub.status === 'critical' ? 'text-red-500' :
                    sub.status === 'warning'  ? 'text-amber-500' : 'text-zinc-400'
                  )} />
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{sub.subCategory}</span>
                    <p className="text-xs font-bold text-zinc-900 leading-tight">{sub.description}</p>
                  </div>
                </div>
                <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 whitespace-nowrap shrink-0", cfg.badge)}>
                  {cfg.text}
                </span>
              </div>

              {/* Progress bar for active */}
              {sub.status === 'active' && sub.daysLeft <= 90 && (
                <div>
                  <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (sub.daysLeft / sub.daysFromDate) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between text-[9px] text-zinc-400 mt-auto pt-1 border-t border-black/5">
                <span className="font-mono">
                  Pays: {sub.date}
                </span>
                <span className="font-bold flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {sub.status === 'expired'
                    ? `${Math.abs(sub.daysLeft)}d ago`
                    : `${expiryStr}`
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-zinc-400">{sub.bank}</span>
                <span className="text-xs font-black font-mono text-zinc-700">₹{sub.amount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
