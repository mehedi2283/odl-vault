import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Eye, Lock, Loader2, FileWarning, Unlock, ShieldCheck, Terminal } from 'lucide-react';
import { supabase } from '../services/supabase';

// --- CRYPTO UTILS ---
const decryptMessage = async (ciphertextB64: string, ivB64: string, keyB64: string) => {
    try {
        const keyBytes = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
        const key = await window.crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "AES-GCM" },
            true,
            ["encrypt", "decrypt"]
        );

        const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.error("Decryption failed", e);
        throw new Error("Decryption key invalid or payload corrupted.");
    }
};

const DeadDropRetrievalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [status, setStatus] = useState<'locked' | 'decrypting' | 'revealed' | 'error'>('locked');
  const [content, setContent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Extract key from hash (it comes after the second # usually if hash router is used improperly, 
  // or simply check the last part of the hash if we are careful)
  // In HashRouter: #/pickup/<id>#<key> -> location.hash might be tricky.
  // Actually, standard window.location.hash in HashRouter might treat the whole thing as the path.
  // We need to parse the custom format we created: /pickup/id#key
  
  const getKeyFromUrl = () => {
      // The browser URL is like: http://.../#/pickup/abc-123#KEY_HERE
      // React Router sees pathname: /pickup/abc-123
      // The `location.hash` from react-router might contain the key if it's treated as a hash on the route
      // BUT `location` object from `useLocation` only gives us the route part.
      // We need native window.location to find the *second* hash or the end part.
      
      const fullHash = window.location.hash; // "#/pickup/uuid#key"
      const parts = fullHash.split('#');
      // parts[0] is usually empty
      // parts[1] is "/pickup/uuid"
      // parts[2] is "key"
      if (parts.length >= 3) {
          return parts[parts.length - 1]; // The last part is our key
      }
      return null;
  };

  const handleDecrypt = async () => {
    if (!id) return;
    const keyString = getKeyFromUrl();
    
    if (!keyString) {
        setStatus('error');
        setErrorMessage("Decryption key missing from URL.");
        return;
    }

    setStatus('decrypting');

    try {
      // 1. Fetch encrypted data
      const { data, error } = await supabase
        .from('dead_drops')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
          throw new Error("Payload not found. It has likely been incinerated.");
      }

      // 2. Decrypt locally
      if (!data.encrypted_content || !data.iv) {
          throw new Error("Legacy format unsupported or data corrupted.");
      }

      const decryptedText = await decryptMessage(data.encrypted_content, data.iv, keyString);
      setContent(decryptedText);
      setStatus('revealed');

      // 3. Burn if required
      // We check if the column exists in the data returned. If undefined, we assume false or check logic.
      // If 'burn_after_read' is true, we delete.
      if (data.burn_after_read === true) {
          await supabase.from('dead_drops').delete().eq('id', id);
      }

    } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || "Decryption failed.");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-200 flex flex-col items-center justify-center p-4 relative overflow-hidden font-mono selection:bg-orange-500/30">
      
      {/* Grid Background */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>
      
      {/* Top Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-xl">
          <div className="text-center mb-10">
               <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold tracking-widest text-zinc-500 mb-6 uppercase">
                  <Terminal size={12} />
                  <span>Secure Enclave</span>
               </div>
               <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-2">
                   <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-500">Dead Drop</span>
               </h1>
               <p className="text-zinc-500 text-sm">End-to-end encrypted payload retrieval.</p>
          </div>

          <AnimatePresence mode="wait">
              {status === 'locked' && (
                  <motion.div 
                    key="locked"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden group"
                  >
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                      
                      <div className="flex flex-col items-center text-center">
                          <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 ring-4 ring-zinc-800 group-hover:ring-orange-500/30 transition-all duration-500">
                             <Lock className="w-8 h-8 text-zinc-400 group-hover:text-white transition-colors" />
                          </div>
                          
                          <h2 className="text-xl font-bold text-white mb-2">Encrypted Package Found</h2>
                          <p className="text-zinc-400 text-sm mb-8 max-w-xs leading-relaxed">
                             Decryption key detected in URL hash. 
                             <br/>Ready to attempt localized decryption.
                          </p>
                          
                          <button 
                             onClick={handleDecrypt}
                             className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
                          >
                             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                             <Unlock className="w-5 h-5" />
                             <span>Initialize Decryption</span>
                          </button>
                      </div>
                  </motion.div>
              )}

              {status === 'decrypting' && (
                  <motion.div 
                    key="decrypting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-20"
                  >
                      <Loader2 className="w-16 h-16 text-orange-500 animate-spin mb-6" />
                      <div className="font-mono text-sm text-orange-500 flex flex-col items-center gap-1">
                          <span>DERIVING KEY...</span>
                          <span className="opacity-50">VERIFYING INTEGRITY...</span>
                      </div>
                  </motion.div>
              )}

              {status === 'revealed' && (
                  <motion.div 
                    key="revealed"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10"
                  >
                      <div className="bg-zinc-900 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Decryption Successful</span>
                          </div>
                          <button 
                             onClick={() => navigator.clipboard.writeText(content || "")}
                             className="text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors uppercase"
                          >
                             Copy Data
                          </button>
                      </div>
                      
                      <div className="p-8 overflow-x-auto">
                          <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap break-words leading-relaxed selection:bg-emerald-500/30">
                              {content}
                          </pre>
                      </div>

                      <div className="bg-zinc-900/50 p-4 border-t border-zinc-800/50 text-center">
                          <p className="text-[10px] text-orange-500/60 font-mono uppercase tracking-widest flex items-center justify-center gap-2">
                              <Flame className="w-3 h-3" />
                              <span>Server Record Purged</span>
                          </p>
                      </div>
                  </motion.div>
              )}

              {status === 'error' && (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-950/30 border border-rose-900/50 rounded-3xl p-8 text-center backdrop-blur-md"
                  >
                      <div className="w-16 h-16 bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-rose-800">
                          <FileWarning className="w-8 h-8 text-rose-500" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                      <p className="text-rose-200/60 text-sm mb-6 max-w-xs mx-auto">{errorMessage}</p>
                      <a 
                         href="/" 
                         className="inline-flex items-center text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
                      >
                         Return to Base
                      </a>
                  </motion.div>
              )}
          </AnimatePresence>
      </div>
    </div>
  );
};

export default DeadDropRetrievalPage;