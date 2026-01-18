import React, { useState, useRef, useEffect } from 'react';
import { Send, Lock, Shield, User as UserIcon, Crown, UserCheck, AlertTriangle } from 'lucide-react';
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
        if (err.message?.includes('does not exist')) {
             setConnectionError("Secure Channel Offline: Tables missing. Run setup SQL.");
        } else {
            setConnectionError("Connection Interrupted");
        }
      }
    };

    fetchHistory();

    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Fetch sender details
        const { data } = await supabase
          .from('profiles')
          .select('username, role')
          .eq('id', payload.new.user_id)
          .single();
        
        const newMessage: ChatMessage = {
           id: payload.new.id,
           user_id: payload.new.user_id,
           content: payload.new.content,
           created_at: payload.new.created_at,
           username: data?.username || 'Unknown',
           role: data?.role
        };
        
        setMessages(prev => {
            if (prev.some(msg => msg.id === newMessage.id)) return prev;
            return [...prev, newMessage];
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Secure channel subscribed');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    
    const content = input.trim();
    const tempId = crypto.randomUUID(); 
    
    setInput('');
    setIsLoading(true);

    // Optimistic Update
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
        id: tempId,
        user_id: user.id,
        content: content
      });
      
      if (error) {
          setMessages(prev => prev.filter(m => m.id !== tempId)); // Rollback
          throw error;
      }
    } catch (error: any) {
      console.error("Failed to send", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 p-5 flex items-center justify-between z-10">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-50 p-3 rounded-full border border-indigo-100">
             <Shield className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">ODL Secure Channel</h2>
            <div className="flex items-center mt-1">
               <Lock className="h-3 w-3 text-emerald-500 mr-1.5" />
               <p className="text-xs text-gray-500 font-medium">Encrypted Team Comms</p>
            </div>
          </div>
        </div>
        <div className={`h-2.5 w-2.5 rounded-full ${connectionError ? 'bg-rose-500' : 'bg-emerald-500'} ring-4 ring-white shadow-sm`}></div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#f9fafb] relative">
        {connectionError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-lg text-sm border border-rose-100 shadow-sm flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {connectionError}
                </div>
            </div>
        )}

        {messages.length === 0 && !connectionError && (
             <div className="flex flex-col items-center justify-center h-full opacity-30">
                 <Shield size={64} className="text-gray-400 mb-4" />
                 <p className="text-gray-500 font-medium">Secure Channel Ready</p>
             </div>
        )}

        {messages.map((msg, index) => {
          const isMe = msg.user_id === user?.id;
          const isAdmin = msg.role === 'grand_admin' || msg.role === 'admin';
          const showHeader = index === 0 || messages[index - 1].user_id !== msg.user_id;
          
          return (
            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                
                {showHeader && (
                    <div className={`flex items-center mb-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{msg.username}</span>
                         <span className="text-[9px] text-gray-300">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                )}

                <div className={`px-5 py-3 text-sm leading-relaxed shadow-sm relative ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm'
                  }`}>
                    {msg.content}
                    
                    {/* Role Icon floating */}
                    {showHeader && !isMe && isAdmin && (
                         <div className="absolute -left-3 -top-3 bg-white p-1 rounded-full shadow-sm border border-indigo-100">
                             <Crown size={10} className="text-indigo-600" />
                         </div>
                    )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 p-5">
        <form onSubmit={handleSend} className="relative flex items-center gap-3 max-w-5xl mx-auto">
             <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               placeholder="Transmit secure message..."
               className="w-full pl-5 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all duration-200"
               disabled={!!connectionError}
             />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim() || !!connectionError}
              className="px-0 w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
            >
              <Send className="h-5 w-5 text-white ml-0.5" />
            </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;