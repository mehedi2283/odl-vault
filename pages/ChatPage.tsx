import React, { useState, useRef, useEffect } from 'react';
import { Send, Lock, Shield, User as UserIcon, Crown, AlertTriangle, ShieldCheck, ShieldAlert, Bell, BellOff } from 'lucide-react';
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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Robust Notification Permission Handling
  useEffect(() => {
    const syncNotificationState = () => {
        if ('Notification' in window) {
            // If strictly granted, we assume enabled. If the user manually muted, 
            // the toggle handler below handles the 'false' state, 
            // but here we ensure that if permission is lost, we reflect it.
            if (Notification.permission !== 'granted') {
                setNotificationsEnabled(false);
            }
        }
    };

    syncNotificationState();

    // Listen for browser-level permission changes (e.g. user changes settings tab)
    if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' as PermissionName })
            .then((permissionStatus) => {
                permissionStatus.onchange = () => {
                    const isGranted = permissionStatus.state === 'granted';
                    setNotificationsEnabled(isGranted);
                    if (isGranted) {
                         setToast({ message: "Notifications enabled by browser", type: "success" });
                         playNotificationSound();
                    }
                };
            })
            .catch(() => {
                // Fallback for browsers not supporting this specific permission query
            });
    }
  }, []);

  // Initialize Audio Context on first interaction to bypass autoplay policy
  useEffect(() => {
    const initAudio = () => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                audioContextRef.current = new AudioContext();
            }
        }
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
        // Remove listeners once initialized
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    return () => {
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
    };
  }, []);

  const playNotificationSound = async () => {
    try {
      if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) audioContextRef.current = new AudioContext();
      }

      // Resume if suspended (vital for Chrome autoplay policy)
      if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
      }

      const ctx = audioContextRef.current;
      if (!ctx) return;

      // Create a pleasant "pop" sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(130.81, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
        setToast({ message: "Notifications not supported on this device", type: 'error' });
        return;
    }

    // 1. If currently enabled, mute them.
    if (notificationsEnabled) {
        setNotificationsEnabled(false);
        setToast({ message: "Notifications muted", type: 'success' });
        return;
    }

    // 2. If disabled, try to enable.
    const currentPermission = Notification.permission;

    // Case A: Already granted in browser. User just wants to unmute in app.
    if (currentPermission === 'granted') {
        setNotificationsEnabled(true);
        setToast({ message: "Notifications active", type: 'success' });
        playNotificationSound();
        return;
    }

    // Case B: Denied in browser - must instruct user
    if (currentPermission === 'denied') {
        setToast({ message: "Notifications blocked. Please enable in browser settings.", type: 'error' });
        return;
    }

    // Case C: Default - Request permission
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            setNotificationsEnabled(true);
            setToast({ message: "System notifications enabled", type: 'success' });
            playNotificationSound();
        } else {
            setToast({ message: "Permission denied", type: 'error' });
        }
    } catch (e) {
        console.error("Notification request failed", e);
    }
  };

  const sendSystemNotification = (sender: string, text: string) => {
    // 1. Tab Title Alert
    const originalTitle = document.title;
    document.title = `(1) New Message - ${originalTitle}`;
    setTimeout(() => document.title = originalTitle, 5000);

    // 2. In-App Toast (Always show for feedback)
    setToast({ message: `New message from ${sender}`, type: 'success' });

    // 3. Native Notification
    if (notificationsEnabled && Notification.permission === 'granted') {
       try {
           new Notification(`New Message from ${sender}`, {
               body: text,
               tag: 'odl-chat',
               silent: true // We play our own sound
           });
       } catch (e) {
           console.error("Notification trigger failed", e);
       }
    }
  };

  // Standard User color is explicitly gray
  const getUserColor = (userId: string) => {
      return 'bg-gray-100 border-gray-200 text-gray-800';
  };

  const getBubbleStyle = (role: string | undefined, userId: string, isMe: boolean) => {
      if (isMe) {
          return 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm border-indigo-600 shadow-sm';
      }
      
      if (role === 'grand_admin') {
          return 'bg-[#fffbeb] border-[#fcd34d] text-[#92400e] rounded-2xl rounded-tl-sm shadow-sm';
      }

      if (role === 'master_admin') {
          return 'bg-blue-50 border-blue-200 text-blue-900 rounded-2xl rounded-tl-sm shadow-sm';
      }

      if (role === 'admin') {
          return 'bg-violet-50 border-violet-200 text-violet-900 rounded-2xl rounded-tl-sm shadow-sm';
      }
      
      // Explicit Gray for standard Users
      const colorClass = getUserColor(userId);
      return `${colorClass} border rounded-2xl rounded-tl-sm shadow-sm`;
  };

  const CustomTooltip = ({ text }: { text: string }) => (
      <div className="absolute bottom-full mb-1 left-0 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30 shadow-lg">
          {text}
      </div>
  );

  const RoleBadge = ({ role }: { role?: string }) => {
      const baseClasses = "flex items-center justify-center w-6 h-6 rounded-full shadow-sm border ring-2 ring-white";

      if (role === 'grand_admin') {
          return (
              <div className="absolute -top-3 -left-3 z-10 group cursor-help">
                  <div className={`${baseClasses} bg-amber-100 border-amber-200`}>
                      <Crown size={12} className="text-amber-600 fill-amber-600" />
                  </div>
                  <CustomTooltip text="Grand Administrator" />
              </div>
          );
      }
      if (role === 'master_admin') {
          return (
              <div className="absolute -top-3 -left-3 z-10 group cursor-help">
                  <div className={`${baseClasses} bg-blue-50 border-blue-200`}>
                      <ShieldCheck size={12} className="text-blue-600 fill-blue-600" />
                  </div>
                  <CustomTooltip text="Master Administrator" />
              </div>
          );
      }
      if (role === 'admin') {
          return (
              <div className="absolute -top-3 -left-3 z-10 group cursor-help">
                  <div className={`${baseClasses} bg-violet-50 border-violet-200`}>
                      <ShieldAlert size={12} className="text-violet-600 fill-violet-600" />
                  </div>
                  <CustomTooltip text="Administrator" />
              </div>
          );
      }
      return (
          <div className="absolute -top-3 -left-3 z-10 group cursor-help">
              <div className={`${baseClasses} bg-white border-gray-200`}>
                  <UserIcon size={12} className="text-gray-400" />
              </div>
              <CustomTooltip text="Operative" />
          </div>
      );
  };

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
            profiles ( username, full_name, role )
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
            full_name: m.profiles?.full_name,
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

    const messageChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Fetch sender details including full_name & role
        const { data } = await supabase
          .from('profiles')
          .select('username, full_name, role')
          .eq('id', payload.new.user_id)
          .single();
        
        const newMessage: ChatMessage = {
           id: payload.new.id,
           user_id: payload.new.user_id,
           content: payload.new.content,
           created_at: payload.new.created_at,
           username: data?.username || 'Unknown',
           full_name: data?.full_name,
           role: data?.role
        };
        
        // Notification Logic
        if (user.id !== payload.new.user_id) {
           playNotificationSound();
           sendSystemNotification(data?.full_name || data?.username || 'Secure Channel', payload.new.content);
        }

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

    // Subscribe to Profile Updates to reflect role changes in real-time
    const profileChannel = supabase
      .channel('public:profiles_chat')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        setMessages(prev => prev.map(msg => {
            if (msg.user_id === payload.new.id) {
                return {
                    ...msg,
                    role: payload.new.role !== undefined ? payload.new.role : msg.role,
                    full_name: payload.new.full_name !== undefined ? payload.new.full_name : msg.full_name,
                    username: payload.new.username !== undefined ? payload.new.username : msg.username
                };
            }
            return msg;
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user, notificationsEnabled]); // Re-subscribe if notifications toggle to ensure closure captures new state

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    
    // Resume audio context on user interaction (send) if suspended
    if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
    }
    
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
          throw error;
      }
    } catch (error: any) {
      console.error("Failed to send", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in subpixel-antialiased">
      {/* Toast Notification Container */}
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
            <div className={`h-2.5 w-2.5 rounded-full ${connectionError ? 'bg-rose-500' : 'bg-emerald-500'} ring-4 ring-white shadow-sm`}></div>
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
                                <div className="relative group">
                                    <span className="text-xs font-bold text-gray-800 cursor-default select-none block">
                                        {msg.full_name}
                                    </span>
                                    {/* User Tooltip for Name Hover */}
                                    <div className={`absolute bottom-full mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 shadow-lg ${isMe ? 'right-0' : 'left-0'}`}>
                                        {msg.username}
                                    </div>
                                </div>
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