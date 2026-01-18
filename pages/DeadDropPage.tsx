import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, Send, Lock, Shield, CheckCircle2, Zap, Copy, 
  Link as LinkIcon, AlertTriangle, Fingerprint, Terminal,
  RefreshCw, Server
} from 'lucide-react';
import Button from '../components/Button';
import { supabase } from '../services/supabase';

// --- CRYPTO UTILS ---
const generateKey = async () => {
  return window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

const encryptMessage = async (text: string, key: CryptoKey) => {
  const encoded = new TextEncoder().encode(text);
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
      // 1. Client-Side Encryption
      const key = await generateKey();
      const { ciphertext, iv, keyString } = await encryptMessage(message, key);

      // 2. Insert into Supabase
      // We try to insert 'burn_after_read'. If the column doesn't exist (older schema), 
      // Supabase might throw an error or ignore it depending on strictness.
      // We'll try the optimal insert first.
      
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
         // Fallback: If 'burn_after_read' column is missing, try inserting without it
         // Or if 'encrypted_content' is missing, try 'content' (legacy)
         if (insertError.message?.includes('burn_after_read') || insertError.code === 'PGRST204') {
             console.warn("Schema mismatch detected, attempting fallback insert...");
             const { data, error: fallbackError } = await supabase
              .from('dead_drops')
              .insert({
                  encrypted_content: ciphertext,
                  iv: iv
                  // Omitting burn_after_read, defaulting to DB default (usually true)
              })
              .select('id')
              .single();
            
            if (fallbackError) throw fallbackError;
            dropId = data.id;
         } else {
             throw insertError;
         }
      }

      if (dropId) {
          // 3. Construct URL with Key in Hash (Never sent to server)
          // Format: /pickup/<id>#<key>
          const baseUrl = window.location.href.split('#')[0];
          const link = `${baseUrl}#/pickup/${dropId}#${keyString}`;
          
          setGeneratedLink(link);
          setMessage('');
      }

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('dead_drops')) {
          setError("Database Error: Table 'dead_drops' not found. Please run the SQL setup.");
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
      }
  };

  const resetForm = () => {
      setGeneratedLink(null);
      setMessage('');
      setError(null);
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 px-4 font-sans">
      
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <Flame className="h-6 w-6 text-orange-500" />
             </div>
             <span className="text-xs font-bold tracking-widest text-orange-600 uppercase">Classified Transmission</span>
           </div>
           <h1 className="text-4xl font-black text-gray-900 tracking-tight">Dead Drop Protocol</h1>
           <p className="mt-2 text-gray-500 max-w-lg text-lg">
             Zero-knowledge encryption. The server never sees the key. 
             Data is incinerated after retrieval.
           </p>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-mono text-gray-400 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>AES-GCM-256 ACTIVE</span>
           </div>
           <div className="w-px h-4 bg-gray-200"></div>
           <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              <span>CLIENT-SIDE ONLY</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Interface */}
        <div className="lg:col-span-8">
           <div className="bg-white rounded-3xl shadow-xl shadow-orange-900/5 border border-gray-100 overflow-hidden relative group">
              
              {/* Decorative Header Bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500"></div>
              
              <div className="p-1">
                 <AnimatePresence mode="wait">
                    {generatedLink ? (
                       <motion.div
                          key="success"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-8 md:p-12 text-center"
                       >
                          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-sm">
                             <div className="relative">
                                <LinkIcon className="h-8 w-8 text-emerald-600 relative z-10" />
                                <div className="absolute inset-0 bg-emerald-400 blur-lg opacity-20 animate-pulse"></div>
                             </div>
                          </div>
                          
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">Payload Secured</h3>
                          <p className="text-gray-500 mb-8 max-w-md mx-auto">
                             This link contains the decryption key in the hash. 
                             It is the <strong>only key</strong> to access the data.
                          </p>

                          <div className="max-w-xl mx-auto bg-gray-900 rounded-xl p-1.5 shadow-2xl ring-4 ring-gray-100 mb-8">
                             <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1 pr-1.5">
                                <div className="flex-1 px-3 py-2 text-left overflow-x-auto scrollbar-hide">
                                   <code className="text-sm font-mono text-emerald-400 whitespace-nowrap">
                                      {generatedLink}
                                   </code>
                                </div>
                                <button 
                                   onClick={copyLink}
                                   className="bg-emerald-500 hover:bg-emerald-400 text-white p-2 rounded-md transition-colors flex-shrink-0"
                                >
                                   <Copy className="h-4 w-4" />
                                </button>
                             </div>
                          </div>

                          <button 
                             onClick={resetForm}
                             className="text-sm font-semibold text-gray-500 hover:text-orange-600 transition-colors flex items-center gap-2 mx-auto px-4 py-2 rounded-lg hover:bg-orange-50"
                          >
                             <RefreshCw className="w-4 h-4" /> Initialize New Drop
                          </button>
                       </motion.div>
                    ) : (
                       <motion.form 
                          key="form"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onSubmit={handleSubmit}
                          className="p-6 md:p-8"
                       >
                          <div className="flex items-center justify-between mb-6">
                             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Terminal className="w-4 h-4" />
                                Input Intelligence
                             </label>
                             
                             <button
                                type="button"
                                onClick={() => setIsBurnEnabled(!isBurnEnabled)}
                                className={`flex items-center gap-3 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${isBurnEnabled ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}
                             >
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isBurnEnabled ? 'text-orange-700' : 'text-gray-400'}`}>
                                   {isBurnEnabled ? 'Incinerate On Read' : 'Standard Persistence'}
                                </span>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${isBurnEnabled ? 'bg-orange-500' : 'bg-gray-300'}`}>
                                   <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${isBurnEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                             </button>
                          </div>

                          <div className="relative group">
                             <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-200 to-rose-200 rounded-xl opacity-20 group-hover:opacity-50 blur transition-opacity"></div>
                             <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="relative block w-full rounded-xl border-gray-200 bg-gray-50 p-6 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-orange-500 font-mono text-sm shadow-inner transition-all resize-none h-64 focus:bg-white focus:shadow-xl"
                                placeholder="// Enter top secret payload..."
                                spellCheck={false}
                             />
                             <div className="absolute bottom-4 right-4 flex items-center gap-2 text-[10px] font-mono text-gray-400 bg-white/50 backdrop-blur px-2 py-1 rounded-md">
                                <Lock className="w-3 h-3" />
                                <span>UNENCRYPTED PREVIEW</span>
                             </div>
                          </div>

                          {error && (
                             <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-rose-700 font-medium">
                                   {error}
                                   {error.includes('dead_drops') && (
                                       <div className="mt-1 text-xs opacity-80">
                                           Go to "Operatives" page and run the "SQL Schema Setup" to fix missing tables.
                                       </div>
                                   )}
                                </div>
                             </div>
                          )}

                          <div className="mt-8">
                             <Button 
                                type="submit" 
                                disabled={isSubmitting || !message.trim()}
                                className={`w-full py-4 text-base relative overflow-hidden group ${
                                    isSubmitting ? 'bg-gray-800' : 'bg-gray-900 hover:bg-black'
                                }`}
                             >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                   {isSubmitting ? (
                                      <>Encrypting & Uploading...</>
                                   ) : (
                                      <><Zap className="w-4 h-4 fill-white" /> Generate Secure Link</>
                                   )}
                                </span>
                                {!isSubmitting && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-rose-600 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"></div>
                                )}
                             </Button>
                          </div>
                       </motion.form>
                    )}
                 </AnimatePresence>
              </div>
           </div>
        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-zinc-900 text-white p-6 rounded-3xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
               
               <h3 className="text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                   <Server className="w-5 h-5 text-orange-500" />
                   Protocol Overview
               </h3>
               
               <div className="space-y-4 relative z-10">
                   <div className="flex gap-3">
                       <div className="mt-1 p-1 bg-zinc-800 rounded-lg h-fit"><Lock className="w-3.5 h-3.5 text-emerald-400" /></div>
                       <div>
                           <h4 className="text-sm font-bold text-gray-200">Client-Side Encryption</h4>
                           <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                               Data is encrypted <strong>before</strong> leaving your device. Supabase receives only ciphertext.
                           </p>
                       </div>
                   </div>
                   
                   <div className="flex gap-3">
                       <div className="mt-1 p-1 bg-zinc-800 rounded-lg h-fit"><Fingerprint className="w-3.5 h-3.5 text-blue-400" /></div>
                       <div>
                           <h4 className="text-sm font-bold text-gray-200">Key in Hash</h4>
                           <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                               The decryption key is stored in the URL fragment (after #). Servers never receive this part of the URL.
                           </p>
                       </div>
                   </div>

                   <div className="flex gap-3">
                       <div className="mt-1 p-1 bg-zinc-800 rounded-lg h-fit"><Flame className="w-3.5 h-3.5 text-orange-400" /></div>
                       <div>
                           <h4 className="text-sm font-bold text-gray-200">Self-Destruct</h4>
                           <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                               If enabled, the database record is hard-deleted immediately upon the first successful retrieval.
                           </p>
                       </div>
                   </div>
               </div>
           </div>
           
           <div className="bg-white border border-gray-200 p-6 rounded-3xl">
               <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Encryption Tech Stack</h4>
               <div className="flex flex-wrap gap-2">
                   <span className="px-2 py-1 bg-gray-100 rounded-md text-[10px] font-mono text-gray-600">AES-GCM-256</span>
                   <span className="px-2 py-1 bg-gray-100 rounded-md text-[10px] font-mono text-gray-600">Web Crypto API</span>
                   <span className="px-2 py-1 bg-gray-100 rounded-md text-[10px] font-mono text-gray-600">Base64</span>
                   <span className="px-2 py-1 bg-gray-100 rounded-md text-[10px] font-mono text-gray-600">IV Randomization</span>
               </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DeadDropPage;