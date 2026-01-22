import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { LayoutDashboard, LogOut, Menu, X, Crown, MessageSquare, Flame, Box, Users } from 'lucide-react';
import { RoutePath, User, ToastContextType } from '../types';
import CommandPalette from './CommandPalette';
import InactivityLock from './InactivityLock';
import StealthMode from './StealthMode';
import SessionTerminal from './SessionTerminal';
import Toast from './Toast';
import { supabase } from '../services/supabase';
import { PresenceProvider } from './PresenceProvider';

interface LayoutProps {
  children?: React.ReactNode;
  onLogout: () => void;
  user: User | null;
}

interface ToastData {
  id: string;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'mention';
  role?: string;
}

const Layout: React.FC<LayoutProps> = ({ onLogout, user }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  
  // Unified Toast State
  const [toasts, setToasts] = useState<ToastData[]>([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Helper to add toast - Exposed via Context
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'mention' = 'success', title?: string) => {
      const id = crypto.randomUUID();
      setToasts(prev => [...prev, { id, message, title, type, role: undefined }]);
      // Log to terminal
      window.dispatchEvent(new CustomEvent('odl-log', { detail: { message: `TOAST: ${message}`, type } }));
  }, []);

  // Internal helper for chat notifications (includes role)
  const addChatToast = useCallback((message: string, title?: string, role?: string, type: 'success' | 'mention' = 'success') => {
      const id = crypto.randomUUID();
      setToasts(prev => [...prev, { id, message, title, role, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Keep ref updated for event listener access
  useEffect(() => {
    locationRef.current = location;
    // Log navigation
    window.dispatchEvent(new CustomEvent('odl-log', { detail: { message: `NAVIGATE: ${location.pathname}`, type: 'system' } }));
  }, [location]);

  // --- Password Reset Listener (Grand Admin Only) ---
  useEffect(() => {
      if (user?.role !== 'grand_admin') return;

      const channel = supabase.channel('password_resets_monitor')
        .on(
           'postgres_changes',
           { event: 'INSERT', schema: 'public', table: 'password_resets' },
           (payload) => {
               if (payload.new.status === 'pending') {
                   showToast(`Password Reset Requested: ${payload.new.email}`, 'info', 'System Alert');
                   window.dispatchEvent(new CustomEvent('odl-log', { detail: { message: `AUTH_ALERT: Reset request for ${payload.new.email}`, type: 'warn' } }));
               }
           }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [user, showToast]);

  // --- Global Notification & Audio Logic ---
  useEffect(() => {
    const initAudio = () => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) audioContextRef.current = new AudioContext();
        }
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
        }
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);

    return () => {
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
    };
  }, []);

  const playNotificationSound = async (isMention = false) => {
      try {
        if (!audioContextRef.current) return;
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (isMention) {
            // High pitch double beep for mentions
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.15); // C#6
            
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } else {
            // Standard blob sound
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(130.81, ctx.currentTime + 0.3);
            
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        }
      } catch (e) { /* ignore audio errors */ }
  };

  useEffect(() => {
      if (!user) return;

      const channel = supabase.channel('global_notifications')
          .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'messages' },
              async (payload) => {
                  // Ignore own messages
                  if (payload.new.user_id === user.id) return;

                  const isChatOpen = locationRef.current.pathname === '/chat';
                  const isHidden = document.hidden; 
                  
                  // Check for Mention
                  const content = payload.new.content || '';
                  
                  // Support both @username and @Full_Name
                  const usernameTag = `@${user.username}`;
                  const nameTag = user.full_name ? `@${user.full_name.trim().replace(/\s+/g, '_')}` : null;

                  const isMentioned = content.includes(usernameTag) || (!!nameTag && content.includes(nameTag));

                  // If user is actively looking at chat AND not mentioned, do nothing
                  if (isChatOpen && !isHidden && !isMentioned) return;

                  // 1. Fetch Sender Details (Name AND Role)
                  const { data: sender } = await supabase
                      .from('profiles')
                      .select('username, full_name, role')
                      .eq('id', payload.new.user_id)
                      .single();
                  
                  const senderName = sender?.full_name || sender?.username || 'Secure Channel';
                  const senderRole = sender?.role || 'user';
                  const msgPreview = content.length > 50 ? content.substring(0, 50) + '...' : content;

                  // 2. Play Sound
                  playNotificationSound(isMentioned);

                  // 3. System Notification
                  if (Notification.permission === 'granted') {
                      try {
                          const roleLabel = senderRole === 'grand_admin' ? 'Grand Admin' : 
                                            senderRole === 'master_admin' ? 'Master Admin' :
                                            senderRole === 'admin' ? 'Admin' : 'Operative';
                          
                          const title = isMentioned ? `[MENTIONED] ${senderName}` : `[${roleLabel}] ${senderName}`;

                          const notif = new Notification(title, {
                              body: msgPreview,
                              tag: 'odl-chat',
                              icon: '/favicon.ico',
                              requireInteraction: isMentioned 
                          });
                          notif.onclick = () => {
                              window.focus();
                              notif.close();
                              navigate('/chat');
                          };
                      } catch (e) {
                          console.warn('System notification failed', e);
                      }
                  }

                  // 4. In-App Toast
                  if (!isChatOpen || isMentioned) {
                      addChatToast(msgPreview, senderName, senderRole, isMentioned ? 'mention' : 'success');
                  }

                  // 5. Title Alert
                  const originalTitle = document.title;
                  document.title = isMentioned ? `(!) YOU WERE MENTIONED` : `(1) New Message`;
                  setTimeout(() => document.title = originalTitle, 5000);
              }
          )
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [user, navigate, addChatToast]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const navItems = [
    { name: 'Vault Dashboard', path: RoutePath.DASHBOARD, icon: LayoutDashboard },
    { name: 'Team Comms', path: '/chat', icon: MessageSquare },
    { name: 'Dead Drop', path: RoutePath.DEAD_DROP, icon: Flame },
    { name: 'Operatives', path: RoutePath.USERS, icon: Users },
  ];

  const getRoleLabel = () => {
    if (user?.role === 'grand_admin') return 'Grand Administrator';
    if (user?.role === 'master_admin') return 'Master Administrator';
    if (user?.role === 'admin') return 'Administrator';
    return 'Operative';
  };

  const getRoleColor = () => {
    if (user?.role === 'grand_admin') return 'text-amber-400';
    if (user?.role === 'master_admin') return 'text-blue-400';
    if (user?.role === 'admin') return 'text-indigo-400';
    return 'text-emerald-400';
  };

  const getRoleBg = () => {
    if (user?.role === 'grand_admin') return 'bg-amber-400';
    if (user?.role === 'master_admin') return 'bg-blue-400';
    if (user?.role === 'admin') return 'bg-indigo-400';
    return 'bg-emerald-400';
  };

  const displayName = user?.full_name || user?.username || 'User';

  const contextValue: ToastContextType = { showToast };

  return (
    <PresenceProvider user={user}>
        <div className="h-screen bg-gray-50 flex font-sans text-gray-900 overflow-hidden">
        
        {/* Portal for Stacked Toasts */}
        {createPortal(
            <div className="fixed bottom-6 right-6 z-[10001] flex flex-col gap-2 pointer-events-none items-end w-full max-w-sm">
                <AnimatePresence mode="popLayout">
                    {toasts.map((t) => (
                        <Toast 
                            key={t.id}
                            title={t.title}
                            message={t.message} 
                            type={t.type} 
                            role={t.role}
                            inline={true} // Important: Use inline mode for list rendering
                            onClose={() => removeToast(t.id)} 
                        />
                    ))}
                </AnimatePresence>
            </div>,
            document.body
        )}
        
        <CommandPalette onLogout={onLogout} />
        <SessionTerminal /> 
        {user && <InactivityLock userEmail={user.email || user.username} userName={displayName} onLogout={onLogout} timeoutMinutes={10} />}
        <StealthMode />

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
            <div 
            className="fixed inset-0 z-40 bg-zinc-900/80 backdrop-blur-sm md:hidden transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
            ></div>
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-zinc-950 text-white transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:flex md:flex-col border-r border-zinc-800 flex-shrink-0`}>
            <div className="flex-shrink-0 flex items-center justify-between h-20 px-6 border-b border-zinc-800/50 bg-zinc-950">
            <div className="flex items-center space-x-3">
                <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/10">
                <Box className="h-6 w-6 text-indigo-400" />
                </div>
                <span className="text-lg font-bold tracking-tight text-white">ODL Vault</span>
            </div>
            <button onClick={toggleSidebar} className="md:hidden text-zinc-400 hover:text-white transition-colors">
                <X className="h-6 w-6" />
            </button>
            </div>

            <div className="flex-1 overflow-y-auto">
            <nav className="px-4 py-6 space-y-2">
                <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">Operations</p>
                {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <NavLink
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 ${
                        isActive
                        ? 'bg-indigo-600/10 text-indigo-300 shadow-sm border border-indigo-500/10'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent'
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                    >
                    <div className="flex items-center">
                        <item.icon className={`mr-3 h-5 w-5 transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                        {item.name}
                    </div>
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]"></div>}
                    </NavLink>
                );
                })}
            </nav>
            </div>

            <div className="flex-shrink-0 p-4 border-t border-zinc-900 bg-zinc-950/50">
                <div className="flex items-center gap-3 mb-3 px-2">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm ring-1 ring-white/10 ${user?.role === 'grand_admin' ? 'bg-gradient-to-br from-amber-400 to-orange-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                        {user?.role === 'grand_admin' ? <Crown className="h-5 w-5" /> : (user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                        <div className="flex items-center mt-0.5">
                        <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${getRoleBg()}`}></span>
                        <p className={`text-[10px] uppercase tracking-wider font-semibold truncate ${getRoleColor()}`}>
                            {getRoleLabel()}
                        </p>
                        </div>
                    </div>
                </div>
                
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center px-4 py-2.5 text-xs font-semibold tracking-wide text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-white hover:border-zinc-700 transition-all duration-200 group"
                >
                    <LogOut className="mr-2 h-3.5 w-3.5 group-hover:text-rose-500 transition-colors" />
                    End Session
                </button>
            </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-gray-50">
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 lg:hidden flex-shrink-0">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
                <button
                onClick={toggleSidebar}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                <Menu className="h-6 w-6" />
                </button>
                <div className="flex items-center space-x-2">
                <Box className="h-6 w-6 text-indigo-600" />
                <span className="text-lg font-bold text-gray-900">ODL Vault</span>
                </div>
                <div className="w-6" />
            </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <div key={location.pathname} className="animate-fade-in-up">
                    <Outlet context={contextValue} />
                </div>
            </div>
            </main>
        </div>
        </div>
    </PresenceProvider>
  );
};

export default Layout;