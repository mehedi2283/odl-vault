import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  ArrowRight, 
  ScanLine, 
  AlertCircle, 
  Loader2, 
  Fingerprint, 
  Eye, 
  EyeOff,
  UserPlus,
  Clock,
  X,
  Shield,
  Key,
  Unlock
} from 'lucide-react';
import { supabase } from '../services/supabase';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // New state for unlock animation
  
  // Custom Suggestions State
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentUsers, setRecentUsers] = useState<string[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Mouse movement effect state
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const location = useLocation();

  useEffect(() => {
    // Handle mouse movement for background parallax effect
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20, 
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const storedIntent = localStorage.getItem('jackryan_auth_intent');
    if (storedIntent === 'signup' || location.state?.mode === 'signup') {
      setIsSignUp(true);
      if (storedIntent) localStorage.removeItem('jackryan_auth_intent');
    }

    // Load recent users from local storage
    const storedUsers = localStorage.getItem('jackryan_recent_users');
    if (storedUsers) {
      setRecentUsers(JSON.parse(storedUsers));
    } else {
      // Default demo suggestion if no history
      setRecentUsers(['admin@access.portal']);
    }
  }, [location]);

  // Close suggestions when clicking outside
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
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        if (data.user) {
          setSuccessMessage('Credentials created. Please log in.');
          setIsSignUp(false);
          setPassword('');
          saveRecentUser(email);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        
        // Login Successful
        setIsSuccess(true);
        saveRecentUser(email);
        
        // Small delay to let the unlock animation play before App.tsx redirects
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      // Shake animation trigger via error state
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
    if (updatedUsers.length === 0) setShowSuggestions(false);
  };

  const selectUser = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setShowSuggestions(false);
    // Focus password field if available
    document.getElementById('password')?.focus();
  };

  const filteredSuggestions = recentUsers.filter(u => 
    u.toLowerCase().includes(email.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f0f0f0] relative overflow-hidden font-sans selection:bg-black selection:text-white px-6">
        
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>

        {/* Floating Orb */}
        <motion.div 
            animate={{ x: mousePosition.x * -2, y: mousePosition.y * -2 }}
            transition={{ type: 'spring', damping: 50, stiffness: 400 }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-gray-200 to-transparent rounded-full blur-3xl opacity-60 pointer-events-none"
        />

        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[400px] relative z-10 flex flex-col items-center"
        >

            {/* Circular Portal Icon */}
            <div className="relative mb-12 group">
                {/* Rotating Ring */}
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className={`absolute inset-[-12px] border border-dashed rounded-full transition-colors duration-500 ${isSuccess ? 'border-emerald-300' : error ? 'border-rose-300' : 'border-gray-300'}`}
                />
                
                {/* Active Ring */}
                <motion.div 
                    animate={{ rotate: isLoading || isFocused ? 360 : 0, scale: isLoading ? 1.1 : 1 }}
                    transition={{ duration: isLoading ? 1 : 0.5, ease: isLoading ? "linear" : "backOut", repeat: isLoading ? Infinity : 0 }}
                    className={`absolute inset-[-4px] border-2 border-t-black border-r-transparent border-b-black border-l-transparent rounded-full ${isLoading || isFocused || isSuccess ? 'opacity-100' : 'opacity-0'} transition-all duration-500 ${isSuccess ? '!border-t-emerald-500 !border-b-emerald-500' : ''}`}
                />

                {/* Main Circle */}
                <div className="w-24 h-24 bg-white rounded-full shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] flex items-center justify-center relative z-10 overflow-hidden">
                    <AnimatePresence mode="wait">
                         {isSuccess ? (
                             <motion.div 
                                key="unlocked"
                                initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                             >
                                 <Unlock className="text-emerald-500" size={32} strokeWidth={1.5} />
                             </motion.div>
                         ) : isLoading ? (
                             <motion.div 
                                key="scanning"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                             >
                                 <ScanLine className="text-black animate-pulse" size={32} strokeWidth={1.5} />
                             </motion.div>
                         ) : (
                             <motion.div 
                                key="locked"
                                className="relative flex items-center justify-center"
                                animate={error ? { x: [-5, 5, -5, 5, 0] } : { x: 0 }}
                                transition={{ duration: 0.4 }}
                             >
                                <Lock 
                                  className={`transition-colors duration-300 ${error ? 'text-rose-500' : 'text-black'}`} 
                                  size={32} 
                                  strokeWidth={1.5} 
                                />
                                
                                {/* Key Animation - Horizontal below lock */}
                                {password.length > 0 && !error && (
                                  <motion.div
                                    initial={{ y: 25, opacity: 0, x: '-50%', rotate: -45 }}
                                    animate={{ y: 14, opacity: 1, x: '-50%', rotate: -45 }}
                                    exit={{ y: 25, opacity: 0, x: '-50%' }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    className="absolute left-1/2 top-1/2"
                                  >
                                    <Key size={16} className="text-indigo-500 fill-indigo-100" />
                                  </motion.div>
                                )}
                             </motion.div>
                         )}
                    </AnimatePresence>
                </div>

                {/* Status Dot */}
                <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#f0f0f0] z-20 transition-colors duration-500 ${isSuccess ? 'bg-emerald-500' : error ? 'bg-rose-500' : isLoading ? 'bg-blue-500' : 'bg-emerald-500'}`} />
            </div>

            <div className="text-center mb-10">
                <h1 className="text-2xl font-medium text-gray-900 tracking-tight">
                    {isSignUp ? 'New Identity' : 'System Access'}
                </h1>
                <p className="text-xs text-gray-400 mt-2 uppercase tracking-[0.2em] font-medium">
                    {isSignUp ? 'Registration Protocol' : 'Verify Credentials'}
                </p>
            </div>

            {/* Form Card */}
            <div className="w-full bg-white/60 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white">
                <AnimatePresence mode="wait">
                    {(error || successMessage) && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                            className={`flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg ${error ? 'text-rose-500 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}
                        >
                            {error ? <AlertCircle size={14} /> : <Fingerprint size={14} />}
                            {error || successMessage}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleAuth} className="space-y-4 relative" autoComplete="off">
                    <div className="space-y-1 relative" ref={suggestionsRef}>
                        <input 
                            type="text" 
                            name="email"
                            id="email"
                            autoComplete="off"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onFocus={() => {
                                setIsFocused(true);
                                setShowSuggestions(true);
                            }}
                            onBlur={() => {
                                setIsFocused(false);
                                // Delay hide to allow click event
                                setTimeout(() => {
                                    if (!document.activeElement?.closest('#suggestions-dropdown')) {
                                        // check if click was inside suggestions
                                    }
                                    // Let the click handler on document close it, or close if blur moves away
                                }, 200);
                            }}
                            className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-transparent focus:border-gray-200 rounded-xl px-4 py-4 text-center text-gray-900 placeholder-gray-400 outline-none transition-all duration-300 font-medium text-sm"
                            placeholder="admin@access.portal"
                            disabled={isLoading || isSuccess}
                            required
                        />

                        {/* Custom Suggestions Dropdown */}
                        <AnimatePresence>
                            {showSuggestions && filteredSuggestions.length > 0 && !isSignUp && (
                                <motion.div 
                                    id="suggestions-dropdown"
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 text-left"
                                >
                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50 flex items-center justify-between">
                                        <span>Recent Identities</span>
                                        <Shield size={10} />
                                    </div>
                                    <ul className="max-h-48 overflow-y-auto">
                                        {filteredSuggestions.map((userEmail) => (
                                            <li key={userEmail}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); selectUser(userEmail); }}
                                                    className="w-full px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Clock size={14} className="text-gray-300 group-hover:text-indigo-400" />
                                                        <span className="truncate max-w-[180px]">{userEmail}</span>
                                                    </div>
                                                    <div 
                                                        onMouseDown={(e) => { e.preventDefault(); removeRecentUser(e, userEmail); }}
                                                        className="p-1 hover:bg-rose-100 hover:text-rose-600 rounded-full text-gray-300 transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="space-y-1 relative group">
                        <input 
                            type={showPassword ? "text" : "password"}
                            name="password"
                            id="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-transparent focus:border-gray-200 rounded-xl px-4 py-4 text-center text-gray-900 placeholder-gray-400 outline-none transition-all duration-300 font-medium tracking-widest text-sm"
                            placeholder="••••••••"
                            disabled={isLoading || isSuccess}
                            required
                        />
                         <button
                           type="button"
                           onClick={() => setShowPassword(!showPassword)}
                           className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors focus:outline-none"
                        >
                           {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading || isSuccess}
                        className={`group relative w-full h-14 text-white rounded-xl overflow-hidden shadow-lg shadow-gray-200/50 hover:shadow-gray-300 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2 ${isSuccess ? 'bg-emerald-600' : 'bg-black'}`}
                    >
                         {/* White Fill Effect on Hover */}
                        <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.86,0,0.07,1)]" />
                        
                        {/* Content Container */}
                        <div className="relative z-10 flex items-center justify-center h-full">
                            {isLoading ? (
                                <div className="flex items-center gap-2 text-gray-400">
                                     <Loader2 size={18} className="animate-spin" />
                                     <span className="text-sm font-medium">Processing...</span>
                                </div>
                            ) : isSuccess ? (
                                <div className="flex items-center gap-2 text-white">
                                     <Unlock size={18} />
                                     <span className="text-sm font-medium">Access Granted</span>
                                </div>
                            ) : (
                                <div className="relative overflow-hidden h-5 flex flex-col justify-start text-sm font-medium w-full">
                                     {/* Original Text */}
                                     <span className="absolute inset-0 flex items-center justify-center gap-2 group-hover:-translate-y-[150%] transition-transform duration-500 ease-[cubic-bezier(0.86,0,0.07,1)]">
                                        {isSignUp ? 'Generate Credentials' : 'Unlock Dashboard'} <ArrowRight size={16} />
                                     </span>
                                     
                                     {/* Hover Text (Black) */}
                                     <span className="absolute inset-0 flex items-center justify-center gap-2 text-black translate-y-[150%] group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.86,0,0.07,1)]">
                                        {isSignUp ? 'Create Identity' : 'Access System'} <ScanLine size={16} />
                                     </span>
                                </div>
                            )}
                        </div>
                    </button>
                </form>

                 <div className="mt-6 text-center">
                    <button 
                        onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMessage(''); }}
                        className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
                    >
                        {isSignUp ? (
                            'Back to Login'
                        ) : (
                            <>
                                <UserPlus size={12} />
                                Register New User
                            </>
                        )}
                    </button>
                 </div>
            </div>
            
            <div className="mt-8 flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-widest opacity-50">
                <Fingerprint size={12} />
                <span>Biometric Secured</span>
            </div>

        </motion.div>
    </div>
  );
};

export default LoginPage;