import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, ArrowRight, ScanLine, AlertCircle, Loader2, Fingerprint, 
  Eye, EyeOff, UserPlus, Shield, X, Unlock, ChevronRight 
} from 'lucide-react';
import { supabase } from '../../services/supabase';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentUsers, setRecentUsers] = useState<string[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const location = useLocation();

  useEffect(() => {
    const storedIntent = localStorage.getItem('jackryan_auth_intent');
    if (storedIntent === 'signup' || location.state?.mode === 'signup') {
      setIsSignUp(true);
      if (storedIntent) localStorage.removeItem('jackryan_auth_intent');
    }

    const storedUsers = localStorage.getItem('jackryan_recent_users');
    if (storedUsers) {
      setRecentUsers(JSON.parse(storedUsers));
    } else {
      setRecentUsers(['admin@access.portal']);
    }
  }, [location]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);
    setIsSuccess(false);
    setShowSuggestions(false);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.user) {
          setSuccessMessage('Clearance granted. Please log in.');
          setIsSignUp(false);
          setPassword('');
          saveRecentUser(email);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        setIsSuccess(true);
        saveRecentUser(email);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    } catch (err: any) {
      setError(err.message || 'Authentication Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const saveRecentUser = (newEmail: string) => {
    const updatedUsers = [...new Set([newEmail, ...recentUsers])].slice(0, 5);
    setRecentUsers(updatedUsers);
    localStorage.setItem('jackryan_recent_users', JSON.stringify(updatedUsers));
  };

  const removeRecentUser = (e: React.MouseEvent, userToRemove: string) => {
    e.stopPropagation();
    const updatedUsers = recentUsers.filter(u => u !== userToRemove);
    setRecentUsers(updatedUsers);
    localStorage.setItem('jackryan_recent_users', JSON.stringify(updatedUsers));
  };

  const selectUser = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setShowSuggestions(false);
    document.getElementById('password')?.focus();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
        
        {/* Background Grid */}
        <div className="absolute inset-0 pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', 
               backgroundSize: '32px 32px' 
             }}>
        </div>
        
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[380px] relative z-10 flex flex-col items-center"
        >
            {/* Header Icon */}
            <div className="mb-8 relative">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border shadow-[0_0_40px_-10px_rgba(79,70,229,0.3)] transition-all duration-500 ${isSuccess ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-zinc-900 border-zinc-800 text-indigo-500'}`}>
                    <AnimatePresence mode="wait">
                         {isSuccess ? (
                             <motion.div key="success" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                                <Unlock size={32} />
                             </motion.div>
                         ) : (
                             <motion.div key="lock" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                                <Lock size={32} />
                             </motion.div>
                         )}
                    </AnimatePresence>
                </div>
                {/* Status Indicator */}
                <div className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shadow-sm ${isSuccess ? 'bg-emerald-500 border-emerald-400 text-white' : error ? 'bg-rose-500 border-rose-400 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                    {isSuccess ? 'Granted' : error ? 'Error' : 'Locked'}
                </div>
            </div>

            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white tracking-tight mb-2">ODL Vault</h1>
                <p className="text-sm text-zinc-500 font-medium">Restricted Access Portal</p>
            </div>

            {/* Login Card */}
            <div className="w-full bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-zinc-800/50 ring-1 ring-white/5">
                {/* Error/Success Banner */}
                <AnimatePresence>
                    {(error || successMessage) && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
                            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                            className={`overflow-hidden rounded-lg border px-3 py-2 flex items-center gap-2 text-xs font-medium ${error ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}
                        >
                            {error ? <AlertCircle size={14} /> : <Shield size={14} />}
                            {error || successMessage}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleAuth} className="space-y-4" autoComplete="off">
                    <div className="space-y-1.5" ref={suggestionsRef}>
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Identity</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <ScanLine className="h-4 w-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                            </div>
                            <input 
                                type="text" 
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setShowSuggestions(true); }}
                                onFocus={() => setShowSuggestions(true)}
                                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-zinc-600"
                                placeholder="operative@odl.vault"
                                disabled={isLoading || isSuccess}
                                autoComplete="off"
                            />
                            
                            {/* Suggestions Dropdown */}
                            <AnimatePresence>
                                {showSuggestions && recentUsers.length > 0 && !isSignUp && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 overflow-hidden"
                                    >
                                        <div className="px-3 py-1.5 bg-zinc-800/50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">Recent Logins</div>
                                        {recentUsers.filter(u => u.toLowerCase().includes(email.toLowerCase())).map(user => (
                                            <div key={user} className="flex items-center justify-between px-3 py-2 hover:bg-zinc-800 cursor-pointer group/item" onClick={() => selectUser(user)}>
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold group-hover/item:text-indigo-400 transition-colors">
                                                        {user.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm text-zinc-300 truncate">{user}</span>
                                                </div>
                                                <button onClick={(e) => removeRecentUser(e, user)} className="text-zinc-600 hover:text-rose-500 transition-colors p-1"><X size={12} /></button>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Passcode</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-4 w-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                            </div>
                            <input 
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm rounded-xl py-3 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-zinc-600 tracking-widest font-mono"
                                placeholder="••••••••"
                                disabled={isLoading || isSuccess}
                            />
                            <button
                               type="button"
                               onClick={() => setShowPassword(!showPassword)}
                               className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                               {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading || isSuccess}
                        className={`w-full relative h-12 mt-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden ${isSuccess ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'}`}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                <span>Verifying...</span>
                            </>
                        ) : isSuccess ? (
                            <>
                                <Unlock size={16} />
                                <span>Access Granted</span>
                            </>
                        ) : (
                            <>
                                <span>{isSignUp ? 'Initialize Protocol' : 'Authenticate'}</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>
            </div>

            <div className="mt-6">
                <button 
                    onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMessage(''); }}
                    className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    {isSignUp ? 'Back to Login' : 'Register New Operative'}
                    {!isSignUp && <UserPlus size={14} />}
                </button>
            </div>

            <div className="mt-auto pt-8 flex items-center gap-2 text-[10px] font-bold text-zinc-700 uppercase tracking-widest opacity-60">
                <Fingerprint size={12} />
                <span>Biometric Secured</span>
            </div>

        </motion.div>
    </div>
  );
};

export default LoginPage;