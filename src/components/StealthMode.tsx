import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EyeOff } from 'lucide-react';

const StealthMode: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on Shift + S
      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        setIsActive(prev => !prev);
      }
      // Exit on Escape if active
      if (isActive && e.key === 'Escape') {
        setIsActive(false);
      }
    };

    // Listen for custom event from Command Palette
    const handleCustomEvent = () => setIsActive(true);
    window.addEventListener('trigger-stealth-mode', handleCustomEvent);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('trigger-stealth-mode', handleCustomEvent);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  // Fake progress bar logic
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setProgress(prev => (prev >= 99 ? 99 : prev + (Math.random() * 0.5)));
    }, 2000);
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-black text-white font-sans cursor-none flex flex-col items-center justify-center select-none"
          onDoubleClick={() => setIsActive(false)}
        >
          <div className="w-64 space-y-6 text-center">
             <div className="w-12 h-12 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin mx-auto opacity-80"></div>
             
             <div className="space-y-2">
               <h2 className="text-xl font-light">Working on updates</h2>
               <p className="text-sm text-gray-400">{Math.floor(progress)}% complete</p>
               <p className="text-xs text-gray-500 mt-4">Don't turn off your computer</p>
             </div>
          </div>

          <div className="absolute bottom-8 text-center opacity-30 text-[10px] text-gray-600">
             <p>Your PC will restart several times.</p>
          </div>
          
          {/* Secret Exit Hint */}
          <div className="absolute top-4 right-4 opacity-0 hover:opacity-10 transition-opacity">
             <EyeOff size={24} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StealthMode;