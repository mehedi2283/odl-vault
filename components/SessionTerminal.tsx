import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Minus, X, ChevronUp, ChevronDown, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'success' | 'system';
  message: string;
}

const SessionTerminal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      type,
      message
    };
    setLogs(prev => [...prev.slice(-49), entry]); // Keep last 50
  };

  // Event Listener for global logs & Toggle
  useEffect(() => {
    const handleLogEvent = (e: CustomEvent) => {
      addLog(e.detail.message, e.detail.type);
    };

    const handleToggleEvent = () => {
        setIsOpen(prev => !prev);
    };

    window.addEventListener('odl-log' as any, handleLogEvent as any);
    window.addEventListener('odl-terminal-toggle', handleToggleEvent);
    
    // Initial System Check
    addLog("ODL_SECURE_KERNEL_INIT...", "system");
    setTimeout(() => addLog("ENCRYPTION_LAYER: ACTIVE (AES-256)", "success"), 500);
    setTimeout(() => addLog("SESSION_MONITOR: ENGAGED", "info"), 800);

    return () => {
      window.removeEventListener('odl-log' as any, handleLogEvent as any);
      window.removeEventListener('odl-terminal-toggle', handleToggleEvent);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && !isMinimized && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isMinimized, isOpen]);

  // Hotkey toggle (Alt + T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.altKey && (e.key === 't' || e.key === 'T')) {
            setIsOpen(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ y: 200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 200, opacity: 0 }}
      className={`fixed bottom-4 left-4 z-[9999] w-full max-w-lg bg-black/90 backdrop-blur-md border border-green-900/50 rounded-lg shadow-2xl font-mono text-xs overflow-hidden flex flex-col transition-all duration-300 ${isMinimized ? 'h-10' : 'h-64'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-green-900/20 border-b border-green-900/30 select-none">
        <div className="flex items-center gap-2 text-green-500">
          <Terminal size={14} />
          <span className="font-bold tracking-wider">SESSION_LOG.sh</span>
        </div>
        <div className="flex items-center gap-2">
           <Activity size={12} className="text-green-500 animate-pulse" />
           <div className="flex items-center gap-1 ml-2">
             <button onClick={() => setIsMinimized(!isMinimized)} className="text-green-700 hover:text-green-400">
               {isMinimized ? <ChevronUp size={14} /> : <Minus size={14} />}
             </button>
             <button onClick={() => setIsOpen(false)} className="text-green-700 hover:text-green-400">
               <X size={14} />
             </button>
           </div>
        </div>
      </div>

      {/* Terminal Body */}
      {!isMinimized && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
           {logs.map((log) => (
             <div key={log.id} className="flex gap-3 font-mono leading-tight hover:bg-white/5 p-0.5 rounded">
                <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
                <span className={`shrink-0 font-bold uppercase w-16 ${
                    log.type === 'error' ? 'text-red-500' : 
                    log.type === 'warn' ? 'text-yellow-500' : 
                    log.type === 'success' ? 'text-emerald-400' : 
                    log.type === 'system' ? 'text-blue-400' : 'text-green-600'
                }`}>
                    {log.type}
                </span>
                <span className={`break-all ${log.type === 'system' ? 'text-gray-300' : 'text-green-100'}`}>
                    {log.message}
                </span>
             </div>
           ))}
           <div className="h-4 flex items-center gap-2 animate-pulse mt-2">
             <span className="text-green-500 font-bold">{'>'}</span>
             <span className="w-2 h-4 bg-green-500 block"></span>
           </div>
        </div>
      )}
    </motion.div>
  );
};

export default SessionTerminal;