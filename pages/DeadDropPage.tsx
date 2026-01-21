import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { 
  Flame, Copy, Link as LinkIcon, AlertTriangle, 
  Terminal, ShieldCheck, Lock, ArrowRight, RefreshCw,
  Files as FilesIcon
} from 'lucide-react';
import Button from '../components/Button';
import { supabase } from '../services/supabase';
import { ToastContextType } from '../types';

// --- CRYPTO UTILS ---
const generateKey = async () => {
  return window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

const encryptPayload = async (payload: object, key: CryptoKey) => {
  const jsonString = JSON.stringify(payload);
  const encoded = new TextEncoder().encode(jsonString);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoded
  );
  
  // Export components
  const exportedKey = await window.crypto.subtle.exportKey("raw", key);
  
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
    keyString: btoa(String.fromCharCode(...new Uint8Array(exportedKey)))
  };
};

const DeadDropPage: React.FC = () => {
  const { showToast } = useOutletContext<ToastContextType>();
  const [message, setMessage] = useState('');
  const [isBurnEnabled, setIsBurnEnabled] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
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
      // 1. Client-Side Encryption
      const payload = {
          content: message,
          options: {
              allowCopy: allowCopy
          }
      };

      const key = await generateKey();
      const { ciphertext, iv, keyString } = await encryptPayload(payload, key);

      // 2. Insert into Supabase
      let dropId: string | null = null;

      try {
        const { data, error: dbError } = await supabase
          .from('dead_drops')
          .insert({
              encrypted_content: ciphertext,
              iv: iv,
              burn_after_read: isBurnEnabled
          })
          .select('id')
          .single();

        if (dbError) throw dbError;
        dropId = data.id;
      } catch (insertError: any) {
         // Fallback for older schemas
         if (insertError.message?.includes('burn_after_read') || insertError.code === 'PGRST204') {
             const { data, error: fallbackError } = await supabase
              .from('dead_drops')
              .insert({ encrypted_content: ciphertext, iv: iv })
              .select('id')
              .single();
            if (fallbackError) throw fallbackError;
            dropId = data.id;
         } else {
             throw insertError;
         }
      }

      if (dropId) {
          const baseUrl = window.location.href.split('#')[0];
          const link = `${baseUrl}#/pickup/${dropId}#${keyString}`;
          
          setGeneratedLink(link);
          setMessage('');
          showToast("Payload secured. Link generated.", "success");
      }

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('dead_drops')) {
          setError("System Error: 'dead_drops' table missing. Run SQL setup.");
      } else {
          setError(`Encryption Protocol Failed: ${err.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = () => {
      if (generatedLink) {
          navigator.clipboard.writeText(generatedLink);
          showToast("Secure link copied to clipboard", "success");
      }
  };

  const resetForm = () => {
      setGeneratedLink(null);
      setMessage('');
      setError(null);
      setAllowCopy(true);
      setIsBurnEnabled(true);
  };

  return (
    <div className="min-h-[calc(100vh-100px)] flex flex-col items-center justify-center p-4 relative font-sans">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-white to-transparent"></div>
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.4 }}></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        
        {/* Header Section */}
        <div className="text-center mb-10">
           <motion.div 
             initial={{ y: -20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-[10px] font-bold tracking-widest text-indigo-600 uppercase mb-5"
           >
              <ShieldCheck className="w-3 h-3" />
              <span>Zero-Knowledge Architecture</span>
           </motion.div>
           <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-3">
             Dead Drop Protocol
           </h1>
           <p className="text-gray-500 text-sm md:text-base max-w-md mx-auto leading-relaxed">
             Securely transmit sensitive data. Client-side encryption ensures the server never sees the key.
           </p>
        </div>

        {/* Main Card */}
        <motion.div 
            initial={{ y: 10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="bg-white rounded-3xl shadow-2xl shadow-indigo-500/10 border border-gray-100 overflow-hidden relative"
        >
           
           {/* Top Accent Line */}
           <div className={`h-1.5 w-full transition-colors duration-500 ${generatedLink ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}></div>

           <AnimatePresence mode="wait">
              {generatedLink ? (
                 <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-8 md:p-12 text-center"
                 >
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-sm ring-8 ring-emerald-50/50">
                       <LinkIcon className="h-8 w-8 text-emerald-600" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Transmission Secured</h3>
                    <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
                       This link contains the decryption key in the hash. 
                       It is the <strong className="text-gray-900">only key</strong> to access the data.
                    </p>

                    <div className="relative group mb-8">
                       <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl opacity-20 blur group-hover:opacity-40 transition-opacity duration-500"></div>
                       <div className="relative flex items-center bg-white border border-gray-200 rounded-xl p-2 shadow-sm">
                          <div className="flex-1 px-4 py-3 overflow-hidden bg-gray-50/50 rounded-lg mr-2 border border-gray-100">
                             <p className="text-xs font-mono text-gray-600 truncate text-left select-all">
                                {generatedLink}
                             </p>
                          </div>
                          <button 
                             onClick={copyLink}
                             className="bg-gray-900 hover:bg-black text-white px-4 py-3 rounded-lg transition-all hover:shadow-lg hover:shadow-gray-900/20 flex items-center gap-2 font-bold text-xs uppercase tracking-wide active:scale-95"
                          >
                             <Copy className="h-4 w-4" />
                             <span className="hidden sm:inline">Copy</span>
                          </button>
                       </div>
                    </div>

                    <button 
                       onClick={resetForm}
                       className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-2 mx-auto py-3 px-6 rounded-xl hover:bg-indigo-50"
                    >
                       <RefreshCw className="w-3.5 h-3.5" /> Initialize New Drop
                    </button>
                 </motion.div>
              ) : (
                 <motion.form 
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    className="p-6 md:p-10"
                 >
                    <div className="relative mb-8">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Payload Content</label>
                            <span className="text-[10px] text-indigo-400 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">AES-256-GCM</span>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            <textarea
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              className="relative block w-full h-48 p-5 rounded-2xl border border-gray-200 bg-gray-50/30 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-mono text-sm resize-none transition-all focus:bg-white outline-none"
                              placeholder="Enter sensitive data..."
                              spellCheck={false}
                           />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                       {/* Burn Toggle */}
                       <div 
                          onClick={() => setIsBurnEnabled(!isBurnEnabled)}
                          className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 ${isBurnEnabled ? 'bg-orange-50 border-orange-200 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                       >
                          <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 flex-shrink-0 ${isBurnEnabled ? 'bg-orange-500' : 'bg-gray-200'}`}>
                             <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${isBurnEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                          </div>
                          <div className="flex flex-col">
                              <span className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${isBurnEnabled ? 'text-orange-800' : 'text-gray-500'}`}>
                                  <Flame className="w-3.5 h-3.5" /> Incinerate
                              </span>
                              <span className={`text-[10px] ${isBurnEnabled ? 'text-orange-600/80' : 'text-gray-400'}`}>Delete after one read</span>
                          </div>
                       </div>

                       {/* Copy Toggle */}
                       <div 
                          onClick={() => setAllowCopy(!allowCopy)}
                          className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 ${allowCopy ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                       >
                          <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 flex-shrink-0 ${allowCopy ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                             <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${allowCopy ? 'translate-x-5' : 'translate-x-0'}`}></div>
                          </div>
                          <div className="flex flex-col">
                              <span className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${allowCopy ? 'text-indigo-900' : 'text-gray-500'}`}>
                                  {allowCopy ? <FilesIcon className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                  {allowCopy ? 'Allow Copy' : 'Read Only'}
                              </span>
                              <span className={`text-[10px] ${allowCopy ? 'text-indigo-700/60' : 'text-gray-400'}`}>Recipient permissions</span>
                          </div>
                       </div>
                    </div>

                    {error && (
                       <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-rose-700 font-medium leading-tight">
                             {error}
                          </div>
                       </div>
                    )}

                    <Button 
                       type="submit" 
                       disabled={isSubmitting || !message.trim()}
                       className={`w-full py-4 text-sm font-bold uppercase tracking-widest relative overflow-hidden group transition-all rounded-xl ${
                           isSubmitting ? 'bg-gray-800' : 'bg-gray-900 hover:bg-black hover:shadow-xl hover:shadow-indigo-500/20'
                       }`}
                    >
                       <span className="relative z-10 flex items-center justify-center gap-2">
                          {isSubmitting ? (
                             <>
                                <RefreshCw className="w-4 h-4 animate-spin" /> Encrypting...
                             </>
                          ) : (
                             <>
                                Encrypt & Generate Link <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                             </>
                          )}
                       </span>
                       {!isSubmitting && (
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                       )}
                    </Button>
                 </motion.form>
              )}
           </AnimatePresence>
        </motion.div>

        {/* Footer info pills */}
        <div className="mt-10 flex flex-wrap justify-center gap-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
                <Lock className="w-3 h-3" />
                <span>Client-Side Only</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
                <Terminal className="w-3 h-3" />
                <span>256-bit AES-GCM</span>
            </div>
        </div>

      </div>
    </div>
  );
};

export default DeadDropPage;