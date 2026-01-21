import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Scrollable Container */}
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            
            {/* Fixed Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Modal Card */}
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ 
                duration: 0.2,
                layout: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 } 
              }}
              className="relative w-full max-w-lg transform rounded-2xl bg-white text-left shadow-2xl border border-gray-100 overflow-visible my-8"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                <motion.h3 layout="position" className="text-lg font-bold text-gray-900 tracking-tight">{title}</motion.h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-200/50"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                {children}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;