import React, { useState, useRef, useEffect } from 'react';
import { Send, Lock, Shield, User as UserIcon, RefreshCcw, MoreVertical, Crown, UserCheck, AlertTriangle } from 'lucide-react';
import Button from '../components/Button';
import { supabase } from '../services/supabase';
import { ChatMessage, User } from '../types';

interface ChatPageProps {
  user: User | null;
}

const ChatPage: React.FC<ChatPageProps> = ({ user }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial Fetch & Realtime Subscription
  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      setConnectionError(null);
      try {
        // Get messages and join with profiles to get display names
        // Removed 'full_name' from selection to prevent schema errors
        const { data, error } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            user_id,
            profiles ( username, role )
          `)
          .order('created_at', { ascending: true })
          .limit(50);
        
        if (error) throw error;
        
        if (data) {
          const mapped: ChatMessage[] = data.map((m: any) => ({
            id: m.id,
            user_id: m.user_id,
            content: m.content,
            created_at: m.created_at,
            username: m.profiles?.username || 'Unknown Agent',
            role: m.profiles?.role
          }));
          setMessages(mapped);
        }
      } catch (err: any) {
        console.error('Error fetching chat:', err.message || err);
        if (err.message?.includes('does not exist') || err.message?.includes('missing FROM-clause')) {
             // Fallback for missing tables or columns
             if (err.message.includes('full_name')) {
                 setConnectionError("Database Schema Mismatch: 'full_name' column missing.");
             } else {
                 setConnectionError("Secure Channel Offline: Database tables not configured. Run the setup SQL in Dashboard.");
             }
        } else {
            setConnectionError(`Connection Interrupted: ${err.message || 'Unknown error'}`);
        }
      }
    };

    fetchHistory();

    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Fetch the sender's profile for the new message
        // Removed full_name here as well
        const { data, error } = await supabase
          .from('profiles')
          .select('username, role')
          .eq('id', payload.new.user_id)
          .single();
        
        if (error) {
             console.warn("Could not fetch profile for message sender", error.message);
        }

        const newMessage: ChatMessage = {
           id: payload.new.id,
           user_id: payload.new.user_id,
           content: payload.new.content,
           created_at: payload.new.created_at,
           username: data?.username || 'Unknown',
           role: data?.role
        };
        
        // Deduplication: Check if message ID already exists (from optimistic update)
        setMessages(prev => {
            if (prev.some(msg => msg.id === newMessage.id)) {
                return prev;
            }
            return [...prev, newMessage];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    
    const content = input.trim();
    const tempId = crypto.randomUUID(); // Generate client-side ID for instant display
    
    setInput(''); // Clear input immediately
    setIsLoading(true);

    // Optimistic Update: Show message immediately
    const optimisticMessage: ChatMessage = {
        id: tempId,
        user_id: user.id,
        content: content,
        created_at: new Date().toISOString(),
        username: user.username,
        role: user.role
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { error } = await supabase.from('messages').insert({
        id: tempId, // Send the UUID we generated
        user_id: user.id,
        content: content
      });
      
      if (error) {
          // Rollback on error
          setMessages(prev => prev.filter(m => m.id !== tempId));
          throw error;
      }
    } catch (error: any) {
      console.error("Failed to send message", error.message || error);
      setConnectionError(`Transmission Failed: ${error.message || 'Unknown Error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-100 p-4 px-6 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="bg-indigo-50 p-2.5 rounded-full">
               <Shield className="h-6 w-6 text-indigo-600" />
            </div>
            <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${connectionError ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">ODL Secure Channel</h2>
            <div className="flex items-center">
               <Lock className="h-3 w-3 text-emerald-500 mr-1" />
               <p className="text-xs text-gray-500 font-medium">
                 {connectionError ? 'Encryption Destabilized' : 'Encrypted Team Comms'}
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 relative">
        {connectionError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-20">
                <div className="bg-white p-6 rounded-xl shadow-xl border border-rose-100 max-w-md text-center">
                    <div className="mx-auto w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mb-3">
                        <AlertTriangle className="h-6 w-6 text-rose-500" />
                    </div>
                    <h3 className="text-gray-900 font-bold mb-1">Comms Offline</h3>
                    <p className="text-sm text-gray-500 mb-4">{connectionError}</p>
                    <Button variant="secondary" onClick={() => window.location.reload()}>Reconnect</Button>
                </div>
            </div>
        )}

        {messages.length === 0 && !connectionError && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                <Shield size={48} className="mb-4 text-gray-300" />
                <p className="text-sm font-medium">Secure Channel Established</p>
                <p className="text-xs">No transmissions recorded.</p>
            </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.user_id === user?.id;
          const isAdmin = msg.role === 'grand_admin' || msg.role === 'admin';
          
          return (
            <div
              key={msg.id}
              className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
                
                {/* Avatar */}
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm mb-1 ${isAdmin ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
                  {isAdmin ? <Crown size={14} /> : <UserCheck size={14} />}
                </div>
                
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{msg.username}</span>
                      <span className="text-[9px] text-gray-300">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className={`px-5 py-3.5 shadow-sm text-sm leading-relaxed ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-2xl rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={handleSend} className="relative flex items-center gap-3">
             <div className="relative flex-1 group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Transmit secure message..."
                  className="w-full pl-5 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!!connectionError}
                />
             </div>
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim() || !!connectionError}
              className="px-4 h-[50px] rounded-xl aspect-square flex items-center justify-center !p-0"
            >
              <Send className="h-5 w-5 ml-0.5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;