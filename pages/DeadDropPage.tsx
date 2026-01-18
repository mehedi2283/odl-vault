import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Send, Lock, Shield, CheckCircle2, Zap, Copy, Link as LinkIcon, AlertTriangle, ArrowRight } from 'lucide-react';
import Button from '../components/Button';
import { supabase } from '../services/supabase';

const DeadDropPage: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isBurnEnabled, setIsBurnEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setGeneratedLink(null);

    try {
      // Insert into Supabase
      const { data, error } = await supabase
        .from('dead_drops')
        .insert({
            content: message,
            burn_after_read: isBurnEnabled
        })
        .select('id')
        .single();

      if (error) throw error;

      if (data) {
          // Construct the link based on current window location (HashRouter compatible)
          const baseUrl = window.location.href.split('#')[0];
          const link = `${baseUrl}#/pickup/${data.id}`;
          
          setGeneratedLink(link);
          setMessage('');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('dead_drops')) {
          setError("System Error: 'dead_drops' table missing. Run SQL Setup in Users Page.");
      } else {
          setError("Encryption failed. Connection unstable.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = () => {
      if (generatedLink) {
          navigator.clipboard.writeText(generatedLink);
      }
  };

  const resetForm = () => {
      setGeneratedLink(null);
      setMessage('');
      setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 px-4">
      {/* Header with Pulsing Fire Animation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
             <motion.div
               animate={{
                 scale: [1, 1.1, 1, 1.05, 1],
                 filter: [
                   'drop-shadow(0 0 0px rgba(234, 88, 12, 0))',
                   'drop-shadow(0 0 10px rgba(234, 88, 12, 0.5))',
                   'drop-shadow(0 0 5px rgba(234, 88, 12, 0.3))',
                   'drop-shadow(0 0 15px rgba(234, 88, 12, 0.6))',
                   'drop-shadow(0 0 0px rgba(234, 88, 12, 0))'
                 ]
               }}
               transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
             >
                <Flame className="h-9 w-9 text-orange-600 fill-orange-500/20" />
             </motion.div>
             <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">Dead Drop</span>
          </h1>
          <p className="mt-1 text-gray-500">Generate secure, one-time access links for external extraction.</p>
        </div>
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden sm:flex items-center space-x-2 text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 shadow-sm"
        >
           <Zap className="h-3.5 w-3.5 fill-orange-400" />
           <span>Anonymous & Trace-free</span>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Input Area */}
        <div className="lg:col-span-2 relative group">
            {/* Animated Gradient Glow Border */}
            <motion.div
                className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-2xl opacity-30 blur-sm group-hover:opacity-60 transition duration-1000"
                animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "linear"
                }}
                style={{ backgroundSize: '200% 200%' }}
            />

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative z-10">
                {/* Top decorative line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500"></div>
                
                <div className="p-6">
                    <AnimatePresence mode="wait">
                        {generatedLink ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="text-center py-8 space-y-6"
                            >
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
                                    <LinkIcon className="h-8 w-8 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900">Secure Link Generated</h3>
                                    <p className="text-gray-500 mt-2 max-w-sm mx-auto">
                                        This link grants access to the payload. 
                                        {isBurnEnabled ? ' It will be incinerated immediately after viewing.' : ' It will persist until manually purged.'}
                                    </p>
                                </div>
                                
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center gap-3 max-w-lg mx-auto">
                                    <div className="flex-1 bg-white border border-gray-200 p-3 rounded-lg text-sm text-gray-600 font-mono truncate select-all">
                                        {generatedLink}
                                    </div>
                                    <Button onClick={copyLink} className="flex-shrink-0">
                                        <Copy className="w-4 h-4 mr-2" /> Copy
                                    </Button>
                                </div>

                                <div className="pt-4">
                                    <button 
                                        onClick={resetForm}
                                        className="text-sm font-semibold text-gray-500 hover:text-orange-600 flex items-center justify-center mx-auto transition-colors"
                                    >
                                        <Zap className="w-4 h-4 mr-1" /> Generate New Drop
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.form 
                                key="form"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onSubmit={handleSubmit}
                            >
                                <div className="mb-5 flex items-center justify-between">
                                    <label className="block text-sm font-bold text-gray-800 uppercase tracking-wide">Payload Content</label>
                                    <div className="flex items-center space-x-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                        <span className={`text-[10px] uppercase font-bold tracking-wider transition-colors ${isBurnEnabled ? 'text-red-600' : 'text-gray-400'}`}>
                                            {isBurnEnabled ? 'Incinerate on Read' : 'Persistence Mode'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setIsBurnEnabled(!isBurnEnabled)}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${isBurnEnabled ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gray-200'}`}
                                        >
                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${isBurnEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} style={{ transform: isBurnEnabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                                        </button>
                                    </div>
                                </div>

                                <div className="relative">
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={8}
                                        className="block w-full rounded-xl border-gray-200 bg-gray-50/50 p-4 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-orange-500 sm:text-sm font-mono transition-all resize-none shadow-inner focus:bg-white focus:shadow-md"
                                        placeholder="Enter classified intelligence here..."
                                        spellCheck={false}
                                    />
                                    <div className="absolute bottom-3 right-3 transition-opacity duration-300" style={{ opacity: message ? 1 : 0.5 }}>
                                        <Lock className="h-4 w-4 text-gray-400" />
                                    </div>
                                </div>

                                {error && (
                                    <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center text-xs text-rose-700 font-medium">
                                        <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                                        {error}
                                    </div>
                                )}

                                <div className="mt-6 flex items-center justify-between">
                                    <div className="text-[10px] text-gray-400 flex items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        <Shield className="h-3 w-3 mr-1.5 text-gray-500" />
                                        AES-256 GENERATION
                                    </div>
                                    <Button 
                                        type="submit" 
                                        disabled={isSubmitting || !message.trim()}
                                        className={`relative overflow-hidden group transition-all duration-300 ${
                                            'bg-gray-900 hover:bg-black border-transparent hover:shadow-[0_0_20px_rgba(234,88,12,0.5)]'
                                        }`}
                                    >
                                        {/* Animated Background Gradient for Button */}
                                        <motion.div 
                                            className="absolute inset-0 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                            style={{ backgroundSize: '200% 200%' }}
                                        />
                                        
                                        <span className="relative flex items-center">
                                            {isSubmitting ? (
                                                <>Encrypting...</>
                                            ) : (
                                                <><LinkIcon className="h-4 w-4 mr-2 group-hover:rotate-45 transition-transform" /> Create Public Link</>
                                            )}
                                        </span>
                                    </Button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
            <motion.div 
                className="bg-zinc-900 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden group"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
                <motion.div 
                    className="absolute -top-20 -right-20 w-48 h-48 bg-orange-600/30 rounded-full blur-[60px]"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity }}
                />
                
                <div className="relative z-10">
                    <h3 className="font-bold text-lg mb-2 flex items-center text-orange-100">
                        <Zap className="h-5 w-5 mr-2 text-orange-500 fill-orange-500" />
                        Public Retrieval
                    </h3>
                    <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                        Generated links are publicly accessible to anyone with the URL. 
                        Login is NOT required to view the drop.
                    </p>
                    <ul className="space-y-3 text-sm text-zinc-300">
                        <li className="flex items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-3 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                            <span>One-time View</span>
                        </li>
                        <li className="flex items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-3 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                            <span>Instant DB Deletion</span>
                        </li>
                    </ul>
                </div>
            </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DeadDropPage;