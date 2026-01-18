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
      // using e.code for better reliability across layouts
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
    <div className="fixed inset-0 z-[10000] bg-black cursor-none flex items-center justify-center">
      <div className="text-zinc-900 flex flex-col items-center gap-2 select-none">
         <EyeOff size={48} />
         <span className="font-bold text-xl uppercase tracking-widest">Stealth Active</span>
         <span className="text-sm">Press ESC to disengage</span>
      </div>
    </div>
  );
};

export default StealthMode;