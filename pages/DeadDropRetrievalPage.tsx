import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, ShieldAlert, Eye, Lock, Loader2, AlertTriangle, FileWarning, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';

const DeadDropRetrievalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<'locked' | 'decrypting' | 'revealed' | 'burned' | 'error'>('locked');
  const [content, setContent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleDecrypt = async () => {
    if (!id) return;
    setStatus('decrypting');

    try {
      // 1. Fetch the drop
      const { data, error } = await supabase
        .from('dead_drops')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
          throw new Error("Payload not found. It may have already been incinerated.");
      }

      // 2. Reveal Content
      setContent(data.content);
      setStatus('revealed');

      // 3. Burn if required
      if (data.burn_after_read) {
          await supabase.from('dead_drops').delete().eq('id', id);
          // We keep the state as 'revealed' for the user to read, 
          // but show a notification that it's gone from the server.
      }

    } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || "Connection failed.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-orange-500/30">
      
      {/* Ambient Background */}
      <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-900/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg">
          
          <div className="text-center mb-8">
              <div className="inline-flex p-4 rounded-full bg-zinc-900 border border-zinc-800 shadow-2xl mb-6 relative group">
                  <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full group-hover:bg-orange-500/30 transition-colors"></div>
                  <Flame className="w-10 h-10 text-orange-500 relative z-10" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Secure Dead Drop</h1>
              <p className="text-zinc-500 text-sm font-mono">ODL ENCRYPTED TRANSMISSION PROTOCOL</p>
          </div>

          <AnimatePresence mode="wait">
              {status === 'locked' && (
                  <motion.div 
                    key="locked"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-3xl p-8 shadow-2xl text-center"
                  >
                      <Lock className="w-12 h-12 text-zinc-600 mx-auto mb-6" />
                      <h2 className="text-xl font-semibold text-white mb-3">Payload Secured</h2>
                      <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                          You have received a secure transmission. 
                          <br/>Verifying identity is not required.
                      </p>
                      
                      <div className="bg-orange-950/30 border border-orange-900/50 rounded-xl p-4 mb-8 flex items-start text-left gap-3">
                          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-orange-200/80">
                              <strong className="text-orange-400 block mb-1">Warning: Single Access</strong>
                              If configured, this message will be permanently deleted from the server immediately upon viewing. Do not refresh.
                          </p>
                      </div>

                      <button 
                        onClick={handleDecrypt}
                        className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 group"
                      >
                          <Eye className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          Decrypt Payload
                      </button>
                  </motion.div>
              )}

              {status === 'decrypting' && (
                  <motion.div 
                    key="decrypting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-20"
                  >
                      <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-4" />
                      <p className="text-orange-500 font-mono text-sm animate-pulse">DECRYPTING PACKETS...</p>
                  </motion.div>
              )}

              {status === 'revealed' && (
                  <motion.div 
                    key="revealed"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
                  >
                      <div className="bg-zinc-800/50 px-6 py-3 border-b border-zinc-700/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Decrypted Successfully</span>
                          </div>
                          <button onClick={() => navigator.clipboard.writeText(content || "")} className="text-xs text-zinc-500 hover:text-white transition-colors">Copy Text</button>
                      </div>
                      
                      <div className="p-8 bg-black/20">
                          <div className="font-mono text-sm text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
                              {content}
                          </div>
                      </div>

                      <div className="bg-zinc-900 p-4 border-t border-zinc-800">
                          <div className="flex items-center justify-center gap-2 text-xs text-orange-500/60 font-mono">
                              <Flame className="w-3 h-3" />
                              <span>SERVER TRACES REMOVED</span>
                          </div>
                      </div>
                  </motion.div>
              )}

              {status === 'error' && (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-center"
                  >
                      <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                          <FileWarning className="w-8 h-8 text-zinc-600" />
                      </div>
                      <h2 className="text-xl font-semibold text-white mb-2">Payload Unavailable</h2>
                      <p className="text-zinc-500 text-sm mb-6">{errorMessage}</p>
                      <a href="/" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">Return to Secure Vault</a>
                  </motion.div>
              )}
          </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center">
          <p className="text-[10px] text-zinc-700 font-bold tracking-widest uppercase">Secured by ODL Vault</p>
      </div>
    </div>
  );
};

export default DeadDropRetrievalPage;