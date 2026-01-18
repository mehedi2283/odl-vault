import React, { useState, useEffect } from 'react';
import { EyeOff } from 'lucide-react';

const StealthMode: React.FC = () => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const handleTrigger = () => setActive(true);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disengage with ESC
      if (e.key === 'Escape' && active) {
        setActive(false);
      }
      
      // Engage with Ctrl + Shift + S
      if (e.ctrlKey && e.shiftKey && (e.code === 'KeyS' || e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        setActive(true);
      }
    };

    window.addEventListener('trigger-stealth-mode', handleTrigger);
    // Attach to document for broader capture
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('trigger-stealth-mode', handleTrigger);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black cursor-none flex items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-8 select-none">
         {/* Icon Container */}
         <div className="relative">
             <div className="absolute inset-0 bg-zinc-800/20 blur-2xl rounded-full"></div>
             <div className="relative p-6 rounded-full bg-zinc-900/30 text-zinc-800 border border-zinc-900 shadow-2xl animate-pulse">
                <EyeOff size={64} strokeWidth={1} />
             </div>
         </div>
         
         {/* Text Info */}
         <div className="text-center space-y-3 z-10">
            <h1 className="text-3xl font-black text-zinc-800 uppercase tracking-[0.4em] pl-[0.4em]">Stealth Active</h1>
            <p className="text-xs font-mono text-zinc-900 uppercase tracking-widest opacity-60">Press ESC to disengage</p>
         </div>
      </div>
    </div>
  );
};

export default StealthMode;