import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const toastContent = (
    <div className="fixed bottom-6 right-6 z-[200] animate-fade-in-up">
      <div className={`flex items-center p-4 rounded-xl shadow-lg border backdrop-blur-sm ${
        type === 'success' 
          ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' 
          : 'bg-rose-50/95 border-rose-200 text-rose-800'
      }`}>
        {type === 'success' ? (
          <CheckCircle2 className="h-5 w-5 mr-3 text-emerald-500 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 mr-3 text-rose-500 flex-shrink-0" />
        )}
        <p className="text-sm font-medium mr-8">{message}</p>
        <button 
          onClick={onClose} 
          className={`p-1 rounded-full transition-colors ${
            type === 'success' ? 'hover:bg-emerald-100 text-emerald-600' : 'hover:bg-rose-100 text-rose-600'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
};

export default Toast;