import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Send, Lock, AlertTriangle, FileText, CheckCircle2, Shield, RefreshCw } from 'lucide-react';
import Button from '../components/Button';
import { supabase } from '../services/supabase';

const DeadDropPage: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isBurnEnabled, setIsBurnEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    
    // Simulate encryption delay
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      // In a real scenario, this would post to a 'dead_drops' table
      // const { error } = await supabase.from('dead_drops').insert({ content: message, burn_after_read: isBurnEnabled });
      // if (error) throw error;
      
      setSuccess(true);
      setMessage('');
      
      // Reset success state after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
             <Flame className="h-8 w-8 text-orange-600" />
             Dead Drop
          </h1>
          <p className="mt-1 text-gray-500">Secure, one-way information transfer protocol.</p>
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-xs font-medium text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
           <AlertTriangle className="h-3.5 w-3.5" />
           <span>Anonymous & Trace-free</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Input Area */}
        <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-600"></div>
                
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <label className="block text-sm font-semibold text-gray-700">Payload Content</label>
                        <div className="flex items-center space-x-2">
                            <span className={`text-xs font-medium transition-colors ${isBurnEnabled ? 'text-red-600' : 'text-gray-400'}`}>
                                {isBurnEnabled ? 'Burn-on-read active' : 'Persistence active'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsBurnEnabled(!isBurnEnabled)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${isBurnEnabled ? 'bg-red-500' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isBurnEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} style={{ transform: isBurnEnabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={8}
                            className="block w-full rounded-xl border-gray-200 bg-gray-50 p-4 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-orange-500 sm:text-sm font-mono transition-all"
                            placeholder="Enter classified intelligence here..."
                        />
                        <div className="absolute bottom-3 right-3">
                            <Lock className="h-4 w-4 text-gray-300" />
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between">
                        <div className="text-xs text-gray-400 flex items-center">
                            <Shield className="h-3 w-3 mr-1" />
                            End-to-end encrypted
                        </div>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting || !message.trim()}
                            className={`bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all ${success ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                        >
                            {isSubmitting ? (
                                <>Encrypting...</>
                            ) : success ? (
                                <><CheckCircle2 className="h-4 w-4 mr-2" /> Sent</>
                            ) : (
                                <><Send className="h-4 w-4 mr-2" /> Drop Payload</>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
            <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-600/20 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <h3 className="font-bold text-lg mb-2 flex items-center">
                        <Shield className="h-5 w-5 mr-2 text-orange-500" />
                        Protocol Omega
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        All submissions via Dead Drop are routed through multiple proxy layers. Metadata is stripped automatically.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-300">
                        <li className="flex items-start">
                            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500 mt-0.5" />
                            <span>IP Address Obfuscated</span>
                        </li>
                        <li className="flex items-start">
                            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500 mt-0.5" />
                            <span>Metadata Stripped</span>
                        </li>
                        <li className="flex items-start">
                            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500 mt-0.5" />
                            <span>Zero-knowledge Encryption</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                    <RefreshCw className="h-4 w-4 mr-2 text-gray-400" />
                    Recent Activity
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 mr-2"></div>
                            <span className="text-gray-600">Payload #9921 received</span>
                        </div>
                        <span className="text-gray-400 text-xs">2m ago</span>
                    </div>
                     <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                            <div className="h-2 w-2 rounded-full bg-orange-500 mr-2"></div>
                            <span className="text-gray-600">Payload #9920 burned</span>
                        </div>
                        <span className="text-gray-400 text-xs">15m ago</span>
                    </div>
                     <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                            <div className="h-2 w-2 rounded-full bg-gray-300 mr-2"></div>
                            <span className="text-gray-400">System Purge</span>
                        </div>
                        <span className="text-gray-400 text-xs">1h ago</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DeadDropPage;