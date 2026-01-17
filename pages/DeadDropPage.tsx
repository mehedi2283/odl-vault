import React, { useState, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Flame, 
  Link as LinkIcon, 
  Copy, 
  ShieldAlert, 
  Check, 
  EyeOff, 
  Lock, 
  AlertTriangle,
  Loader2,
  FileText
} from 'lucide-react';
import Button from '../components/Button';
import Toast from '../components/Toast';
import { supabase } from '../services/supabase';
import { generateKey, exportKey, importKey, encryptData, decryptData } from '../services/crypto';
import { RoutePath } from '../types';

// --- COMPONENTS ---

// 1. Creator Component
const DeadDropCreator: React.FC = () => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleCreate = async () => {
    if (!content.trim()) return;
    setIsLoading(true);
    setGeneratedLink(null);

    try {
      // 1. Generate Client-Side Key
      const key = await generateKey();
      const exportedKey = await exportKey(key);

      // 2. Encrypt Content
      const { ciphertext, iv } = await encryptData(content, key);

      // 3. Upload to Supabase (Only Ciphertext + IV)
      const { data, error } = await supabase
        .from('dead_drops')
        .insert({
          encrypted_content: ciphertext,
          iv: iv
        })
        .select('id')
        .single();

      if (error) throw error;

      // 4. Construct URL with ID and Key (Key in Hash so server never sees it)
      // Format: /dead-drop/view/<id>#<key>
      const baseUrl = window.location.href.split('#')[0]; // Base URL before hash router
      // Since we are using HashRouter, the URL structure is base/#/dead-drop/view/id
      // We need to append the key as a query param or a secondary hash. 
      // Query param is safer for compatibility with hash router: /dead-drop/view/<id>?k=<key>
      const link = `${window.location.origin}${window.location.pathname}#/dead-drop/view/${data.id}?k=${encodeURIComponent(exportedKey)}`;
      
      setGeneratedLink(link);
      setToast({ message: "Secure link generated. Message is ready for one-time access.", type: 'success' });
      setContent(''); // Clear sensitive data from memory input
    } catch (err: any) {
      console.error(err);
      if (err.code === '42P01') {
         setToast({ message: "Error: Database table 'dead_drops' missing. Run SQL setup.", type: 'error' });
      } else {
         setToast({ message: "Encryption failed. Please try again.", type: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setToast({ message: "Link copied to clipboard", type: 'success' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-rose-50 rounded-full mb-4 ring-8 ring-rose-50/50">
          <Flame className="h-8 w-8 text-rose-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Dead Drop Protocol</h1>
        <p className="text-gray-500 mt-2">Create a secure, encrypted message that self-destructs after being read.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          {!generatedLink ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Secure Message</label>
                <div className="relative">
                  <textarea 
                    rows={6}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-rose-100 focus:border-rose-400 focus:outline-none transition-all resize-none placeholder-gray-400"
                    placeholder="Enter sensitive coordinates, passwords, or intelligence..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    autoFocus
                  />
                  <div className="absolute top-3 right-3 text-gray-400">
                    <Lock size={16} />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center">
                  <ShieldAlert size={12} className="mr-1" />
                  End-to-End Encrypted. Server cannot read this.
                </p>
              </div>

              <Button 
                onClick={handleCreate} 
                disabled={isLoading || !content.trim()} 
                className={`w-full ${isLoading || !content.trim() ? '' : '!bg-rose-600 hover:!bg-rose-700 !shadow-rose-500/20'}`}
                isLoading={isLoading}
              >
                {isLoading ? 'Encrypting...' : 'Generate Burn Link'}
              </Button>
            </>
          ) : (
            <div className="space-y-6 text-center animate-fade-in">
               <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center text-emerald-800">
                  <Check className="h-8 w-8 mb-2" />
                  <h3 className="font-bold">Encryption Successful</h3>
                  <p className="text-xs mt-1 opacity-80">This link works exactly once.</p>
               </div>

               <div className="relative">
                 <input 
                    type="text" 
                    readOnly 
                    value={generatedLink} 
                    className="w-full bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-xl py-3 pl-4 pr-12 font-mono truncate"
                 />
                 <button 
                    onClick={handleCopy}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors"
                 >
                    <Copy size={16} />
                 </button>
               </div>

               <div className="text-left bg-amber-50 rounded-lg p-4 text-xs text-amber-800 border border-amber-100 leading-relaxed">
                  <strong>Warning:</strong> Once this link is opened by you or anyone else, the message is permanently deleted from the database. Do not open it to "test" unless you want to destroy it.
               </div>

               <Button variant="secondary" onClick={() => { setGeneratedLink(null); setContent(''); }} className="w-full">
                 Create Another Drop
               </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. Viewer Component
const DeadDropViewer: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'decrypting' | 'success' | 'error' | 'destroyed'>('loading');
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchAndBurn = async () => {
      if (!id) return;

      // Extract key from query param
      const searchParams = new URLSearchParams(location.search);
      const keyStr = searchParams.get('k');

      if (!keyStr) {
        setStatus('error');
        setErrorMsg("Decryption key missing from URL.");
        return;
      }

      try {
        // 1. Fetch Ciphertext
        const { data, error } = await supabase
          .from('dead_drops')
          .select('encrypted_content, iv')
          .eq('id', id)
          .single();

        if (error || !data) {
          setStatus('destroyed');
          return;
        }

        // 2. Delete Immediately (Burn)
        await supabase.from('dead_drops').delete().eq('id', id);

        setStatus('decrypting');

        // 3. Decrypt Client-Side
        const key = await importKey(keyStr);
        const text = await decryptData(data.encrypted_content, data.iv, key);

        setDecryptedContent(text);
        setStatus('success');

      } catch (err) {
        console.error(err);
        setStatus('error');
        setErrorMsg("Failed to retrieve or decrypt message.");
      }
    };

    fetchAndBurn();
  }, [id, location.search]);

  if (status === 'loading' || status === 'decrypting') {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
        <p className="text-sm font-medium animate-pulse">
          {status === 'loading' ? 'Locating secure packet...' : 'Decrypting payload...'}
        </p>
      </div>
    );
  }

  if (status === 'destroyed') {
    return (
      <div className="max-w-md mx-auto mt-12 text-center p-8 bg-gray-100 rounded-2xl border border-gray-200">
        <div className="inline-flex p-4 bg-gray-200 rounded-full mb-4">
           <EyeOff className="h-8 w-8 text-gray-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Message Destroyed</h2>
        <p className="text-gray-500 mt-2 text-sm">
          This message does not exist. It may have already been read and automatically deleted, or the link is invalid.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate(RoutePath.DEAD_DROP)}>
          Return to Base
        </Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-md mx-auto mt-12 text-center p-8 bg-rose-50 rounded-2xl border border-rose-100">
        <div className="inline-flex p-4 bg-rose-100 rounded-full mb-4">
           <AlertTriangle className="h-8 w-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-rose-900">Protocol Failure</h2>
        <p className="text-rose-700 mt-2 text-sm">{errorMsg}</p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate(RoutePath.DEAD_DROP)}>
          Return to Base
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-lg border border-rose-100 overflow-hidden relative">
        {/* Warning Banner */}
        <div className="bg-rose-500 text-white text-xs font-bold uppercase tracking-widest text-center py-2">
           Burn Notice: Message Destroyed on Server
        </div>
        
        <div className="p-8">
           <div className="flex items-center gap-3 mb-6 text-gray-400">
              <FileText size={20} />
              <span className="text-sm font-medium uppercase tracking-wide">Decrypted Payload</span>
           </div>
           
           <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 font-mono text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {decryptedContent}
           </div>

           <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6">
              <p className="text-xs text-gray-400 italic">
                This content is now only available in your browser memory. <br/>It will vanish when you navigate away.
              </p>
              <Button onClick={() => {
                 if (decryptedContent) navigator.clipboard.writeText(decryptedContent);
                 alert('Copied to clipboard');
              }}>
                 <Copy className="h-4 w-4 mr-2" />
                 Copy Text
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE WRAPPER ---

const DeadDropPage: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<DeadDropCreator />} />
      <Route path="/view/:id" element={<DeadDropViewer />} />
    </Routes>
  );
};

export default DeadDropPage;