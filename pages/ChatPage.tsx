import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Send, Lock, Shield, User as UserIcon, Crown, AlertTriangle, ShieldCheck, ShieldAlert, Bell, BellOff, RefreshCw, Smile, Edit2, X, Check, Users } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import Button from '../components/Button';
import Toast from '../components/Toast';
import { supabase } from '../services/supabase';
import { ChatMessage, User } from '../types';
import { useOnlineUsers } from '../components/PresenceProvider';

interface ChatPageProps {
  user: User | null;
}

const PAGE_SIZE = 20;
const EDIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Helper for Smart Date Grouping
const getDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
  
  // Check if within last 7 days
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  if (diffDays <= 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
};

// Helper for Last Seen
const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'Offline';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
};

const ChatPage: React.FC<ChatPageProps> = ({ user }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Presence from Context
  const onlineUsers = useOnlineUsers();

  // Pagination State
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Emoji State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  
  // Notification Permission State
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return 'Notification' in window && Notification.permission === 'granted';
  });
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null); // Changed to TextArea Ref
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const editEmojiPickerRef = useRef<HTMLDivElement>(null);

  // --- Scroll Logic ---
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Handle outside click for emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (editEmojiPickerRef.current && !editEmojiPickerRef.current.contains(event.target as Node)) {
        setShowEditEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize Edit Textarea
  useLayoutEffect(() => {
    if (editInputRef.current) {
        // Reset height to auto to correctly calculate scrollHeight for shrinking content
        editInputRef.current.style.height = 'auto';
        // Set new height based on scrollHeight
        editInputRef.current.style.height = `${editInputRef.current.scrollHeight}px`;
    }
  }, [editContent, editingId]);

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
        setNotificationsEnabled(!notificationsEnabled);
        setToast({ message: notificationsEnabled ? "Notifications muted" : "Notifications active", type: 'success' });
    }
  };

  // --- Data Fetching ---

  const mapMessage = (m: any): ChatMessage => ({
    id: m.id,
    user_id: m.user_id,
    content: m.content,
    created_at: m.created_at,
    updated_at: m.updated_at,
    username: m.profiles?.username || 'Unknown Agent',
    full_name: m.profiles?.full_name,
    role: m.profiles?.role,
    last_seen: m.profiles?.last_seen // Map the last seen
  });

  const fetchMessages = async (beforeTimestamp?: string) => {
      // Added last_seen to selection
      let query = supabase
          .from('messages')
          .select(`
              id, content, created_at, updated_at, user_id,
              profiles ( username, full_name, role, last_seen )
          `)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

      if (beforeTimestamp) {
          query = query.lt('created_at', beforeTimestamp);
      }

      const { data, error } = await query;

      if (error) {
          console.error("Fetch error:", error);
          setConnectionError("Failed to load messages. Schema might need update.");
          return [];
      }
      
      return (data || []).map(mapMessage).reverse();
  };

  // Initial Load
  useEffect(() => {
      if (!user) return;
      
      const loadInitial = async () => {
          setIsLoading(true);
          const initialMsgs = await fetchMessages();
          setMessages(initialMsgs);
          if (initialMsgs.length < PAGE_SIZE) setHasMore(false);
          setIsLoading(false);
          // Wait for DOM paint then scroll
          setTimeout(() => scrollToBottom('auto'), 100);
      };

      loadInitial();

      // Realtime Subscription
      const channel = supabase.channel('public:room_001')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
            // Fetch profile for new message
            const { data: profile } = await supabase.from('profiles').select('username, full_name, role, last_seen').eq('id', payload.new.user_id).maybeSingle();
            
            setMessages(prev => {
                if (prev.some(m => m.id === payload.new.id)) return prev; // Dedup
                return [...prev, {
                    id: payload.new.id,
                    user_id: payload.new.user_id,
                    content: payload.new.content,
                    created_at: payload.new.created_at,
                    updated_at: payload.new.updated_at,
                    username: profile?.username || 'Unknown Agent',
                    full_name: profile?.full_name,
                    role: profile?.role,
                    last_seen: profile?.last_seen
                }];
            });
            // Auto scroll on new message
            setTimeout(() => scrollToBottom('smooth'), 100);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
            // Update local message content live
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { 
                ...m, 
                content: payload.new.content, 
                updated_at: payload.new.updated_at 
            } : m));
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') { setIsConnected(true); setConnectionError(null); }
            else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') { setIsConnected(false); setConnectionError("Realtime Disconnected"); }
        });

      return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Infinite Scroll Handler
  const handleScroll = async () => {
      if (!containerRef.current || isLoadingMore || !hasMore) return;
      
      if (containerRef.current.scrollTop === 0) {
          setIsLoadingMore(true);
          const oldestMsg = messages[0];
          if (!oldestMsg) { setIsLoadingMore(false); return; }

          // Capture scroll height before adding new items
          const prevHeight = containerRef.current.scrollHeight;

          const olderMsgs = await fetchMessages(oldestMsg.created_at);
          
          if (olderMsgs.length < PAGE_SIZE) setHasMore(false);
          
          if (olderMsgs.length > 0) {
              setMessages(prev => [...olderMsgs, ...prev]);
              
              // Restore scroll position
              requestAnimationFrame(() => {
                  if (containerRef.current) {
                      containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
                  }
              });
          }
          
          setIsLoadingMore(false);
      }
  };

  // --- Message Sending ---
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !user) return;
    
    const content = input.trim();
    const tempId = crypto.randomUUID(); 
    
    setInput('');
    setShowEmojiPicker(false);
    
    // Reset height of textarea if necessary
    if (inputRef.current) {
        inputRef.current.style.height = 'auto';
    }

    // Optimistic UI
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
    setTimeout(() => scrollToBottom('smooth'), 50);

    const { error } = await supabase.from('messages').insert({ id: tempId, user_id: user.id, content: content });
    
    if (error) {
        setMessages(prev => prev.filter(m => m.id !== tempId)); 
        setToast({ message: "Transmission failed", type: 'error' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (editingId) saveEdit(editingId);
    }
  };

  // --- Emoji Handler ---
  const onEmojiClick = (emojiData: EmojiClickData) => {
      const start = inputRef.current?.selectionStart || 0;
      const end = inputRef.current?.selectionEnd || 0;
      const newText = input.substring(0, start) + emojiData.emoji + input.substring(end);
      
      setInput(newText);
      
      // Restore focus and cursor position
      setTimeout(() => {
          if (inputRef.current) {
              inputRef.current.focus();
              const newCursorPos = start + emojiData.emoji.length;
              inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
      }, 0);
  };

  const onEditEmojiClick = (emojiData: EmojiClickData) => {
    setEditContent(prev => prev + emojiData.emoji);
  };

  // --- Edit Handlers ---
  const startEditing = (msg: ChatMessage) => {
      setEditingId(msg.id);
      setEditContent(msg.content);
      setShowEditEmojiPicker(false);
  };

  const cancelEditing = () => {
      setEditingId(null);
      setEditContent('');
  };

  const saveEdit = async (msgId: string) => {
      if (!editContent.trim()) return;
      
      const now = new Date().toISOString();
      
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editContent, updated_at: now } : m));
      setEditingId(null);

      // Restored updated_at payload
      const { error } = await supabase.from('messages').update({ content: editContent, updated_at: now }).eq('id', msgId);
      
      if (error) {
          setToast({ message: "Failed to update message", type: 'error' });
      }
  };

  // --- Render Helpers ---
  const getBubbleStyle = (role: string | undefined, userId: string, isMe: boolean) => {
      if (isMe) {
          // Special Gold Vibe for Grand Admin when it's "Me"
          if (role === 'grand_admin') {
              return 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/20 border-transparent rounded-2xl rounded-tr-sm';
          }
          // Standard "Me" style
          return 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm border-indigo-600 shadow-sm';
      }
      
      // Styles for "Them"
      if (role === 'grand_admin') return 'bg-[#fffbeb] border-[#fcd34d] text-[#92400e] rounded-2xl rounded-tl-sm shadow-sm';
      if (role === 'master_admin') return 'bg-blue-50 border-blue-200 text-blue-900 rounded-2xl rounded-tl-sm shadow-sm';
      if (role === 'admin') return 'bg-violet-50 border-violet-200 text-violet-900 rounded-2xl rounded-tl-sm shadow-sm';
      return 'bg-gray-100 border-gray-200 text-gray-800 border rounded-2xl rounded-tl-sm shadow-sm';
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
            <div className="flex items-center mt-1 gap-3">
               <div className="flex items-center">
                  <Lock className="h-3 w-3 text-emerald-500 mr-1.5" />
                  <p className="text-xs text-gray-500 font-medium">Encrypted Team Comms</p>
               </div>
               {onlineUsers.size > 0 && (
                   <div className="flex items-center bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></div>
                      <p className="text-[10px] font-bold text-emerald-700">{onlineUsers.size} Online</p>
                   </div>
               )}
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

      {/* Messages Area */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f9fafb] relative scroll-smooth"
      >
        {isLoadingMore && (
            <div className="flex justify-center py-2">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        )}

        {connectionError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-lg text-sm border border-rose-100 shadow-sm flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {connectionError}
                </div>
            </div>
        )}

        {messages.length === 0 && !connectionError && !isLoading && (
             <div className="flex flex-col items-center justify-center h-full opacity-30">
                 <Shield size={64} className="text-gray-400 mb-4" />
                 <p className="text-gray-500 font-medium">Secure Channel Ready</p>
             </div>
        )}

        {messages.map((msg, index) => {
          const isMe = msg.user_id === user?.id;
          const showHeader = index === 0 || messages[index - 1].user_id !== msg.user_id;
          const bubbleStyle = getBubbleStyle(msg.role, msg.user_id, isMe);
          const isUserOnline = onlineUsers.has(msg.user_id);
          
          // Determine Text Color for Meta Info based on bubble type
          const metaTextColor = isMe 
            ? (msg.role === 'grand_admin' ? 'text-orange-100/90' : 'text-indigo-200') 
            : (msg.role === 'grand_admin' ? 'text-amber-700/60' : 'opacity-50');

          // Date Grouping
          const dateLabel = getDateLabel(msg.created_at);
          const prevDateLabel = index > 0 ? getDateLabel(messages[index-1].created_at) : null;
          const showDateDivider = dateLabel !== prevDateLabel;

          // Edit Permission (10 mins)
          const canEdit = isMe && (Date.now() - new Date(msg.created_at).getTime() < EDIT_WINDOW_MS);
          const isEditing = editingId === msg.id;

          return (
            <React.Fragment key={msg.id}>
                {showDateDivider && (
                    <div className="flex items-center justify-center py-4">
                        <div className="bg-gray-200 h-px w-16"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3">{dateLabel}</span>
                        <div className="bg-gray-200 h-px w-16"></div>
                    </div>
                )}

                <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group/msg`}>
                  <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {showHeader && (
                        <div className={`flex flex-col mb-1 ${isMe ? 'items-end' : 'items-start ml-4'}`}>
                             <div className="flex items-center gap-1.5">
                                {msg.full_name ? (
                                    <span className="text-xs font-bold text-gray-800 block">{msg.full_name}</span>
                                ) : (
                                    <span className="text-xs font-bold text-gray-500 block">{msg.username}</span>
                                )}
                                {isUserOnline && !isMe ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white ring-1 ring-emerald-100" title="Online"></div>
                                ) : !isMe && msg.last_seen ? (
                                    <span className="text-[10px] text-gray-400 font-normal ml-1" title={new Date(msg.last_seen).toLocaleString()}>
                                        {formatLastSeen(msg.last_seen)}
                                    </span>
                                ) : null}
                             </div>
                        </div>
                    )}
                    <div className="relative w-full">
                        {!isMe && <RoleBadge role={msg.role} />}
                        
                        <div className={`relative px-5 py-3 text-sm leading-relaxed transition-all w-full ${bubbleStyle}`}>
                            {!isEditing ? (
                                <>
                                    <div className="break-words break-all font-medium whitespace-pre-wrap">{msg.content}</div>
                                    <div className={`text-[9px] mt-1 text-right flex items-center justify-end gap-1 ${metaTextColor}`}>
                                        {msg.updated_at && (
                                            <span 
                                              className="italic opacity-80 mr-1" 
                                              title={`Updated: ${new Date(msg.updated_at).toLocaleString()}`}
                                            >
                                                updated at {new Date(msg.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        )}
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                    
                                    {/* Edit Trigger Icon */}
                                    {canEdit && (
                                        <button 
                                            onClick={() => startEditing(msg)}
                                            className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white shadow-sm border border-gray-200 text-gray-400 hover:text-indigo-600 opacity-0 group-hover/msg:opacity-100 transition-all scale-90 hover:scale-100"
                                            title="Edit Message"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                    )}
                                </>
                            ) : (
                                // Inline Editor
                                <div className="w-full min-w-[200px]">
                                    <textarea 
                                        ref={editInputRef}
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        className="w-full bg-black/10 dark:bg-white/10 text-inherit border-0 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-white/50 resize-none overflow-hidden leading-relaxed break-all whitespace-pre-wrap"
                                        style={{ minHeight: '60px' }}
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2 mt-2 items-center relative">
                                        {/* Edit Emoji Picker */}
                                        <div className="relative" ref={editEmojiPickerRef}>
                                            <button 
                                                onClick={() => setShowEditEmojiPicker(!showEditEmojiPicker)}
                                                className="p-1 hover:bg-black/10 rounded text-inherit opacity-70 hover:opacity-100"
                                                title="Add Emoji"
                                            >
                                                <Smile size={14} />
                                            </button>
                                            {showEditEmojiPicker && (
                                                <div className="absolute bottom-full mb-2 right-0 z-50 shadow-2xl rounded-xl border border-gray-100 text-left overflow-hidden origin-bottom-right">
                                                    <EmojiPicker 
                                                        onEmojiClick={onEditEmojiClick}
                                                        theme={Theme.LIGHT}
                                                        width={280}
                                                        height={350}
                                                        previewConfig={{ showPreview: false }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={cancelEditing} className="p-1 hover:bg-black/10 rounded opacity-70 hover:opacity-100"><X size={14} /></button>
                                        <button onClick={() => saveEdit(msg.id)} className="p-1 hover:bg-black/10 rounded opacity-70 hover:opacity-100"><Check size={14} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                  </div>
                </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-100 p-5 z-20">
        <form onSubmit={handleSend} className="relative flex items-end gap-3 max-w-5xl mx-auto">
             
             {/* Emoji Picker Trigger */}
             <div className="relative" ref={emojiPickerRef}>
                 <button 
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-3 rounded-xl transition-colors mb-0.5 ${showEmojiPicker ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                 >
                     <Smile size={20} />
                 </button>
                 {showEmojiPicker && (
                     <div className="absolute bottom-16 left-0 z-50 shadow-2xl rounded-2xl border border-gray-100">
                         <EmojiPicker 
                            onEmojiClick={onEmojiClick}
                            theme={Theme.LIGHT}
                            width={300}
                            height={400}
                            previewConfig={{ showPreview: false }}
                         />
                     </div>
                 )}
             </div>

             <textarea
               ref={inputRef}
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder="Transmit secure message..."
               className="w-full pl-5 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all duration-200 mb-0.5 resize-none min-h-[50px] max-h-[120px] break-all whitespace-pre-wrap"
               rows={1}
             />
             
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="px-0 w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all mb-0.5 flex-shrink-0"
            >
              {isLoading ? <RefreshCw className="h-5 w-5 animate-spin text-white" /> : <Send className="h-5 w-5 text-white ml-0.5" />}
            </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;