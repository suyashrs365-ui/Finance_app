import { useState, useMemo, useCallback } from 'react';
import { Transaction } from '../data';
import { cn } from '../lib/utils';
import {
  LayoutDashboard, BookOpen, Landmark, TrendingUp,
  Bell, BarChart3, ChevronLeft, ChevronRight, Sparkles, Menu, X
} from 'lucide-react';

export type PageId = 'dashboard' | 'ledger' | 'accounts' | 'investments' | 'subscriptions' | 'analytics';

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  alertCount?: number;
}

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard; emoji: string }[] = [
  { id: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard, emoji: '🏠' },
  { id: 'ledger',        label: 'Ledger',        icon: BookOpen,        emoji: '📋' },
  { id: 'accounts',      label: 'Accounts',      icon: Landmark,        emoji: '🏦' },
  { id: 'investments',   label: 'Investments',   icon: TrendingUp,      emoji: '📈' },
  { id: 'subscriptions', label: 'Subscriptions', icon: Bell,            emoji: '🔔' },
  { id: 'analytics',     label: 'Analytics',     icon: BarChart3,       emoji: '📊' },
];

export function Sidebar({ activePage, onNavigate, alertCount = 0 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (id: PageId) => { onNavigate(id); setMobileOpen(false); };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 bg-zinc-900 text-white p-2 rounded-lg shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full bg-zinc-900 text-white z-50 flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-56",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Logo area */}
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight truncate">Wealth Manager</h1>
              <p className="text-[9px] text-zinc-500 font-mono">v3.2</p>
            </div>
          )}
          <button
            onClick={() => { if (mobileOpen) setMobileOpen(false); else setCollapsed(c => !c); }}
            className="text-zinc-500 hover:text-white transition-colors shrink-0 p-1"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = activePage === item.id;
            const Icon = item.icon;
            const showBadge = item.id === 'subscriptions' && alertCount > 0;
            return (
              <button
                key={item.id}
                onClick={() => nav(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all relative group",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r" />}
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <span className="text-xs font-bold truncate">{item.label}</span>
                )}
                {showBadge && (
                  <span className={cn(
                    "bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center shrink-0",
                    collapsed ? "w-2 h-2 absolute top-1.5 right-2" : "w-4 h-4 ml-auto"
                  )}>
                    {!collapsed && alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: AI CFO shortcut */}
        {!collapsed && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>AI CFO → bottom right</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
