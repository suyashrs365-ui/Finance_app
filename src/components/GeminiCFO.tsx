import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Sparkles, Loader2, Key, CheckCircle } from 'lucide-react';
import { Transaction } from '../data';
import { formatCurrency } from '../lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface GeminiCFOProps {
  transactions: Transaction[];
}

const QUICK_PROMPTS = [
  "What is my net worth?",
  "Am I over budget?",
  "Where am I overspending?",
  "Summarise investments",
  "Savings advice",
];

function buildContext(transactions: Transaction[]): string {
  const totalCr = transactions.reduce((s, t) => s + t.cr, 0);
  const totalDr = transactions.reduce((s, t) => t.type !== 'Transfer' ? s + t.dr : s, 0);
  const income   = transactions.filter(t => t.type === 'Income').reduce((s,t) => s + t.cr, 0);
  const fixed    = transactions.filter(t => t.type === 'Fixed').reduce((s,t) => s + t.dr, 0);
  const variable = transactions.filter(t => t.type === 'Variable').reduce((s,t) => s + t.dr, 0);
  const invest   = transactions.filter(t => t.type === 'Investment').reduce((s,t) => s + t.dr, 0);

  const catMap: Record<string, number> = {};
  transactions.filter(t => t.dr > 0 && t.type !== 'Transfer')
    .forEach(t => { catMap[t.mainCategory] = (catMap[t.mainCategory] || 0) + t.dr; });
  const topCats = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([k,v]) => `${k}: ₹${v.toLocaleString('en-IN')}`).join(', ');

  return `FAMILY LEDGER:
Net Worth: ${formatCurrency(totalCr - totalDr)} | Income: ${formatCurrency(income)}
Fixed: ${formatCurrency(fixed)} | Variable: ${formatCurrency(variable)} | Invested: ${formatCurrency(invest)}
Target: ₹23,000/mo | Top: ${topCats}
${transactions.length} entries | Family: Suyash, Rohini, Mummy`;
}

export function GeminiCFO({ transactions }: GeminiCFOProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    id: '0', role: 'assistant',
    content: "Namaste! 🙏 I'm your AI CFO powered by Gemini. Ask me about your finances — net worth, budget status, savings tips, or anything about your ledger."
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [history, setHistory] = useState<{role:string;content:string}[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowKeyInput(false);
  };

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Check key
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const newHistory = [...history, { role: 'user', content: text }];

    try {
      const context = buildContext(transactions);
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context, history: history.slice(-6), apiKey })
      });
      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, {
          id: (Date.now()+1).toString(), role: 'assistant',
          content: `⚠️ ${data.error}\n\nCheck your API key or try again.`
        }]);
        if (data.error.includes('API key')) setShowKeyInput(true);
      } else {
        const reply = data.reply || 'No response.';
        setMessages(prev => [...prev, {
          id: (Date.now()+1).toString(), role: 'assistant', content: reply
        }]);
        setHistory([...newHistory, { role: 'assistant', content: reply }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now()+1).toString(), role: 'assistant',
        content: '❌ Network error. Check your connection and try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const keyIsSet = !!apiKey;

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3.5 bg-zinc-900 text-white shadow-2xl text-xs font-bold rounded-full"
        style={{ display: isOpen ? 'none' : undefined }}
      >
        <Sparkles className="w-4 h-4 text-amber-400" />
        AI CFO
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] bg-white border border-zinc-200 shadow-2xl flex flex-col rounded-lg overflow-hidden"
            style={{ height: 500, maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold">Gemini AI CFO</span>
                {keyIsSet && <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500 text-white font-bold rounded-full">Connected</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowKeyInput(v => !v)} title="API Key settings"
                  className="text-zinc-400 hover:text-white transition-colors">
                  <Key className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* API key setup */}
            <AnimatePresence>
              {showKeyInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="overflow-hidden shrink-0"
                >
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                    <p className="text-[10px] font-bold text-amber-700 mb-2">
                      🔑 Paste your Gemini API key — get one free from <a href="https://aistudio.google.com/app/apikey" target="_blank" className="underline">aistudio.google.com</a>
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="flex-1 text-xs border border-amber-200 px-2 py-1.5 rounded focus:outline-none focus:border-amber-500 font-mono bg-white"
                      />
                      <button
                        onClick={() => saveKey(apiKey)}
                        disabled={!apiKey.trim()}
                        className="px-3 py-1.5 bg-amber-600 text-white text-[10px] font-bold rounded disabled:opacity-40 hover:bg-amber-700"
                      >
                        Save
                      </button>
                    </div>
                    {keyIsSet && (
                      <p className="text-[9px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Key saved (stored in browser only)
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* No key prompt */}
            {!keyIsSet && !showKeyInput && (
              <div className="px-4 py-4 bg-zinc-50 border-b border-zinc-100 shrink-0 text-center">
                <p className="text-xs text-zinc-600 mb-2">Add your Gemini API key to start chatting</p>
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="px-4 py-2 bg-zinc-900 text-white text-[10px] font-bold rounded hover:bg-zinc-700"
                >
                  🔑 Add API Key
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] text-xs leading-relaxed px-3 py-2.5 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-zinc-900 text-white rounded-br-sm'
                      : 'bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm'
                  }`} style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-zinc-200 px-3 py-2.5 rounded-lg flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                    <span className="text-xs text-zinc-400">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-3 py-2 border-t border-zinc-100 flex gap-1.5 overflow-x-auto shrink-0">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => send(p)}
                  className="whitespace-nowrap text-[10px] font-bold px-2.5 py-1 border border-zinc-200 text-zinc-500 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all shrink-0 rounded-full"
                >{p}</button>
              ))}
            </div>

            {/* Input */}
            <div className="flex border-t border-zinc-200 shrink-0">
              <input
                type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send(input)}
                placeholder={keyIsSet ? "Ask anything…" : "Add API key first"}
                className="flex-1 px-4 py-3 text-xs focus:outline-none bg-white rounded-bl-lg"
                disabled={isLoading || !keyIsSet}
              />
              <button onClick={() => send(input)} disabled={!input.trim() || isLoading || !keyIsSet}
                className="px-4 bg-zinc-900 text-white disabled:opacity-30 hover:bg-zinc-700 transition-colors rounded-br-lg">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
