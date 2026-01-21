import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X, Crown, ShieldCheck, Shield, User, Info, AtSign } from 'lucide-react';

export type ToastRole = 'grand_admin' | 'master_admin' | 'admin' | 'user' | 'system' | undefined;

interface ToastProps {
  id?: string;
  title?: string; // Used for Sender Name
  message: string;
  type?: 'success' | 'error' | 'info' | 'mention';
  role?: string; // Pass the user role string here
  onClose: () => void;
  inline?: boolean; // If true, renders without Portal/Fixed positioning (for stacks)
}

const Toast: React.FC<ToastProps> = ({ id, title, message, type = 'success', role, onClose, inline = false }) => {
  // Use a ref to keep the latest onClose callback without restarting the timer
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const duration = type === 'mention' ? 8000 : 5000; // Mentions stay longer
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, duration);
    return () => clearTimeout(timer);
  }, [type]);

  // --- Configuration based on Role or Type ---
  const getConfig = () => {
    // 1. Error State
    if (type === 'error') {
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-100',
        text: 'text-rose-900',
        iconColor: 'text-rose-500',
        shadow: 'shadow-rose-500/10',
        Icon: AlertCircle,
        label: 'System Alert'
      };
    }

    // 2. Mention State (High Priority)
    if (type === 'mention') {
      return {
        bg: 'bg-indigo-900',
        border: 'border-indigo-700',
        text: 'text-white',
        iconColor: 'text-cyan-400',
        shadow: 'shadow-indigo-900/50',
        Icon: AtSign,
        label: 'You were mentioned'
      };
    }

    // 3. Role-based States
    switch (role) {
      case 'grand_admin':
        return {
          bg: 'bg-gradient-to-r from-amber-50 to-orange-50',
          border: 'border-amber-200',
          text: 'text-amber-900',
          iconColor: 'text-amber-600',
          shadow: 'shadow-amber-500/20',
          Icon: Crown,
          label: 'Grand Administrator'
        };
      case 'master_admin':
        return {
          bg: 'bg-gradient-to-r from-blue-50 to-indigo-50',
          border: 'border-blue-200',
          text: 'text-blue-900',
          iconColor: 'text-blue-600',
          shadow: 'shadow-blue-500/20',
          Icon: ShieldCheck,
          label: 'Master Administrator'
        };
      case 'admin':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          text: 'text-purple-900',
          iconColor: 'text-purple-600',
          shadow: 'shadow-purple-500/10',
          Icon: Shield,
          label: 'Administrator'
        };
      case 'user':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-900',
          iconColor: 'text-emerald-600',
          shadow: 'shadow-emerald-500/10',
          Icon: User,
          label: 'Operative'
        };
      default:
        // Default Success/Info
        return {
          bg: 'bg-white',
          border: 'border-gray-200',
          text: 'text-gray-800',
          iconColor: 'text-gray-500',
          shadow: 'shadow-gray-200/50',
          Icon: Info,
          label: 'Notification'
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.Icon;

  const content = (
    <motion.div
      layout // Enables smooth layout transitions when siblings change
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`pointer-events-auto w-full max-w-sm rounded-2xl border shadow-xl backdrop-blur-md overflow-hidden ${config.bg} ${config.border} ${config.shadow}`}
    >
      <div className="p-4 flex items-start gap-4">
        {/* Icon Box */}
        <div className={`flex-shrink-0 mt-0.5 p-2 rounded-full ${type === 'mention' ? 'bg-white/10 border-white/20' : 'bg-white/60 border-white/50'} border ${config.iconColor}`}>
           <IconComponent size={20} strokeWidth={2.5} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between mb-0.5">
            {title && (
                <h4 className={`text-sm font-bold truncate pr-2 ${config.text}`}>
                    {title}
                </h4>
            )}
            {!title && <h4 className={`text-xs font-bold uppercase tracking-wider ${config.text} opacity-70`}>{config.label}</h4>}
          </div>
          
          {/* Role Label (if title exists) */}
          {title && (
             <p className={`text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1 ${config.text}`}>
                {config.label}
             </p>
          )}

          <p className={`text-sm leading-relaxed opacity-90 font-medium ${config.text}`}>
            {message}
          </p>
        </div>

        {/* Close Button */}
        <button 
            onClick={onClose} 
            className={`flex-shrink-0 -mr-2 -mt-2 p-2 opacity-40 hover:opacity-100 transition-opacity ${config.text}`}
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Progress Bar (Visual Flair) */}
      <motion.div 
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: type === 'mention' ? 8 : 5, ease: "linear" }}
        className={`h-1 w-full opacity-20 ${config.iconColor.replace('text-', 'bg-')}`}
      />
    </motion.div>
  );

  // If inline, just return the content (parent handles container/portal)
  if (inline) {
    return content;
  }

  // Default behavior: Render in fixed portal
  return createPortal(
    <div className="fixed bottom-6 right-6 z-[10001] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {content}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default Toast;