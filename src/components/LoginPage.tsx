import { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn, Shield, TrendingUp, Gem } from 'lucide-react';

const VALID_USER = 'suyashrs365';
const VALID_PASS = '123456789';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    if (username.trim() === VALID_USER && password === VALID_PASS) {
      localStorage.setItem('wm_auth', '1');
      onLogin();
    } else {
      setError('Invalid username or password.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl mb-4 shadow-xl">
            <TrendingUp className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Wealth Manager</h1>
          <p className="text-zinc-500 text-sm mt-1">Family · AI · Live</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-emerald-500 to-amber-500" />
          <div className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Private Access</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoFocus
                  autoComplete="username"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-rose-400 text-xs font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-rose-400 rounded-full inline-block" />{error}
                </motion.p>
              )}

              <button type="submit" disabled={loading || !username || !password}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-black rounded-xl transition-all mt-2">
                {loading ? (
                  <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>Signing in…</>
                ) : (
                  <><LogIn className="w-4 h-4" />Sign In</>
                )}
              </button>
            </form>
          </div>

          <div className="px-8 py-4 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-center gap-2">
            <Gem className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Family Wealth Command Center</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
