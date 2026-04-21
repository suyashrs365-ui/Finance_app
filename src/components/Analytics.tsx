import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, LineChart,
  Line, Legend, Area, AreaChart
} from 'recharts';
import { useMemo } from 'react';
import { Transaction } from '../data';
import { formatCurrency } from '../lib/utils';

interface AnalyticsProps {
  transactions: Transaction[];
  selectedMonth?: string | null;
}

const formatK = (v: number) =>
  v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` :
  v >= 1000   ? `₹${(v / 1000).toFixed(0)}k`  : `₹${v}`;

const PALETTE = ['#18181b','#3f3f46','#52525b','#71717a','#a1a1aa','#d4d4d8'];
const TYPE_COLORS: Record<string, string> = {
  Fixed: '#f59e0b', Variable: '#ef4444', Investment: '#3b82f6',
  Income: '#10b981', Transfer: '#8b5cf6'
};

export function Analytics({ transactions, selectedMonth }: AnalyticsProps) {
  // ── Filter by month if selected ──────────────────────────────────────
  const filtered = useMemo(() => {
    if (!selectedMonth) return transactions;
    return transactions.filter(t => {
      const parts = t.date.split('-');
      return parts.length >= 3 && `${parts[1]}-${parts[2]}` === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  // ── Category breakdown (expenses only, exclude transfers) ────────────
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered
      .filter(t => t.dr > 0 && t.type !== 'Transfer')
      .forEach(t => { map[t.mainCategory] = (map[t.mainCategory] || 0) + t.dr; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  // ── Type breakdown pie ────────────────────────────────────────────────
  const typeData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(t => t.dr > 0 && t.type !== 'Transfer')
      .forEach(t => { map[t.type] = (map[t.type] || 0) + t.dr; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ── Monthly flow trend (ALL time, grouped by month) ──────────────────
  const monthlyFlow = useMemo(() => {
    const map: Record<string, { month: string; income: number; expense: number; invest: number }> = {};
    transactions.forEach(t => {
      const parts = t.date.split('-');
      if (parts.length < 3) return;
      const key = `${parts[1]}-${parts[2]}`;
      if (!map[key]) map[key] = { month: key, income: 0, expense: 0, invest: 0 };
      if (t.type === 'Income') map[key].income += t.cr;
      if (t.type === 'Fixed' || t.type === 'Variable') map[key].expense += t.dr;
      if (t.type === 'Investment') map[key].invest += t.dr;
    });
    // Sort by year then month
    const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return Object.values(map).sort((a, b) => {
      const [am, ay] = a.month.split('-');
      const [bm, by] = b.month.split('-');
      if (ay !== by) return parseInt(ay) - parseInt(by);
      return monthOrder.indexOf(am) - monthOrder.indexOf(bm);
    });
  }, [transactions]);

  // ── Top sub-categories ────────────────────────────────────────────────
  const subCatData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(t => t.dr > 0 && t.type !== 'Transfer')
      .forEach(t => { map[t.subCategory] = (map[t.subCategory] || 0) + t.dr; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-zinc-900 px-3 py-2 text-[10px] font-mono shadow-xl">
        <p className="font-black text-zinc-900 mb-1 uppercase tracking-widest">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }} className="font-bold">
            {p.name}: {formatK(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">

      {/* ── Monthly Income vs Expense vs Investment ─────────── */}
      <div className="lg:col-span-2 xl:col-span-2 bg-white border border-zinc-200 p-5">
        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
          Monthly Cash Flow · Income vs Expense vs Investment
        </h3>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="99%" height="100%">
            <BarChart data={monthlyFlow} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#a1a1aa', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 9, fill: '#a1a1aa', fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} iconType="square" wrapperStyle={{ fontSize: '9px', fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              <Bar dataKey="income" name="Income" fill="#10b981" barSize={14} radius={[2,2,0,0]} />
              <Bar dataKey="expense" name="Survival" fill="#ef4444" barSize={14} radius={[2,2,0,0]} />
              <Bar dataKey="invest" name="Invested" fill="#3b82f6" barSize={14} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Spend by Type (Pie) ─────────────────────────────── */}
      <div className="bg-white border border-zinc-200 p-5">
        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
          Spend Mix by Type {selectedMonth && `· ${selectedMonth}`}
        </h3>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="99%" height="100%">
            <PieChart>
              <Pie
                data={typeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {typeData.map((entry) => (
                  <Cell key={entry.name} fill={TYPE_COLORS[entry.name] || '#a1a1aa'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatK(v)} contentStyle={{ fontSize: '10px', fontFamily: 'monospace', border: '1px solid #18181b' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {typeData.map(d => (
            <div key={d.name} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: TYPE_COLORS[d.name] || '#a1a1aa' }} />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{d.name}</span>
              <span className="text-[9px] font-mono text-zinc-400">{formatK(d.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top Spending Categories (horizontal bar) ─────────── */}
      <div className="bg-white border border-zinc-200 p-5">
        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
          Top Categories {selectedMonth && `· ${selectedMonth}`}
        </h3>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="99%" height="100%">
            <BarChart data={categoryData} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="0" horizontal={false} vertical={true} stroke="#f4f4f5" />
              <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 8, fill: '#a1a1aa', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" width={72} tick={{ fontSize: 9, fontWeight: 700, fill: '#52525b', fontFamily: 'monospace' }} />
              <Tooltip formatter={(v: number) => formatK(v)} contentStyle={{ fontSize: '10px', fontFamily: 'monospace', border: '1px solid #18181b' }} />
              <Bar dataKey="value" name="Spent" radius={[0,2,2,0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top Sub-categories ────────────────────────────────── */}
      <div className="bg-white border border-zinc-200 p-5">
        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
          Top Sub-Categories {selectedMonth && `· ${selectedMonth}`}
        </h3>
        <div className="space-y-3 mt-2">
          {subCatData.map((item, i) => {
            const maxVal = subCatData[0]?.value || 1;
            const pct = (item.value / maxVal) * 100;
            return (
              <div key={item.name}>
                <div className="flex justify-between text-[10px] font-bold mb-1">
                  <span className="uppercase tracking-widest text-zinc-600">{item.name}</span>
                  <span className="font-mono text-zinc-900">{formatK(item.value)}</span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                </div>
              </div>
            );
          })}
          {subCatData.length === 0 && (
            <p className="text-zinc-400 text-xs italic text-center py-4">No expense data for selected period</p>
          )}
        </div>
      </div>

      {/* ── Net Worth Trend (area) ────────────────────────────── */}
      <div className="lg:col-span-2 xl:col-span-2 bg-white border border-zinc-200 p-5">
        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
          Net Cash Flow by Month (Income − Expenses)
        </h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="99%" height="100%">
            <AreaChart data={monthlyFlow}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#a1a1aa', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 9, fill: '#a1a1aa', fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={45} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const net = d.income - d.expense - d.invest;
                  return (
                    <div className="bg-white border border-zinc-900 px-3 py-2 text-[10px] font-mono shadow-xl">
                      <p className="font-black text-zinc-900 mb-1 uppercase tracking-widest">{label}</p>
                      <p className="text-emerald-600 font-bold">Income: {formatK(d.income)}</p>
                      <p className="text-rose-500 font-bold">Survival: {formatK(d.expense)}</p>
                      <p className="text-blue-500 font-bold">Invested: {formatK(d.invest)}</p>
                      <p className={net >= 0 ? "text-emerald-700 font-black mt-1" : "text-rose-700 font-black mt-1"}>
                        Net: {formatK(net)}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#netGrad)"
                dot={{ r: 3, fill: '#10b981' }}
                name="Income"
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                name="Survival"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
