import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, ArrowRight, AlertCircle, Loader2, 
  Eye, EyeOff, UserPlus, Shield, X, Unlock, CheckCircle2, Box
} from 'lucide-react';
import { supabase } from '../services/supabase';
import Button from '../components/Button';

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
      // Default to the owner email for easy Grand Admin access
      setRecentUsers(['babu.octopidigital@gmail.com']);
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 font-sans p-4">
        
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
        >
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center p-3 bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
                   <Box className="h-8 w-8 text-indigo-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {isSignUp ? 'New Operative' : 'ODL Vault Access'}
                </h1>
                <p className="text-sm text-gray-500 mt-2">
                    {isSignUp ? 'Establish secure identity credentials' : 'Enter your credentials to access the secure layer'}
                </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Status Banner */}
                <AnimatePresence>
                    {(error || successMessage) && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className={`px-6 py-3 text-sm font-medium flex items-center border-b ${
                                error ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}
                        >
                            {error ? <AlertCircle size={16} className="mr-2 flex-shrink-0" /> : <CheckCircle2 size={16} className="mr-2 flex-shrink-0" />}
                            {error || successMessage}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="p-8">
                    <form onSubmit={handleAuth} className="space-y-5">
                        <div className="space-y-1.5" ref={suggestionsRef}>
                            <label className="block text-sm font-medium text-gray-700 ml-1">Identity</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setShowSuggestions(true); }}
                                    onFocus={() => setShowSuggestions(true)}
                                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all sm:text-sm"
                                    placeholder="operative@agency.com"
                                    disabled={isLoading || isSuccess}
                                    autoComplete="off"
                                />
                                
                                <AnimatePresence>
                                    {showSuggestions && recentUsers.length > 0 && !isSignUp && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden"
                                        >
                                            <div className="px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Recent Identities</div>
                                            {recentUsers.filter(u => u.toLowerCase().includes(email.toLowerCase())).map(user => (
                                                <div key={user} className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 cursor-pointer group" onClick={() => selectUser(user)}>
                                                    <span className="text-sm text-gray-600 group-hover:text-indigo-700 truncate">{user}</span>
                                                    <button type="button" onClick={(e) => removeRecentUser(e, user)} className="text-gray-300 hover:text-rose-500 p-1"><X size={14} /></button>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700 ml-1">Passcode</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all sm:text-sm"
                                    placeholder="••••••••"
                                    disabled={isLoading || isSuccess}
                                />
                                <button
                                   type="button"
                                   onClick={() => setShowPassword(!showPassword)}
                                   className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                >
                                   {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                             <button 
                                type="submit"
                                disabled={isLoading || isSuccess}
                                className={`w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white transition-all shadow-md ${
                                    isSuccess 
                                      ? 'bg-emerald-500 shadow-emerald-200' 
                                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300'
                                } disabled:opacity-70 disabled:cursor-not-allowed`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-2" size={18} />
                                        Authenticating...
                                    </>
                                ) : isSuccess ? (
                                    <>
                                        <Unlock className="-ml-1 mr-2" size={18} />
                                        Access Granted
                                    </>
                                ) : (
                                    <>
                                        {isSignUp ? 'Create Credentials' : 'Secure Login'}
                                        <ArrowRight className="ml-2" size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
                
                <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
                    <button 
                        onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMessage(''); }}
                        className="text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors flex items-center justify-center mx-auto gap-1.5"
                    >
                        {isSignUp ? 'Return to Login' : 'Register New Operative'}
                        {!isSignUp && <UserPlus size={14} />}
                    </button>
                </div>
            </div>
            
            <div className="mt-8 flex justify-center items-center gap-2 text-xs text-gray-400">
                <Shield size={14} />
                <span className="font-medium">256-bit Secure Connection</span>
            </div>
        </motion.div>
    </div>
  );
};

export default LoginPage;