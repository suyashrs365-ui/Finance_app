import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCcw, LinkIcon, LayoutDashboard, BookOpen, Landmark, TrendingUp, Bell, BarChart3, Plus, Search, Download, ChevronUp, ChevronDown, Minus, Menu, X, Sparkles, ChevronLeft, ChevronRight, ArrowRight, CalendarDays, Wallet, CreditCard, PiggyBank, Key, Send, Loader2, CheckCircle, TrendingDown, Gem, Wifi, Smartphone, Zap, Shield, Clock, AlertTriangle } from 'lucide-react';
import { INITIAL_TRANSACTIONS, Transaction } from './data';
import { TransactionRow } from './components/TransactionRow';
import { StatsGrid } from './components/StatsGrid';
import { Analytics } from './components/Analytics';
import { BankBalances } from './components/BankBalances';
import { SheetManager, SheetConfig } from './components/SheetManager';
import { AddTransactionModal } from './components/AddTransactionModal';
import { LoginPage } from './components/LoginPage';
import { cn, formatCurrency } from './lib/utils';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Page = 'dashboard' | 'ledger' | 'accounts' | 'investments' | 'subscriptions' | 'analytics';
type SortKey = 'date' | 'dr' | 'cr' | 'person' | 'type' | 'mainCategory';
type SortDir = 'asc' | 'desc';

const MASTER: SheetConfig = { id: 'master', name: 'Master Ledger', spreadsheetId: '', range: '', lastSynced: null };

function parseDateVal(d: string): number {
  const m: Record<string,number> = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const p = d.split('-'); if (p.length<3) return 0;
  return parseInt('20'+p[2])*10000+(m[p[1]]||0)*100+parseInt(p[0]);
}

// ─────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem('wm_auth') === '1');
  if (!isAuthed) return <LoginPage onLogin={() => setIsAuthed(true)} />;
  return <AuthedApp onLogout={() => { localStorage.removeItem('wm_auth'); setIsAuthed(false); }} />;
}

