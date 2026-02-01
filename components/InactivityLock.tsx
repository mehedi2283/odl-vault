import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabase';
import { Lock, AlertCircle, ArrowRight, LogOut, Fingerprint, Loader2 } from 'lucide-react';

interface InactivityLockProps {
  userEmail: string;
  userName?: string;
  onLogout: () => void;
  timeoutMinutes?: number;
}

const STORAGE_KEYS = {
  LOCKED: 'odl_is_locked',
  LAST_ACTIVE: 'odl_last_active'
};

const InactivityLock: React.FC<InactivityLockProps> = ({ userEmail, userName, onLogout, timeoutMinutes = 600 }) => {
  // Initialize state based on persistent storage
  const [isLocked, setIsLocked] = useState(() => {
    const storedLock = localStorage.getItem(STORAGE_KEYS.LOCKED);
    if (storedLock === 'true') return true;
    
    const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
    if (lastActive) {
        const elapsed = Date.now() - parseInt(lastActive, 10);
        if (elapsed > timeoutMinutes * 60 * 1000) return true;
    }
    return false;
  });

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  
  // Events to listen for activity
  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

  const lockSession = useCallback(() => {
    setIsLocked(true);
    localStorage.setItem(STORAGE_KEYS.LOCKED, 'true');
  }, []);

  const resetTimer = useCallback(() => {
    if (isLocked) return;
    
    const now = Date.now();
    // Throttle writes to localStorage (1s) to avoid performance issues on mousemove
    if (now - lastActivityRef.current > 1000) {
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
        lastActivityRef.current = now;
    }
    
    if (timerRef.current) {
        clearTimeout(timerRef.current);
    }
    
    timerRef.current = setTimeout(() => {
        lockSession();
    }, timeoutMinutes * 60 * 1000);
  }, [isLocked, timeoutMinutes, lockSession]);

  // --- Manual Lock Listeners (Hotkey & Event) ---
  useEffect(() => {
    const handleManualLock = () => lockSession();
    
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ctrl + Shift + L (or Cmd + Shift + L)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'l')) {
            e.preventDefault();
            lockSession();
        }
    };

    window.addEventListener('trigger-manual-lock', handleManualLock);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('trigger-manual-lock', handleManualLock);
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lockSession]);

  useEffect(() => {
    // Initial setup
    if (!localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE)) {
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString());
    }

    resetTimer();

    // Attach listeners
    const handleActivity = () => resetTimer();
    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]); 

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: password
        });
        
        if (error) throw error;
        
        // Success - Unlock and Clean Storage
        setIsLocked(false);
        setPassword('');
        localStorage.removeItem(STORAGE_KEYS.LOCKED);
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString());
    } catch (err) {
        setError('Invalid credentials');
    } finally {
        setIsLoading(false);
    }
  };

  if (!isLocked) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-[#050505]/98 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-fade-in text-antialiased">
       {/* Card Container */}
       <div className="w-full max-w-md bg-white rounded-[32px] p-8 md:p-10 shadow-2xl text-center relative overflow-hidden animate-fade-in-up border border-white/10 ring-1 ring-black/5">
          
          {/* Top Gradient Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-900 via-indigo-900 to-gray-900"></div>
          
          {/* Lock Icon Circle */}
          <div className="mx-auto w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-gray-100/50">
             <Lock className="w-8 h-8 text-gray-900" strokeWidth={1.5} />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Vault Locked</h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            Identity verification required to resume session.
          </p>
          
          <form onSubmit={handleUnlock} className="space-y-5">
             {/* Identity Box */}
             <div className="text-left bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4 hover:border-gray-200 transition-colors">
                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 text-gray-700">
                    <Fingerprint className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Operative</label>
                    <div className="text-gray-900 font-bold text-sm truncate">{userName || userEmail.split('@')[0]}</div>
                    {userName && userName !== userEmail && <div className="text-xs text-gray-400 truncate font-medium">{userEmail}</div>}
                </div>
             </div>
             
             {/* Password Input */}
             <div className="relative group">
                 <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all text-center tracking-[0.5em] font-bold text-lg placeholder-gray-300 shadow-sm group-hover:border-gray-300"
                    placeholder="••••••"
                    autoFocus
                 />
             </div>

             {error && (
                <div className="flex items-center justify-center text-sm text-rose-600 bg-rose-50 py-3 rounded-xl border border-rose-100 animate-fade-in font-medium">
                    <AlertCircle className="w-4 h-4 mr-2"/> 
                    {error}
                </div>
             )}
             
             <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-4 bg-gray-900 hover:bg-black text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
             >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Unlock <ArrowRight className="w-4 h-4 ml-1" /></>}
             </button>
          </form>

          <button 
            onClick={onLogout}
            className="mt-8 text-xs font-semibold text-gray-400 hover:text-rose-600 flex items-center justify-center gap-2 mx-auto transition-colors group px-4 py-2 rounded-lg hover:bg-rose-50"
          >
            <LogOut className="w-3.5 h-3.5" /> 
            Terminate Session
          </button>
       </div>
    </div>,
    document.body
  );
};

export default InactivityLock;