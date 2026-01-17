import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { Lock, AlertCircle, ArrowRight, LogOut, Fingerprint } from 'lucide-react';

interface InactivityLockProps {
  userEmail: string;
  onLogout: () => void;
  timeoutMinutes?: number;
}

const InactivityLock: React.FC<InactivityLockProps> = ({ userEmail, onLogout, timeoutMinutes = 5 }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

  const resetTimer = () => {
    if (isLocked) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
        setIsLocked(true);
    }, timeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    resetTimer();
    const handleActivity = () => resetTimer();
    events.forEach(event => document.addEventListener(event, handleActivity));

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLocked, timeoutMinutes]);

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
        
        setIsLocked(false);
        setPassword('');
        resetTimer();
    } catch (err) {
        setError('Invalid credentials');
    } finally {
        setIsLoading(false);
    }
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 animate-fade-in">
       <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          
          <div className="mx-auto w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-gray-50/50">
             <Lock className="w-8 h-8 text-gray-800" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Locked</h2>
          <p className="text-gray-500 mb-8 text-sm">Security protocols initiated due to inactivity.<br/>Verify credentials to resume operations.</p>
          
          <form onSubmit={handleUnlock} className="space-y-5">
             <div className="text-left bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                    <Fingerprint className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Identity</label>
                    <div className="text-gray-900 font-medium text-sm truncate max-w-[200px]">{userEmail}</div>
                </div>
             </div>
             
             <div className="text-left">
                 <div className="relative">
                     <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-4 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black outline-none transition-all text-center tracking-widest font-bold"
                        placeholder="••••••••"
                        autoFocus
                     />
                 </div>
                 {error && (
                    <div className="mt-3 flex items-center justify-center text-sm text-rose-500 bg-rose-50 py-2 rounded-lg">
                        <AlertCircle className="w-4 h-4 mr-1.5"/> 
                        {error}
                    </div>
                 )}
             </div>
             
             <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-3.5 bg-black hover:bg-gray-800 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
             >
                {isLoading ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div> : <>Unlock System <ArrowRight className="w-4 h-4" /></>}
             </button>
          </form>

          <button 
            onClick={onLogout}
            className="mt-6 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 mx-auto transition-colors"
          >
            <LogOut className="w-3 h-3" /> Terminate Session
          </button>
       </div>
    </div>
  );
};

export default InactivityLock;