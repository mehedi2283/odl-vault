import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Send, Lock, Shield, User as UserIcon, Crown, ShieldCheck, ShieldAlert, Bell, BellOff, RefreshCw, Smile, Edit2, X, Check, MoreHorizontal, Calendar, Clock, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { supabase } from '../services/supabase';
import { ChatMessage, User, ToastContextType } from '../types';
import { useOnlineUsers } from '../components/PresenceProvider';
import { AnimatePresence, motion } from 'framer-motion';

interface ChatPageProps {
  user: User | null;
}

interface SeenEntry {
  user_id: string;
  seen_at: string;
}

// Extends ChatMessage to include enriched seen_by
interface EnrichedChatMessage extends Omit<ChatMessage, 'seen_by'> {
    seen_by?: (string | SeenEntry)[]; // Supports legacy string[] and new SeenEntry[]
}

interface BasicProfile {
    id: string;
    username: string;
    full_name?: string;
}

const PAGE_SIZE = 20;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper to safely extract User ID from mixed seen_by types
const getSeenUserId = (entry: string | SeenEntry): string => {
    return typeof entry === 'string' ? entry : entry.user_id;
};

// Helper to safely extract timestamp from mixed seen_by types
const getSeenTime = (entry: string | SeenEntry): string | null => {
    return typeof entry === 'string' ? null : entry.seen_at;
};

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
  const { showToast } = useOutletContext<ToastContextType>();
  const [messages, setMessages] = useState<EnrichedChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Input State (ContentEditable)
  const [plainText, setPlainText] = useState(''); // For validation
  
  // Mention State
  const [allProfiles, setAllProfiles] = useState<BasicProfile[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0); // For keyboard nav

  // Presence from Context
  const onlineUsers = useOnlineUsers();

  // Pagination State
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Message Details Modal State
  const [detailsMessage, setDetailsMessage] = useState<EnrichedChatMessage | null>(null);
  
  // Emoji State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  
  // Notification Permission State
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return 'Notification' in window && Notification.permission === 'granted';
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for Inputs
  const inputDivRef = useRef<HTMLDivElement>(null); 
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const editEmojiPickerRef = useRef<HTMLDivElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);

  // --- Scroll Logic ---
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch profiles for mentions
  useEffect(() => {
      const fetchProfiles = async () => {
          const { data } = await supabase.from('profiles').select('id, username, full_name');
          if (data) setAllProfiles(data);
      };
      fetchProfiles();
  }, []);

  // Handle outside click for pickers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (editEmojiPickerRef.current && !editEmojiPickerRef.current.contains(event.target as Node)) {
        setShowEditEmojiPicker(false);
      }
      if (mentionListRef.current && !mentionListRef.current.contains(event.target as Node)) {
          setShowMentionList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize Edit Textarea
  useLayoutEffect(() => {
    if (editInputRef.current) {
        editInputRef.current.style.height = 'auto';
        editInputRef.current.style.height = `${editInputRef.current.scrollHeight}px`;
    }
  }, [editContent, editingId]);

  // Sync Notification Permission
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
        showToast("Notifications not supported on this device", "error");
        return;
    }

    if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            setNotificationsEnabled(true);
            showToast("Notifications enabled", "success");
        } else {
            setNotificationsEnabled(false);
            showToast("Permission denied", "error");
        }
    } else {
        setNotificationsEnabled(!notificationsEnabled);
        showToast(notificationsEnabled ? "Notifications muted" : "Notifications active", "success");
    }
  };

  // --- Data Fetching ---

  const mapMessage = (m: any): EnrichedChatMessage => ({
    id: m.id,
    user_id: m.user_id,
    content: m.content,
    created_at: m.created_at,
    updated_at: m.updated_at,
    username: m.profiles?.username || 'Unknown Agent',
    full_name: m.profiles?.full_name,
    role: m.profiles?.role,
    last_seen: m.profiles?.last_seen,
    seen_by: m.seen_by || []
  });

  const fetchMessages = async (beforeTimestamp?: string) => {
      let query = supabase
          .from('messages')
          .select(`
              id, content, created_at, updated_at, user_id, seen_by,
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

  // --- Seen Logic ---
  const markMessagesAsSeen = async (msgs: EnrichedChatMessage[]) => {
      if (!user) return;
      if (document.hidden) return; 

      // Find messages not sent by me and not seen by me
      const unseenIds = msgs
        .filter(m => {
            if (m.user_id === user.id) return false;
            // Handle both legacy string IDs and new objects
            const seenIds = (m.seen_by || []).map(getSeenUserId);
            return !seenIds.includes(user.id);
        })
        .map(m => m.id);

      if (unseenIds.length === 0) return;

      const now = new Date().toISOString();
      const newEntry: SeenEntry = { user_id: user.id, seen_at: now };

      // Optimistic Update
      setMessages(prev => prev.map(m => {
          if (unseenIds.includes(m.id)) {
              return { ...m, seen_by: [...(m.seen_by || []), newEntry] };
          }
          return m;
      }));

      // Batch Update in Supabase
      for (const msgId of unseenIds) {
          const msg = msgs.find(m => m.id === msgId);
          const currentSeen = msg?.seen_by || [];
          const newSeenBy = [...currentSeen, newEntry];
          
          await supabase
            .from('messages')
            .update({ seen_by: newSeenBy })
            .eq('id', msgId);
      }
  };

  // Trigger mark seen when messages change or window focus
  useEffect(() => {
      const handleVisibilityChange = () => {
          if (!document.hidden) markMessagesAsSeen(messages);
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Also trigger immediately on effect if visible
      if (!document.hidden && messages.length > 0) {
          const timeout = setTimeout(() => markMessagesAsSeen(messages), 1000); // 1s delay to count as 'read'
          return () => clearTimeout(timeout);
      }

      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages.length, user?.id]);

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
            const { data: profile } = await supabase.from('profiles').select('username, full_name, role, last_seen').eq('id', payload.new.user_id).maybeSingle();
            
            setMessages(prev => {
                if (prev.some(m => m.id === payload.new.id)) return prev; 
                return [...prev, {
                    id: payload.new.id,
                    user_id: payload.new.user_id,
                    content: payload.new.content,
                    created_at: payload.new.created_at,
                    updated_at: payload.new.updated_at,
                    username: profile?.username || 'Unknown Agent',
                    full_name: profile?.full_name,
                    role: profile?.role,
                    last_seen: profile?.last_seen,
                    seen_by: payload.new.seen_by || []
                }];
            });
            setTimeout(() => scrollToBottom('smooth'), 100);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { 
                ...m, 
                content: payload.new.content, 
                updated_at: payload.new.updated_at,
                seen_by: payload.new.seen_by
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
          const prevHeight = containerRef.current.scrollHeight;
          const olderMsgs = await fetchMessages(oldestMsg.created_at);
          if (olderMsgs.length < PAGE_SIZE) setHasMore(false);
          if (olderMsgs.length > 0) {
              setMessages(prev => [...olderMsgs, ...prev]);
              requestAnimationFrame(() => {
                  if (containerRef.current) {
                      containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
                  }
              });
          }
          setIsLoadingMore(false);
      }
  };

  // --- ContentEditable Helpers ---
  const handleInput = () => {
      if (!inputDivRef.current) return;
      
      const text = inputDivRef.current.innerText;
      setPlainText(text);
      
      // Detect Mention
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const node = range.startContainer;
          
          if (node.nodeType === Node.TEXT_NODE && node.textContent) {
              const textBeforeCaret = node.textContent.substring(0, range.startOffset);
              const atIndex = textBeforeCaret.lastIndexOf('@');
              
              if (atIndex !== -1) {
                  const query = textBeforeCaret.substring(atIndex + 1);
                  if (!query.includes(' ') && query.length < 30) {
                      setMentionQuery(query);
                      setShowMentionList(true);
                      setMentionIndex(0);
                      return;
                  }
              }
          }
      }
      setShowMentionList(false);
  };

  const filteredMentions = useMemo(() => {
      const availableProfiles = allProfiles.filter(p => p.id !== user?.id);
      if (!mentionQuery) return availableProfiles.slice(0, 5);
      return availableProfiles.filter(p => 
          p.username.toLowerCase().includes(mentionQuery.toLowerCase()) || 
          (p.full_name && p.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))
      ).slice(0, 5);
  }, [allProfiles, mentionQuery, user?.id]);

  const insertMention = (profile: BasicProfile) => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);
      const node = range.startContainer;

      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
          const currentPos = range.startOffset;
          const startPos = currentPos - (mentionQuery.length + 1);
          
          if (startPos >= 0) {
              range.setStart(node, startPos);
              range.setEnd(node, currentPos);
              range.deleteContents();

              const name = profile.full_name 
                ? profile.full_name.trim().replace(/\s+/g, '_') 
                : profile.username;

              const chip = document.createElement('span');
              chip.className = "bg-indigo-600 text-white rounded px-1.5 py-0.5 text-sm font-medium mx-0.5 select-none inline-block";
              chip.contentEditable = "false";
              chip.textContent = `@${name}`;

              const space = document.createTextNode('\u00A0');

              range.insertNode(space);
              range.insertNode(chip);

              range.setStartAfter(space);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              
              setPlainText(inputDivRef.current?.innerText || '');
              setShowMentionList(false);
              
              if (inputDivRef.current) inputDivRef.current.focus();
          }
      }
  };

  const insertEmoji = (emojiData: EmojiClickData) => {
      if (!inputDivRef.current) return;
      inputDivRef.current.focus();

      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const textNode = document.createTextNode(emojiData.emoji);
          range.deleteContents();
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          
          setPlainText(inputDivRef.current.innerText);
      } else {
          inputDivRef.current.innerText += emojiData.emoji;
          setPlainText(inputDivRef.current.innerText);
      }
  };

  // --- Message Sending ---
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputDivRef.current) return;
    
    const content = inputDivRef.current.innerText.trim();
    
    if (!content || !user) return;
    
    inputDivRef.current.innerHTML = '';
    setPlainText('');
    setShowEmojiPicker(false);
    setShowMentionList(false);

    const tempId = crypto.randomUUID(); 

    const optimisticMessage: EnrichedChatMessage = {
        id: tempId,
        user_id: user.id,
        content: content,
        created_at: new Date().toISOString(),
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        seen_by: [] // Initial seen by is empty
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    const { error } = await supabase.from('messages').insert({ id: tempId, user_id: user.id, content: content });
    
    if (error) {
        setMessages(prev => prev.filter(m => m.id !== tempId)); 
        showToast("Transmission failed", "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showMentionList && filteredMentions.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMentionIndex(prev => (prev + 1) % filteredMentions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMentionIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insertMention(filteredMentions[mentionIndex]);
        } else if (e.key === 'Escape') {
            setShowMentionList(false);
        }
        return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ... (Edit handlers) ...
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (editingId) saveEdit(editingId); }
  };
  const startEditing = (msg: EnrichedChatMessage) => { setEditingId(msg.id); setEditContent(msg.content); setShowEditEmojiPicker(false); };
  const cancelEditing = () => { setEditingId(null); setEditContent(''); };
  const saveEdit = async (msgId: string) => {
      if (!editContent.trim()) return;
      const now = new Date().toISOString();
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editContent, updated_at: now } : m));
      setEditingId(null);
      const { error } = await supabase.from('messages').update({ content: editContent, updated_at: now }).eq('id', msgId);
      if (error) showToast("Failed to update message", "error");
  };
  const onEditEmojiClick = (emojiData: EmojiClickData) => setEditContent(prev => prev + emojiData.emoji);

  // --- Render Helpers ---
  const getBubbleStyle = (role: string | undefined, userId: string, isMe: boolean) => {
      if (isMe) {
          if (role === 'grand_admin') return 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/20 border-transparent rounded-2xl rounded-tr-sm';
          return 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm border-indigo-600 shadow-sm';
      }
      if (role === 'grand_admin') return 'bg-[#fffbeb] border-[#fcd34d] text-[#92400e] rounded-2xl rounded-tl-sm shadow-sm';
      if (role === 'master_admin') return 'bg-blue-50 border-blue-200 text-blue-900 rounded-2xl rounded-tl-sm shadow-sm';
      if (role === 'admin') return 'bg-violet-50 border-violet-200 text-violet-900 rounded-2xl rounded-tl-sm shadow-sm';
      return 'bg-gray-100 border-gray-200 text-gray-800 border rounded-2xl rounded-tl-sm shadow-sm';
  };

  const getProfileName = (id: string) => {
      if (id === user?.id) return 'You';
      const p = allProfiles.find(p => p.id === id);
      return p ? (p.full_name || p.username) : 'Unknown Agent';
  };

  const RoleBadge = ({ role }: { role?: string }) => {
      const baseClasses = "flex items-center justify-center w-6 h-6 rounded-full shadow-sm border ring-2 ring-white";
      if (role === 'grand_admin') return <div className="absolute -top-3 -left-3 z-10 group"><div className={`${baseClasses} bg-amber-100 border-amber-200`}><Crown size={12} className="text-amber-600 fill-amber-600" /></div></div>;
      if (role === 'master_admin') return <div className="absolute -top-3 -left-3 z-10 group"><div className={`${baseClasses} bg-blue-50 border-blue-200`}><ShieldCheck size={12} className="text-blue-600 fill-blue-600" /></div></div>;
      if (role === 'admin') return <div className="absolute -top-3 -left-3 z-10 group"><div className={`${baseClasses} bg-violet-50 border-violet-200`}><ShieldAlert size={12} className="text-violet-600 fill-violet-600" /></div></div>;
      return <div className="absolute -top-3 -left-3 z-10 group"><div className={`${baseClasses} bg-white border-gray-200`}><UserIcon size={12} className="text-gray-400" /></div></div>;
  };

  // Parse text for highlights
  const renderMessageContent = (content: string, isMe: boolean) => {
      const parts = content.split(/(@[\w.@\-\']+)/g);
      return parts.map((part, i) => {
          if (part.startsWith('@')) {
              if (part.length > 1) {
                  return (
                      <span key={i} className={`font-bold ${isMe ? 'bg-white/20 text-white' : 'bg-indigo-600 text-white shadow-sm'} px-1.5 py-0.5 rounded-md mx-0.5 inline-block text-xs`}>
                          {part}
                      </span>
                  );
              }
          }
          return part;
      });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in subpixel-antialiased">
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
        className="flex-1 overflow-y-auto p-6 pb-20 space-y-6 bg-[#f9fafb] relative scroll-smooth"
      >
        {isLoadingMore && <div className="flex justify-center py-2"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>}
        {connectionError && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20"><div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-lg text-sm border border-rose-100 shadow-sm flex items-center"><AlertTriangle className="h-4 w-4 mr-2" />{connectionError}</div></div>}
        {messages.length === 0 && !connectionError && !isLoading && <div className="flex flex-col items-center justify-center h-full opacity-30"><Shield size={64} className="text-gray-400 mb-4" /><p className="text-gray-500 font-medium">Secure Channel Ready</p></div>}

        {messages.map((msg, index) => {
          const isMe = msg.user_id === user?.id;
          const showHeader = index === 0 || messages[index - 1].user_id !== msg.user_id;
          const bubbleStyle = getBubbleStyle(msg.role, msg.user_id, isMe);
          const isUserOnline = onlineUsers.has(msg.user_id);
          const metaTextColor = isMe ? (msg.role === 'grand_admin' ? 'text-orange-100/90' : 'text-indigo-200') : (msg.role === 'grand_admin' ? 'text-amber-700/60' : 'opacity-50');
          const dateLabel = getDateLabel(msg.created_at);
          const prevDateLabel = index > 0 ? getDateLabel(messages[index-1].created_at) : null;
          const showDateDivider = dateLabel !== prevDateLabel;
          const isEditing = editingId === msg.id;

          // Seen By Logic (excluding sender)
          const seenCount = msg.seen_by?.filter(entry => getSeenUserId(entry) !== msg.user_id)?.length || 0;
          const showSeen = isMe && seenCount > 0;

          return (
            <React.Fragment key={msg.id}>
                {showDateDivider && <div className="flex items-center justify-center py-4"><div className="bg-gray-200 h-px w-16"></div><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3">{dateLabel}</span><div className="bg-gray-200 h-px w-16"></div></div>}

                <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group/msg`}>
                  <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {showHeader && (
                        <div className={`flex flex-col mb-1 ${isMe ? 'items-end' : 'items-start ml-4'}`}>
                             <div className="flex items-center gap-1.5">
                                {msg.full_name ? <span className="text-xs font-bold text-gray-800 block">{msg.full_name}</span> : <span className="text-xs font-bold text-gray-500 block">{msg.username}</span>}
                                {isUserOnline && !isMe ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white ring-1 ring-emerald-100" title="Online"></div> : !isMe && msg.last_seen ? <span className="text-[10px] text-gray-400 font-normal ml-1" title={new Date(msg.last_seen).toLocaleString()}>{formatLastSeen(msg.last_seen)}</span> : null}
                             </div>
                        </div>
                    )}
                    <div className="relative w-full">
                        {!isMe && <RoleBadge role={msg.role} />}
                        <div className={`relative px-5 py-3 text-sm leading-relaxed transition-all w-full ${bubbleStyle}`}>
                            {!isEditing ? (
                                <>
                                    <div className="break-words break-all font-medium whitespace-pre-wrap">{renderMessageContent(msg.content, isMe)}</div>
                                    <div className={`text-[9px] mt-1 text-right flex items-center justify-end gap-1 ${metaTextColor}`}>
                                        {msg.updated_at && <span className="italic opacity-80 mr-1" title={`Updated: ${new Date(msg.updated_at).toLocaleString()}`}>updated at {new Date(msg.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                    <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-all scale-90 group-hover/msg:scale-100">
                                      {isMe && <button onClick={() => setDetailsMessage(msg)} className="p-1.5 rounded-full bg-white shadow-sm border border-gray-200 text-gray-400 hover:text-indigo-600 transition-colors" title="Message Details"><MoreHorizontal size={12} /></button>}
                                    </div>
                                </>
                            ) : (
                                <div className="w-full min-w-[200px]">
                                    <textarea ref={editInputRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} onKeyDown={handleEditKeyDown} className="w-full bg-black/10 dark:bg-white/10 text-inherit border-0 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-white/50 resize-none overflow-hidden leading-relaxed break-all whitespace-pre-wrap" style={{ minHeight: '60px' }} autoFocus />
                                    <div className="flex justify-end gap-2 mt-2 items-center relative">
                                        <div className="relative" ref={editEmojiPickerRef}>
                                            <button onClick={() => setShowEditEmojiPicker(!showEditEmojiPicker)} className="p-1 hover:bg-black/10 rounded text-inherit opacity-70 hover:opacity-100" title="Add Emoji"><Smile size={14} /></button>
                                            {showEditEmojiPicker && <div className="absolute bottom-full mb-2 right-0 z-50 shadow-2xl rounded-xl border border-gray-100 text-left overflow-hidden origin-bottom-right"><EmojiPicker onEmojiClick={onEditEmojiClick} theme={Theme.LIGHT} width={280} height={350} previewConfig={{ showPreview: false }} /></div>}
                                        </div>
                                        <button onClick={cancelEditing} className="p-1 hover:bg-black/10 rounded opacity-70 hover:opacity-100"><X size={14} /></button>
                                        <button onClick={() => saveEdit(msg.id)} className="p-1 hover:bg-black/10 rounded opacity-70 hover:opacity-100"><Check size={14} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Seen Indicator */}
                    {showSeen && (
                        <div className="flex items-center gap-1 mt-1 mr-1">
                            <CheckCircle2 className="w-3 h-3 text-indigo-400/70" />
                            <span className="text-[9px] font-medium text-gray-400 cursor-default">Seen by {seenCount}</span>
                        </div>
                    )}
                  </div>
                </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-100 p-5 z-20">
        <form onSubmit={handleSend} className="relative flex items-end gap-2 max-w-5xl mx-auto">
             
             {/* Mention List Popup */}
             <AnimatePresence>
                 {showMentionList && filteredMentions.length > 0 && (
                     <motion.div 
                        ref={mentionListRef}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-14 mb-2 w-72 max-w-[80vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
                     >
                         <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase">Mention User</div>
                         {filteredMentions.map((profile, idx) => (
                             <button
                                key={profile.id}
                                type="button"
                                onClick={() => insertMention(profile)}
                                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${idx === mentionIndex ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-gray-50 text-gray-700'}`}
                             >
                                 <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                     {profile.username[0].toUpperCase()}
                                 </div>
                                 <div className="flex flex-col min-w-0 overflow-hidden">
                                     <span className="font-semibold leading-tight truncate block">{profile.username}</span>
                                     {profile.full_name && <span className="text-xs text-gray-400 truncate block">{profile.full_name}</span>}
                                 </div>
                             </button>
                         ))}
                     </motion.div>
                 )}
             </AnimatePresence>

             {/* Emoji Picker Trigger */}
             <div className="relative flex-shrink-0" ref={emojiPickerRef}>
                 <button 
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`h-[50px] w-[50px] flex items-center justify-center rounded-xl transition-colors border ${showEmojiPicker ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-transparent'}`}
                 >
                     <Smile size={20} />
                 </button>
                 {showEmojiPicker && (
                     <div className="absolute bottom-16 left-0 z-50 shadow-2xl rounded-2xl border border-gray-100">
                         <EmojiPicker onEmojiClick={insertEmoji} theme={Theme.LIGHT} width={300} height={400} previewConfig={{ showPreview: false }} />
                     </div>
                 )}
             </div>

             <div className="flex-1 relative">
                <div
                    ref={inputDivRef}
                    contentEditable
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    className="w-full pl-5 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all duration-200 min-h-[50px] max-h-[120px] overflow-y-auto break-all whitespace-pre-wrap leading-normal empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                    data-placeholder="Transmit secure message... (Use @ to mention)"
                />
             </div>
             
            <Button 
              type="submit" 
              disabled={isLoading || !plainText.trim()}
              className="h-[50px] w-[50px] px-0 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex-shrink-0"
            >
              {isLoading ? <RefreshCw className="h-5 w-5 animate-spin text-white" /> : <Send className="h-5 w-5 text-white ml-0.5" />}
            </Button>
        </form>
      </div>

      {/* Message Details Modal */}
      <Modal isOpen={!!detailsMessage} onClose={() => setDetailsMessage(null)} title="Message Details">
         <div className="space-y-6">
             <div className="grid grid-cols-2 gap-4">
                 <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                     <div className="flex items-center gap-2 mb-2 text-gray-500">
                         <Calendar className="w-4 h-4" />
                         <span className="text-xs font-bold uppercase tracking-wider">Sent</span>
                     </div>
                     <p className="text-sm font-semibold text-gray-900">
                         {detailsMessage ? new Date(detailsMessage.created_at).toLocaleDateString() : '-'}
                     </p>
                     <p className="text-xs text-gray-400">
                         {detailsMessage ? new Date(detailsMessage.created_at).toLocaleTimeString() : '-'}
                     </p>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                     <div className="flex items-center gap-2 mb-2 text-gray-500">
                         <Clock className="w-4 h-4" />
                         <span className="text-xs font-bold uppercase tracking-wider">Edited</span>
                     </div>
                     <p className="text-sm font-semibold text-gray-900">
                         {detailsMessage?.updated_at ? new Date(detailsMessage.updated_at).toLocaleDateString() : 'Never'}
                     </p>
                     {detailsMessage?.updated_at && (
                        <p className="text-xs text-gray-400">
                            {new Date(detailsMessage.updated_at).toLocaleTimeString()}
                        </p>
                     )}
                 </div>
             </div>

             <div>
                 <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2 text-gray-500">
                         <Eye className="w-4 h-4" />
                         <span className="text-xs font-bold uppercase tracking-wider">Read Receipts</span>
                     </div>
                     <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
                         {detailsMessage?.seen_by?.filter(entry => getSeenUserId(entry) !== user?.id).length || 0} Total
                     </span>
                 </div>
                 
                 <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm max-h-[200px] overflow-y-auto">
                     {detailsMessage?.seen_by && detailsMessage.seen_by.filter(entry => getSeenUserId(entry) !== user?.id).length > 0 ? (
                         <div className="divide-y divide-gray-50">
                             {detailsMessage.seen_by.filter(entry => getSeenUserId(entry) !== user?.id).map((entry, idx) => {
                                 const uid = getSeenUserId(entry);
                                 const seenAt = getSeenTime(entry);
                                 return (
                                     <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                                         <div className="flex items-center gap-3">
                                             <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                 {getProfileName(uid)[0].toUpperCase()}
                                             </div>
                                             <span className="text-sm font-medium text-gray-700">{getProfileName(uid)}</span>
                                         </div>
                                         <div className="flex flex-col items-end">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-0.5" />
                                            {seenAt && (
                                                <>
                                                    <span className="text-[10px] text-gray-400">{new Date(seenAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    <span className="text-[9px] text-gray-300">{new Date(seenAt).toLocaleDateString()}</span>
                                                </>
                                            )}
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>
                     ) : (
                         <div className="p-8 text-center text-gray-400">
                             <Eye className="w-8 h-8 mx-auto mb-2 opacity-20" />
                             <p className="text-xs">Not seen by anyone yet.</p>
                         </div>
                     )}
                 </div>
             </div>
             
             <div className="flex gap-3 pt-6 mt-4 border-t border-gray-100">
                 {detailsMessage && detailsMessage.user_id === user?.id && (Date.now() - new Date(detailsMessage.created_at).getTime() < EDIT_WINDOW_MS) && (
                    <button 
                        onClick={() => {
                            if (detailsMessage) startEditing(detailsMessage);
                            setDetailsMessage(null);
                        }}
                        className="flex-1 flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Message
                    </button>
                 )}
                 <button 
                    onClick={() => setDetailsMessage(null)}
                    className={`flex items-center justify-center px-4 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold rounded-xl transition-all ${
                        detailsMessage && detailsMessage.user_id === user?.id && (Date.now() - new Date(detailsMessage.created_at).getTime() < EDIT_WINDOW_MS) 
                        ? 'flex-1' 
                        : 'w-full'
                    }`}
                >
                    Close
                </button>
             </div>
         </div>
      </Modal>
    </div>
  );
};

export default ChatPage;