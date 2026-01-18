import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[10001] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md ${
            type === 'success' 
              ? 'bg-emerald-50/95 text-emerald-800 border-emerald-100 shadow-emerald-500/10' 
              : 'bg-rose-50/95 text-rose-800 border-rose-100 shadow-rose-500/10'
          }`}
        >
          {type === 'success' ? <CheckCircle2 size={20} className="text-emerald-500" strokeWidth={2.5} /> : <AlertCircle size={20} className="text-rose-500" strokeWidth={2.5} />}
          <p className="text-sm font-semibold tracking-tight">{message}</p>
          <button onClick={onClose} className="ml-2 text-current opacity-40 hover:opacity-100 p-1 rounded-md hover:bg-black/5 transition-all">
            <X size={14} />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default Toast;