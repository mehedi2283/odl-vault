import React, { useState, useRef, useEffect } from 'react';
import { Send, Lock, Shield, User as UserIcon, Crown, AlertTriangle, ShieldCheck, ShieldAlert, Bell, BellOff, RefreshCw } from 'lucide-react';
import Button from '../components/Button';
import Toast from '../components/Toast';
import { supabase } from '../services/supabase';
import { ChatMessage, User } from '../types';

interface ChatPageProps {
  user: User | null;
}

const ChatPage: React.FC<ChatPageProps> = ({ user }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Notification Permission State
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return 'Notification' in window && Notification.permission === 'granted';
  });
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Ref for user access in closures
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sync Notification Permission with Browser State
  useEffect(() => {
    if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' as PermissionName })
            .then((permissionStatus) => {
                setNotificationsEnabled(permissionStatus.state === 'granted');
                permissionStatus.onchange = () => {
                    setNotificationsEnabled(permissionStatus.state === 'granted');
                };
            })
            .catch(() => {});
    }
  }, []);

  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
        setToast({ message: "Notifications not supported on this device", type: 'error' });
        return;
    }

    if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            setNotificationsEnabled(true);
            setToast({ message: "Notifications enabled", type: 'success' });
        } else {
            setNotificationsEnabled(false);
            setToast({ message: "Permission denied", type: 'error' });
        }
    } else {
        // Just purely UI toggle if already granted (Logic handled in Layout)
        setNotificationsEnabled(!notificationsEnabled);
        setToast({ message: notificationsEnabled ? "Notifications muted" : "Notifications active", type: 'success' });
    }
  };

  // --- Initial Fetch & Subscription ---
  useEffect(() => {
    if (!user) return;

    // 1. Fetch Initial History
    const fetchHistory = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                id,
                content,
                created_at,
                user_id,
                profiles ( username, full_name, role )
            `)
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) {
            console.error("History fetch error:", error);
            setConnectionError("Failed to load history");
        } else if (data) {
            const mapped: ChatMessage[] = data.map((m: any) => ({
                id: m.id,
                user_id: m.user_id,
                content: m.content,
                created_at: m.created_at,
                username: m.profiles?.username || 'Unknown Agent',
                full_name: m.profiles?.full_name,
                role: m.profiles?.role
            }));
            setMessages(mapped);
        }
    };

    fetchHistory();

    // 2. Setup Realtime Subscription
    // Note: Notifications are now handled globally in Layout.tsx
    console.log("Initializing Chat UI Subscription...");
    const channel = supabase.channel('public:room_001')
        .on(
            'postgres_changes', 
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'messages' 
            }, 
            async (payload) => {
                const newMsgId = payload.new.id;
                const senderId = payload.new.user_id;
                const content = payload.new.content;
                
                // Fetch profile details for the new message immediately
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username, full_name, role')
                    .eq('id', senderId)
                    .maybeSingle();

                setMessages(prev => {
                    // Avoid duplicates
                    if (prev.some(m => m.id === newMsgId)) return prev;

                    const newMessage: ChatMessage = {
                        id: newMsgId,
                        user_id: senderId,
                        content: content,
                        created_at: payload.new.created_at,
                        username: profile?.username || 'Unknown Agent',
                        full_name: profile?.full_name,
                        role: profile?.role
                    };
                    
                    return [...prev, newMessage];
                });
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                setIsConnected(true);
                setConnectionError(null);
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                setIsConnected(false);
                setConnectionError("Realtime Disconnected");
            }
        });

    return () => {
        supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // --- 3. Polling Fallback ---
  useEffect(() => {
    if (!user) return;

    const pollMessages = async () => {
        const { data } = await supabase
            .from('messages')
            .select(`
                id,
                content,
                created_at,
                user_id,
                profiles ( username, full_name, role )
            `)
            .order('created_at', { ascending: false })
            .limit(15);

        if (data) {
            const incoming = data.reverse().map((m: any) => ({
                id: m.id,
                user_id: m.user_id,
                content: m.content,
                created_at: m.created_at,
                username: m.profiles?.username || 'Unknown Agent',
                full_name: m.profiles?.full_name,
                role: m.profiles?.role
            }));

            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const uniqueNew = incoming.filter((m: ChatMessage) => !existingIds.has(m.id));
                if (uniqueNew.length === 0) return prev;
                const combined = [...prev, ...uniqueNew].sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                return combined;
            });
        }
    };

    const interval = setInterval(pollMessages, 3000); 
    return () => clearInterval(interval);
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    
    const content = input.trim();
    const tempId = crypto.randomUUID(); 
    
    setInput('');
    setIsLoading(true);

    const optimisticMessage: ChatMessage = {
        id: tempId,
        user_id: user.id,
        content: content,
        created_at: new Date().toISOString(),
        username: user.username,
        full_name: user.full_name,
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
          setMessages(prev => prev.filter(m => m.id !== tempId)); 
          setToast({ message: "Transmission failed", type: 'error' });
          throw error;
      }
    } catch (error: any) {
      console.error("Failed to send", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserColor = () => 'bg-gray-100 border-gray-200 text-gray-800';
  
  const getBubbleStyle = (role: string | undefined, userId: string, isMe: boolean) => {
      if (isMe) return 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm border-indigo-600 shadow-sm';
      if (role === 'grand_admin') return 'bg-[#fffbeb] border-[#fcd34d] text-[#92400e] rounded-2xl rounded-tl-sm shadow-sm';
      if (role === 'master_admin') return 'bg-blue-50 border-blue-200 text-blue-900 rounded-2xl rounded-tl-sm shadow-sm';
      if (role === 'admin') return 'bg-violet-50 border-violet-200 text-violet-900 rounded-2xl rounded-tl-sm shadow-sm';
      return `${getUserColor()} border rounded-2xl rounded-tl-sm shadow-sm`;
  };

  const RoleBadge = ({ role }: { role?: string }) => {
      const baseClasses = "flex items-center justify-center w-6 h-6 rounded-full shadow-sm border ring-2 ring-white";
      if (role === 'grand_admin') return <div className="absolute -top-3 -left-3 z-10 group"><div className={`${baseClasses} bg-amber-100 border-amber-200`}><Crown size={12} className="text-amber-600 fill-amber-600" /></div></div>;
      if (role === 'master_admin') return <div className="absolute -top-3 -left-3 z-10 group"><div className={`${baseClasses} bg-blue-50 border-blue-200`}><ShieldCheck size={12} className="text-blue-600 fill-blue-600" /></div></div>;
      if (role === 'admin') return <div className="absolute -top-3 -left-3 z-10 group"><div className={`${baseClasses} bg-violet-50 border-violet-200`}><ShieldAlert size={12} className="text-violet-600 fill-violet-600" /></div></div>;
      return <div className="absolute -top-3 -left-3 z-10 group"><div className={`${baseClasses} bg-white border-gray-200`}><UserIcon size={12} className="text-gray-400" /></div></div>;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in subpixel-antialiased">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
        <div className="flex items-center gap-3">
            <button 
                onClick={toggleNotifications}
                className={`p-2 rounded-full transition-colors ${notificationsEnabled ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title={notificationsEnabled ? "Mute Notifications" : "Enable Notifications"}
            >
                {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
            </button>
            <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'} ring-4 ring-white shadow-sm transition-colors duration-500`} title={isConnected ? "Secure Connection Active" : "Connection Lost"}></div>
        </div>
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
          const showHeader = index === 0 || messages[index - 1].user_id !== msg.user_id;
          const bubbleStyle = getBubbleStyle(msg.role, msg.user_id, isMe);
          
          return (
            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                {showHeader && (
                    <div className={`flex flex-col mb-1 ${isMe ? 'items-end' : 'items-start ml-4'}`}>
                         <div className="flex items-center">
                            {msg.full_name ? (
                                <span className="text-xs font-bold text-gray-800 block">{msg.full_name}</span>
                            ) : (
                                <span className="text-xs font-bold text-gray-500 block">{msg.username}</span>
                            )}
                         </div>
                    </div>
                )}
                <div className="relative">
                    {!isMe && <RoleBadge role={msg.role} />}
                    <div className={`relative px-5 py-3 text-sm leading-relaxed ${bubbleStyle}`}>
                        <div className="break-words font-medium">{msg.content}</div>
                        <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-indigo-200' : (msg.role === 'grand_admin' ? 'text-amber-700/60' : 'opacity-50')}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
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
               disabled={false}
             />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="px-0 w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
            >
              {isLoading ? <RefreshCw className="h-5 w-5 animate-spin text-white" /> : <Send className="h-5 w-5 text-white ml-0.5" />}
            </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;