function AuthedApp({ onLogout }: { onLogout: () => void }) {
  const [sheets, setSheets] = useState<SheetConfig[]>([MASTER]);
  const [activeSheetId, setActiveSheetId] = useState('master');
  const [sheetData, setSheetData] = useState<Record<string,Transaction[]>>({ master: INITIAL_TRANSACTIONS });
  const ledger = sheetData[activeSheetId] || INITIAL_TRANSACTIONS;

  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string|null>(() => {
    const now = new Date();
    return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;
  });

  // Gemini state
  const [geminiOpen, setGeminiOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [geminiMessages, setGeminiMessages] = useState<{id:string;role:'user'|'assistant';content:string}[]>([
    { id:'0', role:'assistant', content:"Namaste! 🙏 I'm your AI CFO. Ask me anything about your finances — net worth, budget, savings tips, or investment analysis." }
  ]);
  const [geminiInput, setGeminiInput] = useState('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiHistory, setGeminiHistory] = useState<{role:string;content:string}[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { fetch('/api/auth/status').then(r=>r.json()).then(d=>setIsConnected(d.isAuthenticated)).catch(()=>{}); }, []);

  const syncSheet = useCallback(async (id: string) => {
    const s = sheets.find(x => x.id === id);
    if (!s?.spreadsheetId) { showToast('❌ No sheet ID'); return; }
    setIsSyncing(true);
    try {
      // Try public import first (no OAuth needed for shared sheets)
      let d = await fetch('/api/gsheets/public-import', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ spreadsheetId: s.spreadsheetId })
      }).then(r=>r.json());
      // Fallback to OAuth import if public fails
      if (d.error && isConnected) {
        d = await fetch('/api/gsheets/import', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ spreadsheetId: s.spreadsheetId, range: s.range || 'Sheet1!A1:K2000' })
        }).then(r=>r.json());
      }
      if (d.transactions?.length) {
        setSheetData(p=>({...p,[id]:d.transactions}));
        setSheets(p=>p.map(x=>x.id===id?{...x,lastSynced:new Date().toLocaleTimeString('en-IN'),rowCount:d.transactions.length}:x));
        showToast(`✅ Scanned ${d.transactions.length} rows`);
      } else showToast(d.error ? `❌ ${d.error}` : '⚠️ No data found');
    } catch { showToast('❌ Scan failed'); }
    finally { setIsSyncing(false); }
  }, [sheets, isConnected]);

  const addSheet = async (cfg: Omit<SheetConfig,'id'|'lastSynced'>) => {
    const id = `sheet-${Date.now()}`;
    setSheets(p=>[...p,{...cfg,id,lastSynced:null}]);
    setSheetData(p=>({...p,[id]:[]}));
    setActiveSheetId(id);
    showToast(`📄 "${cfg.name}" added`);
    if (cfg.spreadsheetId) {
      setIsSyncing(true);
      try {
        const d = await fetch('/api/gsheets/public-import', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ spreadsheetId: cfg.spreadsheetId })
        }).then(r=>r.json());
        if (d.transactions?.length) {
          setSheetData(p=>({...p,[id]:d.transactions}));
          setSheets(p=>p.map(x=>x.id===id?{...x,lastSynced:new Date().toLocaleTimeString('en-IN'),rowCount:d.transactions.length}:x));
          showToast(`✅ ${d.transactions.length} rows scanned!`);
        } else showToast(d.error ? `❌ ${d.error}` : '⚠️ No data');
      } catch { showToast('❌ Auto-sync failed'); }
      finally { setIsSyncing(false); }
    }
  };

  const removeSheet = (id: string) => {
    if (id==='master') return;
    setSheets(p=>p.filter(x=>x.id!==id));
    setSheetData(p=>{const n={...p};delete n[id];return n;});
    if (activeSheetId===id) setActiveSheetId('master');
  };

  const switchSheet = (id: string) => {
    setActiveSheetId(id);
    showToast(`Switched to "${sheets.find(s=>s.id===id)?.name}"`);
  };

  const addTx = (t: Transaction) => {
    setSheetData(p=>({...p,[activeSheetId]:[t,...(p[activeSheetId]||[])]}));
    showToast('✅ Entry added');
  };

  const exportCSV = () => {
    const rows = ledger.map(t=>`${t.date},${t.person},${t.type},${t.mainCategory},${t.subCategory},"${t.description}",${t.bank},${t.mode},${t.dr},${t.cr},"${t.nature||''}"`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['Date,Person,Type,Category,SubCat,Description,Bank,Mode,Dr,Cr,Nature\n'+rows],{type:'text/csv'}));
    a.download = `ledger-${Date.now()}.csv`; a.click();
    showToast('📥 Exported');
  };

  // Subscription alert count
  const subAlerts = useMemo(() => {
    const now = new Date();
    const M: Record<string,number> = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    return ledger.filter(t=>t.type==='Fixed'&&t.dr>0).filter(t=>{
      const p=t.date.split('-'); if (p.length<3) return false;
      const start = new Date(2000+parseInt(p[2]),(M[p[1]]??0),parseInt(p[0]));
      const d=t.description.toLowerCase();
      const dur = d.match(/(\d+)\s*day/)?.[1] ? parseInt(d.match(/(\d+)\s*day/)![1]) :
                  d.match(/(\d+)\s*mo/)?.[1]  ? parseInt(d.match(/(\d+)\s*mo/)![1])*30 :
                  d.includes('year') ? 365 : 30;
      const exp = new Date(start); exp.setDate(exp.getDate()+dur);
      return Math.ceil((exp.getTime()-now.getTime())/86400000)<=30;
    }).length;
  }, [ledger]);

  // Month list
  const months = useMemo(() => {
    const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const s = new Set<string>();
    ledger.forEach(t=>{ const p=t.date.split('-'); if(p.length>=3) s.add(`${p[1]}-${p[2]}`); });
    return Array.from(s).sort((a,b)=>{ const [am,ay]=a.split('-');const [bm,by]=b.split('-'); return ay!==by?parseInt(ay)-parseInt(by):MO.indexOf(am)-MO.indexOf(bm); });
  }, [ledger]);

  // Gemini send
  const sendGemini = async (text: string) => {
    if (!text.trim()||geminiLoading) return;
    if (!geminiKey) { setShowKeyInput(true); return; }
    const msg = {id:Date.now().toString(),role:'user' as const,content:text};
    setGeminiMessages(p=>[...p,msg]);
    setGeminiInput('');
    setGeminiLoading(true);
    const income = ledger.filter(t=>t.type==='Income').reduce((s,t)=>s+t.cr,0);
    const fixed = ledger.filter(t=>t.type==='Fixed').reduce((s,t)=>s+t.dr,0);
    const variable = ledger.filter(t=>t.type==='Variable').reduce((s,t)=>s+t.dr,0);
    const invest = ledger.filter(t=>t.type==='Investment').reduce((s,t)=>s+t.dr,0);
    const context = `LEDGER: ${ledger.length} entries. Income:₹${income.toFixed(0)} Fixed:₹${fixed.toFixed(0)} Variable:₹${variable.toFixed(0)} Invested:₹${invest.toFixed(0)} Target:₹23000/mo. Family: Suyash, Rohini, Mummy.`;
    try {
      const newHist = [...geminiHistory,{role:'user',content:text}];
      const res = await fetch('/api/gemini/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:text,context,history:geminiHistory.slice(-6),apiKey:geminiKey})
      });
      const d = await res.json();
      const reply = d.reply||d.error||'No response.';
      setGeminiMessages(p=>[...p,{id:(Date.now()+1).toString(),role:'assistant',content:reply}]);
      setGeminiHistory([...newHist,{role:'assistant',content:reply}]);
    } catch { setGeminiMessages(p=>[...p,{id:(Date.now()+1).toString(),role:'assistant',content:'❌ Network error.'}]); }
    finally { setGeminiLoading(false); }
  };

  const activeSheet = sheets.find(s=>s.id===activeSheetId);

  const navigate = (p: Page) => { setPage(p); setSidebarOpen(false); };

  const navItems: {id:Page;label:string;icon:React.ReactNode;badge?:number}[] = [
    {id:'dashboard',label:'Dashboard',icon:<LayoutDashboard className="w-4 h-4"/>},
    {id:'ledger',label:'Ledger',icon:<BookOpen className="w-4 h-4"/>},
    {id:'accounts',label:'Accounts',icon:<Landmark className="w-4 h-4"/>},
    {id:'investments',label:'Investments',icon:<TrendingUp className="w-4 h-4"/>},
    {id:'subscriptions',label:'Subscriptions',icon:<Bell className="w-4 h-4"/>,badge:subAlerts||undefined},
    {id:'analytics',label:'Analytics',icon:<BarChart3 className="w-4 h-4"/>},
  ];

  const sidebarW = sidebarCollapsed ? 'w-16' : 'w-56';
  const mainML = sidebarCollapsed ? 'md:ml-16' : 'md:ml-56';

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      {/* Mobile overlay */}
      {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={()=>setSidebarOpen(false)}/>}

      <aside className={cn("fixed top-0 left-0 h-full bg-zinc-900 text-white z-50 flex flex-col transition-all duration-200 shadow-2xl",sidebarW,sidebarOpen?'translate-x-0':'-translate-x-full md:translate-x-0')}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 min-h-[60px]">
          {!sidebarCollapsed && <div><p className="text-sm font-black tracking-tight">Wealth Manager</p><p className="text-[9px] text-zinc-500">Family · AI · Live</p></div>}
          <button onClick={()=>{setSidebarOpen(false);setSidebarCollapsed(c=>!c);}} className="text-zinc-500 hover:text-white p-1 shrink-0 hidden md:block">
            {sidebarCollapsed?<ChevronRight className="w-4 h-4"/>:<ChevronLeft className="w-4 h-4"/>}
          </button>
          <button onClick={()=>setSidebarOpen(false)} className="text-zinc-500 hover:text-white p-1 md:hidden"><X className="w-4 h-4"/></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3">
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>navigate(item.id)}
              className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-all relative",
                page===item.id?'bg-white/10 text-white':'text-zinc-400 hover:text-white hover:bg-white/5')}>
              {page===item.id && <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-white rounded-r"/>}
              <span className="shrink-0">{item.icon}</span>
              {!sidebarCollapsed && <span className="text-xs font-bold truncate">{item.label}</span>}
              {!sidebarCollapsed && item.badge ? (
                <span className="ml-auto bg-rose-500 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">{item.badge}</span>
              ):null}
              {sidebarCollapsed && item.badge ? (
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full"/>
              ):null}
            </button>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-4 border-t border-white/10">
            <p className="text-[9px] text-zinc-600">✨ AI CFO → bottom right</p>
          </div>
        )}
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <main className={cn("flex-1 min-h-screen transition-all duration-200",mainML)}>

        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-zinc-50/90 backdrop-blur border-b border-zinc-200">
          <div className="flex items-center justify-between px-4 py-2 gap-3">
            <div className="flex items-center gap-3">
              <button className="md:hidden text-zinc-600 hover:text-zinc-900" onClick={()=>setSidebarOpen(true)}>
                <Menu className="w-5 h-5"/>
              </button>
              <div className="hidden sm:block">
                <span className="text-xs font-bold">{activeSheet?.name}</span>
                {activeSheet?.lastSynced && <span className="text-[9px] text-zinc-400 ml-2">Synced {activeSheet.lastSynced}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Quick scan button always visible for non-master sheets */}
              {activeSheetId !== 'master' && (
                <button onClick={()=>syncSheet(activeSheetId)} disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                  <RefreshCcw className={cn('w-3 h-3', isSyncing && 'animate-spin')}/>
                  {isSyncing ? 'Scanning…' : 'Scan Again'}
                </button>
              )}
              <SheetManager sheets={sheets} activeSheetId={activeSheetId} isConnected={isConnected} isSyncing={isSyncing}
                onConnect={async()=>{try{const{url}=await fetch('/api/auth/url').then(r=>r.json());window.open(url,'_blank','width=600,height=700');}catch{showToast('❌ Auth failed');}}}
                onAddSheet={addSheet} onRemoveSheet={removeSheet} onSwitchSheet={switchSheet} onSyncSheet={syncSheet}/>
              {!isConnected && <button onClick={()=>{}} className="text-[10px] font-bold text-zinc-400 flex items-center gap-1"><LinkIcon className="w-3 h-3"/>Connect</button>}
              {/* Logout */}
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-black text-zinc-400 hover:text-rose-500 hover:bg-rose-50 border border-zinc-200 rounded-lg transition-all uppercase tracking-wide"
                title="Sign out">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
              </button>
            </div>
          </div>

          {/* Month selector */}
          <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
            <CalendarDays className="w-3.5 h-3.5 text-zinc-400 shrink-0"/>
            <button onClick={()=>setSelectedMonth(null)} className={cn("px-2.5 py-0.5 text-[9px] font-bold border rounded-full transition-all",selectedMonth===null?"bg-zinc-900 text-white":"bg-white text-zinc-400 border-zinc-200")}>All Time</button>
            {months.map(m=>(
              <button key={m} onClick={()=>setSelectedMonth(m)} className={cn("px-2.5 py-0.5 text-[9px] font-bold border rounded-full transition-all",selectedMonth===m?"bg-zinc-900 text-white":"bg-white text-zinc-400 border-zinc-200")}>{m}</button>
            ))}
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.15}}>

              {/* ═══ DASHBOARD ══════════════════════════════════════ */}
              {page==='dashboard' && <DashboardSection ledger={ledger} selectedMonth={selectedMonth} navigate={navigate}/>}

              {/* ═══ LEDGER ════════════════════════════════════════ */}
              {page==='ledger' && <LedgerSection ledger={ledger} onAdd={()=>setShowAddModal(true)} onExport={exportCSV}/>}

              {/* ═══ ACCOUNTS ══════════════════════════════════════ */}
              {page==='accounts' && (
                <div>
                  <div className="mb-5"><h2 className="text-xl font-black">Accounts</h2><p className="text-sm text-zinc-400">Live balances for all family accounts</p></div>
                  <BankBalances transactions={ledger}/>
                </div>
              )}

              {/* ═══ INVESTMENTS ═══════════════════════════════════ */}
              {page==='investments' && <InvestmentsSection ledger={ledger}/>}

              {/* ═══ SUBSCRIPTIONS ═════════════════════════════════ */}
              {page==='subscriptions' && <SubscriptionsSection ledger={ledger}/>}

              {/* ═══ ANALYTICS ═════════════════════════════════════ */}
              {page==='analytics' && (
                <div>
                  <div className="mb-5"><h2 className="text-xl font-black">Analytics</h2><p className="text-sm text-zinc-400">Charts & Reports {selectedMonth?`· ${selectedMonth}`:'· All Time'}</p></div>
                  <Analytics transactions={ledger} selectedMonth={selectedMonth}/>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── GEMINI AI CFO ──────────────────────────────────────── */}
      <button onClick={()=>setGeminiOpen(true)} style={{display:geminiOpen?'none':undefined}}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white rounded-full shadow-2xl text-xs font-bold hover:bg-zinc-700 transition-all">
        <Sparkles className="w-4 h-4 text-amber-400"/>AI CFO
      </button>

      <AnimatePresence>
        {geminiOpen && (
          <motion.div initial={{opacity:0,scale:0.95,y:20}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:20}}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-white border border-zinc-200 shadow-2xl rounded-xl flex flex-col overflow-hidden"
            style={{height:480,maxHeight:'80vh'}}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 text-white shrink-0">
              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400"/><span className="text-xs font-bold">Gemini AI CFO</span>{geminiKey&&<span className="text-[8px] px-1.5 py-0.5 bg-emerald-500 rounded-full font-bold">Live</span>}</div>
              <div className="flex gap-2"><button onClick={()=>setShowKeyInput(v=>!v)} className="text-zinc-400 hover:text-white"><Key className="w-3.5 h-3.5"/></button><button onClick={()=>setGeminiOpen(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4"/></button></div>
            </div>
            {/* Key input */}
            {showKeyInput && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 shrink-0">
                <p className="text-[10px] font-bold text-amber-700 mb-2">🔑 Get free key: <a href="https://aistudio.google.com/app/apikey" target="_blank" className="underline">aistudio.google.com</a></p>
                <div className="flex gap-2">
                  <input type="password" value={geminiKey} onChange={e=>setGeminiKey(e.target.value)} placeholder="AIzaSy..."
                    className="flex-1 text-xs border border-amber-200 px-2 py-1.5 rounded focus:outline-none font-mono bg-white"/>
                  <button onClick={()=>{localStorage.setItem('gemini_api_key',geminiKey);setShowKeyInput(false);showToast('🔑 Key saved!');}}
                    disabled={!geminiKey.trim()} className="px-3 py-1.5 bg-amber-600 text-white text-[10px] font-bold rounded disabled:opacity-40">Save</button>
                </div>
                {geminiKey&&<p className="text-[9px] text-emerald-600 font-bold mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3"/>Saved locally</p>}
              </div>
            )}
            {!geminiKey&&!showKeyInput&&(
              <div className="px-4 py-4 bg-zinc-50 border-b text-center shrink-0">
                <p className="text-xs text-zinc-500 mb-2">Add your Gemini API key to start</p>
                <button onClick={()=>setShowKeyInput(true)} className="px-4 py-2 bg-zinc-900 text-white text-[10px] font-bold rounded hover:bg-zinc-700">🔑 Add API Key</button>
              </div>
            )}
            {/* Messages */}
            <GeminiMessages messages={geminiMessages} loading={geminiLoading}/>
            {/* Quick prompts */}
            <div className="px-3 py-2 border-t border-zinc-100 flex gap-1.5 overflow-x-auto shrink-0">
              {["Net worth?","Over budget?","Where overspending?","Investments?","Savings tips?"].map(q=>(
                <button key={q} onClick={()=>sendGemini(q)} className="whitespace-nowrap text-[9px] font-bold px-2.5 py-1 border border-zinc-200 rounded-full text-zinc-500 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 shrink-0 transition-all">{q}</button>
              ))}
            </div>
            {/* Input */}
            <div className="flex border-t border-zinc-200 shrink-0">
              <input type="text" value={geminiInput} onChange={e=>setGeminiInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendGemini(geminiInput)}
                placeholder={geminiKey?"Ask anything…":"Add API key first"} disabled={geminiLoading||!geminiKey}
                className="flex-1 px-4 py-3 text-xs focus:outline-none bg-white"/>
              <button onClick={()=>sendGemini(geminiInput)} disabled={!geminiInput.trim()||geminiLoading||!geminiKey}
                className="px-4 bg-zinc-900 text-white disabled:opacity-30 hover:bg-zinc-700 transition-colors">
                <Send className="w-3.5 h-3.5"/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals & Toast */}
      <AddTransactionModal isOpen={showAddModal} onClose={()=>setShowAddModal(false)} onAdd={addTx}/>
      <AnimatePresence>
        {toast&&<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] bg-zinc-900 text-white px-5 py-2.5 text-xs font-bold rounded-full shadow-2xl whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Gemini message list (extracted to avoid re-render issues)
// ─────────────────────────────────────────────────────────────
function GeminiMessages({ messages, loading }: { messages:{id:string;role:'user'|'assistant';content:string}[]; loading:boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{ ref.current?.scrollIntoView({behavior:'smooth'}); },[messages]);
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
      {messages.map(m=>(
        <div key={m.id} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
          <div className={`max-w-[85%] text-xs leading-relaxed px-3 py-2.5 rounded-lg ${m.role==='user'?'bg-zinc-900 text-white rounded-br-sm':'bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm'}`} style={{whiteSpace:'pre-wrap'}}>{m.content}</div>
        </div>
      ))}
      {loading&&<div className="flex"><div className="bg-white border border-zinc-200 px-3 py-2.5 rounded-lg flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin text-zinc-400"/><span className="text-xs text-zinc-400">Thinking…</span></div></div>}
      <div ref={ref}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard Section
// ─────────────────────────────────────────────────────────────
function DashboardSection({ ledger, selectedMonth, navigate }: { ledger:Transaction[]; selectedMonth:string|null; navigate:(p:Page)=>void }) {
  const recent = useMemo(() =>
    [...ledger].sort((a,b)=>parseDateVal(b.date)-parseDateVal(a.date)).slice(0,6)
  ,[ledger]);

  const cards = [
    {label:'Ledger',desc:`${ledger.length} entries`,icon:<BookOpen className="w-5 h-5"/>,page:'ledger' as Page,color:'bg-zinc-900 text-white'},
    {label:'Accounts',desc:'Live balances',icon:<Landmark className="w-5 h-5"/>,page:'accounts' as Page,color:'bg-emerald-600 text-white'},
    {label:'Investments',desc:'Stocks · Gold · FD',icon:<TrendingUp className="w-5 h-5"/>,page:'investments' as Page,color:'bg-blue-600 text-white'},
    {label:'Analytics',desc:'Charts & Reports',icon:<BarChart3 className="w-5 h-5"/>,page:'analytics' as Page,color:'bg-purple-600 text-white'},
  ];

  return (
    <div>
      <div className="mb-5"><h2 className="text-xl font-black">Dashboard</h2><p className="text-sm text-zinc-400">{selectedMonth??'All Time'} · Suyash · Rohini · Mummy</p></div>
      <StatsGrid transactions={ledger} selectedMonth={selectedMonth}/>
      {/* Quick nav */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map(c=>(
          <button key={c.label} onClick={()=>navigate(c.page)} className={`${c.color} p-4 rounded-xl text-left group hover:opacity-90 active:scale-[0.98] transition-all`}>
            <div className="flex justify-between mb-3">{c.icon}<ArrowRight className="w-4 h-4 opacity-40 group-hover:opacity-80 group-hover:translate-x-0.5 transition-all"/></div>
            <p className="text-sm font-bold">{c.label}</p>
            <p className="text-[10px] opacity-60">{c.desc}</p>
          </button>
        ))}
      </div>
      {/* Recent */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-100">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Recent Transactions</span>
          <button onClick={()=>navigate('ledger')} className="text-[10px] font-bold text-blue-600">View All →</button>
        </div>
        <div className="divide-y divide-zinc-50">
          {recent.map(t=>(
            <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${t.dr>0?'bg-rose-50 text-rose-500':'bg-emerald-50 text-emerald-600'}`}>{t.dr>0?'↓':'↑'}</div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-800 truncate">{t.description}</p>
                  <p className="text-[10px] text-zinc-400">{t.date} · {t.person} · {t.bank}</p>
                </div>
              </div>
              <span className={`text-sm font-bold font-mono shrink-0 ml-3 ${t.dr>0?'text-rose-500':'text-emerald-600'}`}>{t.dr>0?`-${formatCurrency(t.dr)}`:`+${formatCurrency(t.cr)}`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ledger Section
// ─────────────────────────────────────────────────────────────
function LedgerSection({ ledger, onAdd, onExport }: { ledger:Transaction[]; onAdd:()=>void; onExport:()=>void }) {
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState<string|null>(null);
  const [type, setType] = useState<string|null>(null);
  const [sk, setSk] = useState<SortKey>('date');
  const [sd, setSd] = useState<SortDir>('desc');

  const persons = useMemo(()=>[...new Set(ledger.map(t=>t.person).filter(Boolean))],[ledger]);
  const types = useMemo(()=>[...new Set(ledger.map(t=>t.type).filter(Boolean))],[ledger]);

  const filtered = useMemo(()=>{
    let r = ledger.filter(t=>{
      const q=search.toLowerCase();
      return (!q||t.description.toLowerCase().includes(q)||t.subCategory.toLowerCase().includes(q)||t.mainCategory.toLowerCase().includes(q)||(t.nature||'').toLowerCase().includes(q))
        &&(!person||t.person===person)&&(!type||t.type===type);
    });
    return [...r].sort((a,b)=>{
      let va:any,vb:any;
      if(sk==='date'){va=parseDateVal(a.date);vb=parseDateVal(b.date);}
      else if(sk==='dr'||sk==='cr'){va=a[sk];vb=b[sk];}
      else{va=String(a[sk]||'').toLowerCase();vb=String(b[sk]||'').toLowerCase();}
      return sd==='asc'?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0);
    });
  },[search,person,type,ledger,sk,sd]);

  const sort=(k:SortKey)=>{if(sk===k)setSd(d=>d==='asc'?'desc':'asc');else{setSk(k);setSd('asc');}};
  const SI=({k}:{k:SortKey})=>sk!==k?<Minus className="w-2.5 h-2.5 ml-0.5 opacity-20"/>:sd==='asc'?<ChevronUp className="w-2.5 h-2.5 ml-0.5"/>:<ChevronDown className="w-2.5 h-2.5 ml-0.5"/>;
  const TH=({k,l,r}:{k:SortKey;l:string;r?:boolean})=>(
    <th className={cn("p-3 text-[10px] uppercase tracking-wider text-zinc-400 font-bold cursor-pointer hover:text-zinc-900 whitespace-nowrap select-none",r&&"text-right")} onClick={()=>sort(k)}>
      <span className={cn("flex items-center",r&&"justify-end")}>{l}<SI k={k}/></span>
    </th>
  );
  const totalDr=filtered.reduce((a,t)=>a+t.dr,0);
  const totalCr=filtered.reduce((a,t)=>a+t.cr,0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-xl font-black">Ledger</h2><p className="text-sm text-zinc-400">{ledger.length} entries</p></div>
        <div className="flex gap-2">
          <button onClick={onExport} className="flex items-center gap-1 px-3 py-2 border border-zinc-200 text-[10px] font-bold hover:bg-zinc-100 rounded-lg text-zinc-500"><Download className="w-3 h-3"/>CSV</button>
          <button onClick={onAdd} className="flex items-center gap-1 px-4 py-2 bg-zinc-900 text-white text-[10px] font-bold rounded-lg hover:bg-zinc-700"><Plus className="w-3 h-3"/>Add Entry</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center bg-white border border-zinc-200 px-2.5 py-1.5 rounded-lg focus-within:ring-1 focus-within:ring-zinc-900">
          <Search className="w-3.5 h-3.5 text-zinc-400"/>
          <input type="text" placeholder="Search…" className="bg-transparent border-none focus:outline-none text-xs ml-2 w-36" value={search} onChange={e=>setSearch(e.target.value)}/>
          {search&&<button onClick={()=>setSearch('')} className="text-zinc-300 hover:text-zinc-700 text-xs">✕</button>}
        </div>
        <div className="flex gap-1 flex-wrap">
          {[null,...persons].map(p=><button key={p??'all'} onClick={()=>setPerson(p)} className={cn("px-3 py-1 text-[9px] font-bold border rounded-full",person===p?"bg-zinc-900 text-white":"bg-white text-zinc-400 border-zinc-200")}>{p??'All'}</button>)}
        </div>
        <div className="flex gap-1 flex-wrap">
          {[null,...types].map(t=><button key={t??'all'} onClick={()=>setType(t)} className={cn("px-3 py-1 text-[9px] font-bold border rounded-full",type===t?"bg-zinc-900 text-white":"bg-white text-zinc-400 border-zinc-200")}>{t??'All'}</button>)}
        </div>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-auto">
        <table className="w-full text-left border-collapse" style={{minWidth:960}}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <TH k="date" l="Date"/><TH k="person" l="Person"/><TH k="type" l="Type"/><TH k="mainCategory" l="Category"/>
              <th className="p-3 text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Description</th>
              <th className="p-3 text-[10px] uppercase tracking-wider text-zinc-400 font-bold text-center">Bank</th>
              <TH k="dr" l="Debit" r/><TH k="cr" l="Credit" r/>
              <th className="p-3 text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Nature</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {filtered.map(t=><TransactionRow key={t.id} transaction={t}/>)}
            </AnimatePresence>
            {filtered.length===0&&<tr><td colSpan={9} className="p-12 text-center text-zinc-400 text-xs italic">No matching records</td></tr>}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-900 text-white font-mono text-xs">
              <td className="p-3 font-bold" colSpan={5}>{filtered.length} entries</td><td className="p-3"/>
              <td className="p-3 text-right text-rose-400 font-bold">{formatCurrency(totalDr)}</td>
              <td className="p-3 text-right text-emerald-400 font-bold">{formatCurrency(totalCr)}</td>
              <td className="p-3 text-right text-zinc-400 text-[9px]">NET {formatCurrency(totalCr-totalDr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Investments Section — with LIVE market prices
// ─────────────────────────────────────────────────────────────
interface MarketPrices {
  stocks: Record<string, number>;
  gold: { perGram: number; perTola: number };
  source: string;
  timestamp: string;
}

function parseStockQty(desc: string): { qty: number; avgPrice: number } {
  const m = desc.match(/\((\d+)\s*@\s*([\d.]+)\)/);
  if (m) return { qty: parseInt(m[1]), avgPrice: parseFloat(m[2]) };
  return { qty: 0, avgPrice: 0 };
}

function InvestmentsSection({ ledger }: { ledger:Transaction[] }) {
  const [prices, setPrices] = useState<MarketPrices|null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const geminiKey = localStorage.getItem('gemini_api_key') || '';

  const fetchPrices = useCallback(async () => {
    setLoadingPrices(true);
    try {
      const d = await fetch('/api/market/prices', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ apiKey: geminiKey })
      }).then(r=>r.json());
      setPrices(d);
    } catch { console.error('Price fetch failed'); }
    finally { setLoadingPrices(false); }
  }, [geminiKey]);

  useEffect(() => { fetchPrices(); }, []);

  // Parse portfolio from ledger
  const portfolio = useMemo(() => {
    const stockMap: Record<string, { totalCost: number; totalQty: number; items: string[] }> = {};
    let goldCost = 0, goldVault = 0, fd = 0;
    let goldTolasBought = 0;
    // Count vault tolas
    let vaultTolas = 0;

    ledger.forEach(t => {
      if ((t.type === 'Investment' || t.mainCategory === 'Investments') && t.subCategory === 'Stocks' && t.dr > 0) {
        const d = t.description.toLowerCase();
        const name = d.includes('irctc') ? 'IRCTC' :
          d.includes('rvnl') || d.includes('rail vikas') ? 'RVNL' :
          d.includes('suzlon') ? 'Suzlon' :
          d.includes('silver etf') || d.includes('icici pru silver') ? 'Silver ETF' :
          d.includes('tatsilv') ? 'TATSILV' :
          d.includes('meesho') ? 'Meesho' :
          d.includes('bank of baroda') || d.includes('bob') ? 'Bank of Baroda' :
          t.description.slice(0, 18);
        if (!stockMap[name]) stockMap[name] = { totalCost: 0, totalQty: 0, items: [] };
        const { qty } = parseStockQty(t.description);
        stockMap[name].totalCost += t.dr;
        stockMap[name].totalQty += qty;
        stockMap[name].items.push(t.description);
      }
      if (t.subCategory === 'Gold' && t.dr > 0) {
        goldCost += t.dr;
        // parse tola: "Buy Gold 1 Tola" → 1
        const tm = t.description.match(/(\d+)\s*tola/i);
        if (tm) goldTolasBought += parseInt(tm[1]);
      }
      if (t.bank === 'Family Vault' && t.cr > 0) {
        goldVault += t.cr;
        const tm2 = t.description.match(/\((\d+\.?\d*)\s*tola\)/i);
        const gm = t.description.match(/\((\d+\.?\d*)\s*g\)/i);
        if (tm2) vaultTolas += parseFloat(tm2[1]);
        else if (gm) vaultTolas += parseFloat(gm[1]) / 11.664;
      }
      if (t.bank?.includes('BOI') && t.cr > 0) fd = Math.max(fd, t.cr);
    });

    const stocks = Object.entries(stockMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalCost - a.totalCost);

    return { stocks, goldCost, goldVault, goldTolasBought, vaultTolas, fd };
  }, [ledger]);

  const { stocks, goldCost, goldVault, goldTolasBought, vaultTolas, fd } = portfolio;

  // Calculate current values with live prices
  const stocksWithPL = stocks.map(st => {
    const livePrice = prices?.stocks?.[st.name] || 0;
    const currentVal = st.totalQty > 0 && livePrice > 0 ? st.totalQty * livePrice : 0;
    const pl = currentVal > 0 ? currentVal - st.totalCost : 0;
    const plPct = st.totalCost > 0 && currentVal > 0 ? ((currentVal - st.totalCost) / st.totalCost) * 100 : 0;
    return { ...st, livePrice, currentVal, pl, plPct };
  });

  const goldLiveTola = prices?.gold?.perTola || 0;
  const goldLiveNewVal = goldTolasBought > 0 && goldLiveTola > 0 ? goldTolasBought * goldLiveTola : 0;
  const goldLiveVaultVal = vaultTolas > 0 && goldLiveTola > 0 ? vaultTolas * goldLiveTola : 0;

  const stockCostTotal = stocks.reduce((s, x) => s + x.totalCost, 0);
  const stockCurrentTotal = stocksWithPL.reduce((s, x) => s + (x.currentVal || x.totalCost), 0);
  const totalCost = stockCostTotal + goldCost + goldVault + fd;
  const totalCurrent = stockCurrentTotal + (goldLiveNewVal || goldCost) + (goldLiveVaultVal || goldVault) + fd;
  const totalPL = totalCurrent - totalCost;
  const hasPrices = prices && (Object.keys(prices.stocks).length > 0 || prices.gold.perTola > 0);

  const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black">Investments</h2>
          <p className="text-sm text-zinc-400">
            Stocks · Gold · Fixed Deposits
            {prices && <span className="ml-2 text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-bold">📡 Live via {prices.source}</span>}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={fetchPrices} disabled={loadingPrices}
            className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 disabled:opacity-40">
            <RefreshCcw className={cn("w-3 h-3", loadingPrices && "animate-spin")} />
            {loadingPrices ? 'Fetching…' : 'Refresh Prices'}
          </button>
          <div className="text-right">
            <span className="text-[10px] text-zinc-400 block font-bold uppercase">
              {hasPrices ? 'Current Value' : 'Cost Basis'}
            </span>
            <span className="text-2xl font-black font-mono text-blue-600">
              {formatCurrency(hasPrices ? totalCurrent : totalCost)}
            </span>
            {hasPrices && totalPL !== 0 && (
              <span className={cn("block text-xs font-bold font-mono", totalPL >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                {totalPL >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(totalPL))} ({((totalPL / totalCost) * 100).toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stock Portfolio Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Stock Portfolio</h3>
          <span className="text-[10px] font-mono font-bold text-blue-600">Cost: {formatCurrency(stockCostTotal)} {hasPrices && `→ Current: ${formatCurrency(stockCurrentTotal)}`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{minWidth: 700}}>
            <thead>
              <tr className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                <th className="px-5 py-2.5">Stock</th>
                <th className="px-3 py-2.5 text-center">Qty</th>
                <th className="px-3 py-2.5 text-right">Avg Price</th>
                <th className="px-3 py-2.5 text-right">Cost</th>
                {hasPrices && <th className="px-3 py-2.5 text-right">Live Price</th>}
                {hasPrices && <th className="px-3 py-2.5 text-right">Current</th>}
                {hasPrices && <th className="px-3 py-2.5 text-right">P&L</th>}
                <th className="px-3 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {stocksWithPL.map((st, i) => {
                const avgPrice = st.totalQty > 0 ? st.totalCost / st.totalQty : 0;
                const pctOfPortfolio = stockCostTotal > 0 ? (st.totalCost / stockCostTotal) * 100 : 0;
                return (
                  <tr key={st.name} className="border-t border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: COLORS[i % COLORS.length]}} />
                        <div>
                          <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">{st.name}</span>
                          <span className="text-[9px] text-zinc-400 ml-2">{pctOfPortfolio.toFixed(0)}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-mono font-bold text-zinc-600">{st.totalQty || '-'}</td>
                    <td className="px-3 py-3 text-right text-xs font-mono text-zinc-500">₹{avgPrice > 0 ? avgPrice.toFixed(2) : '-'}</td>
                    <td className="px-3 py-3 text-right text-xs font-mono font-bold text-zinc-900">{formatCurrency(st.totalCost)}</td>
                    {hasPrices && (
                      <td className="px-3 py-3 text-right text-xs font-mono font-bold text-blue-600">
                        {st.livePrice > 0 ? `₹${st.livePrice.toFixed(2)}` : <span className="text-zinc-300">—</span>}
                      </td>
                    )}
                    {hasPrices && (
                      <td className="px-3 py-3 text-right text-xs font-mono font-bold">
                        {st.currentVal > 0 ? formatCurrency(st.currentVal) : <span className="text-zinc-300">—</span>}
                      </td>
                    )}
                    {hasPrices && (
                      <td className="px-3 py-3 text-right">
                        {st.currentVal > 0 ? (
                          <div className={cn("text-xs font-bold font-mono", st.pl >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                            <span>{st.pl >= 0 ? '+' : ''}{formatCurrency(st.pl)}</span>
                            <span className="text-[9px] ml-1 opacity-70">({st.plPct >= 0 ? '+' : ''}{st.plPct.toFixed(1)}%)</span>
                          </div>
                        ) : <span className="text-zinc-300 text-xs">—</span>}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden w-full">
                        <div className="h-full rounded-full" style={{width:`${pctOfPortfolio}%`, backgroundColor: COLORS[i % COLORS.length]}} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gold & FD Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gold */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gem className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Gold Holdings</h3>
            </div>
            {goldLiveTola > 0 && (
              <span className="text-[9px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-bold">
                Live: ₹{goldLiveTola.toLocaleString('en-IN')}/tola
              </span>
            )}
          </div>

          {/* Newly purchased gold */}
          {goldCost > 0 && (
            <div className="flex items-center justify-between py-3 border-b border-zinc-100">
              <div>
                <span className="text-xs font-bold text-zinc-700">Newly Purchased</span>
                <span className="text-[9px] text-zinc-400 ml-2">{goldTolasBought} Tola</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-zinc-400 line-through">{formatCurrency(goldCost)}</div>
                {goldLiveNewVal > 0 ? (
                  <div>
                    <span className="text-sm font-black font-mono text-amber-600">{formatCurrency(goldLiveNewVal)}</span>
                    <span className={cn("text-[9px] font-bold ml-1", goldLiveNewVal >= goldCost ? 'text-emerald-600' : 'text-rose-500')}>
                      {goldLiveNewVal >= goldCost ? '▲' : '▼'}{formatCurrency(Math.abs(goldLiveNewVal - goldCost))}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-black font-mono text-amber-600">{formatCurrency(goldCost)}</span>
                )}
              </div>
            </div>
          )}

          {/* Vault gold */}
          {goldVault > 0 && (
            <div className="flex items-center justify-between py-3 border-b border-zinc-100">
              <div>
                <span className="text-xs font-bold text-zinc-700">Family Vault</span>
                <span className="text-[9px] text-zinc-400 ml-2">~{vaultTolas.toFixed(1)} Tola (15 items)</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-zinc-400">Legacy: {formatCurrency(goldVault)}</div>
                {goldLiveVaultVal > 0 ? (
                  <div>
                    <span className="text-sm font-black font-mono text-amber-500">{formatCurrency(goldLiveVaultVal)}</span>
                    <span className={cn("text-[9px] font-bold ml-1", goldLiveVaultVal >= goldVault ? 'text-emerald-600' : 'text-rose-500')}>
                      {goldLiveVaultVal >= goldVault ? '▲' : '▼'}{formatCurrency(Math.abs(goldLiveVaultVal - goldVault))}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-black font-mono text-amber-500">{formatCurrency(goldVault)}</span>
                )}
              </div>
            </div>
          )}

          {/* Total gold */}
          <div className="flex justify-between items-center pt-3">
            <span className="text-xs font-black text-zinc-900 uppercase">Total Gold</span>
            <span className="text-lg font-black font-mono text-amber-600">
              {formatCurrency((goldLiveNewVal || goldCost) + (goldLiveVaultVal || goldVault))}
            </span>
          </div>
        </div>

        {/* Fixed Deposit */}
        {fd > 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Landmark className="w-4 h-4 text-purple-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Fixed Deposit</h3>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-zinc-100">
              <div>
                <span className="text-xs font-bold text-zinc-700">BOI FD (Suyash)</span>
                <span className="text-[9px] text-zinc-400 ml-2">Bank of India</span>
              </div>
              <span className="text-lg font-black font-mono text-purple-600">{formatCurrency(fd)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 text-[10px] text-zinc-400">
              <span>Interest rate: ~6.5% p.a.</span>
              <span className="font-mono">Maturity value: {formatCurrency(fd * 1.065)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subscriptions Section
// ─────────────────────────────────────────────────────────────
function SubscriptionsSection({ ledger }: { ledger:Transaction[] }) {
  const now = new Date();
  const MONTH_MAP: Record<string,number> = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

  const subs = useMemo(()=>{
    const latest: Record<string,Transaction> = {};
    ledger.filter(t=>t.type==='Fixed'&&t.dr>0).forEach(t=>{
      const key=`${t.subCategory}__${t.bank}`;
      const prev=latest[key];
      if (!prev) { latest[key]=t; return; }
      const pd=prev.date.split('-'); const nd=t.date.split('-');
      if (pd.length>=3&&nd.length>=3) {
        const pv=parseInt('20'+pd[2])*10000+(MONTH_MAP[pd[1]]||0)*100+parseInt(pd[0]);
        const nv=parseInt('20'+nd[2])*10000+(MONTH_MAP[nd[1]]||0)*100+parseInt(nd[0]);
        if (nv>pv) latest[key]=t;
      }
    });
    return Object.values(latest).map(t=>{
      const p=t.date.split('-');
      const start=p.length>=3?new Date(2000+parseInt(p[2]),(MONTH_MAP[p[1]]??0),parseInt(p[0])):now;
      const d=t.description.toLowerCase();
      const dur=d.match(/(\d+)\s*day/)?.[1]?parseInt(d.match(/(\d+)\s*day/)![1]):d.match(/(\d+)\s*mo/)?.[1]?parseInt(d.match(/(\d+)\s*mo/)![1])*30:d.includes('year')?365:30;
      const exp=new Date(start); exp.setDate(exp.getDate()+dur);
      const daysLeft=Math.ceil((exp.getTime()-now.getTime())/86400000);
      const status: 'expired'|'critical'|'warning'|'active' = daysLeft<0?'expired':daysLeft<=7?'critical':daysLeft<=30?'warning':'active';
      return { ...t, daysLeft, exp, status, dur };
    }).sort((a,b)=>a.daysLeft-b.daysLeft);
  },[ledger]);

  const alerts = subs.filter(s=>s.status!=='active');
  const colors = {expired:'bg-rose-50 border-rose-200',critical:'bg-red-50 border-red-200',warning:'bg-amber-50 border-amber-200',active:'bg-white border-zinc-200'};
  const badges = {expired:'bg-rose-500 text-white',critical:'bg-red-500 text-white',warning:'bg-amber-500 text-white',active:'bg-emerald-100 text-emerald-700'};
  const labels = {expired:'EXPIRED',critical:'EXPIRES SOON',warning:'DUE THIS MONTH',active:'ACTIVE'};

  return (
    <div>
      <div className="mb-5"><h2 className="text-xl font-black">Subscriptions & Bills</h2><p className="text-sm text-zinc-400">Recurring payments · Expiry tracking</p></div>
      {alerts.length>0&&(
        <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-4">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5"/>
          <div>
            <p className="text-xs font-black text-rose-700 mb-1">{alerts.length} subscription{alerts.length>1?'s':''} need attention</p>
            <p className="text-xs text-rose-500">{alerts.map(a=>`${a.description}${a.status==='expired'?' (EXPIRED)':`(${a.daysLeft}d left)`}`).join(' · ')}</p>
          </div>
        </div>
      )}
      {subs.length===0&&<div className="border-2 border-dashed border-zinc-200 rounded-xl p-12 text-center"><div className="text-4xl mb-3">🔔</div><p className="text-sm font-bold text-zinc-500">No recurring bills found</p><p className="text-xs text-zinc-400 mt-1">Fixed-type transactions will appear here</p></div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {subs.map((s,i)=>(
          <div key={i} className={cn("border rounded-xl p-4",colors[s.status])}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0"><span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">{s.subCategory}</span><p className="text-xs font-bold text-zinc-900 truncate">{s.description}</p></div>
              <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap",badges[s.status])}>{labels[s.status]}</span>
            </div>
            <div className="flex justify-between text-[9px] text-zinc-400 border-t border-black/5 pt-2 mt-2">
              <span className="font-mono">{s.date}</span>
              <span className="font-bold flex items-center gap-1"><Clock className="w-2.5 h-2.5"/>{s.status==='expired'?`${Math.abs(s.daysLeft)}d ago`:s.exp.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})}</span>
            </div>
            <div className="flex justify-between items-center mt-1"><span className="text-[9px] text-zinc-400">{s.bank}</span><span className="text-xs font-black font-mono text-zinc-700">₹{s.dr.toLocaleString('en-IN')}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}


