import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, X, Users, Crown, MessageSquare, Flame, Box } from 'lucide-react';
import { RoutePath } from '../types';
import CommandPalette from './CommandPalette';
import InactivityLock from './InactivityLock';
import StealthMode from './StealthMode';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  user: { username: string; role: 'grand_admin' | 'admin' | 'user'; full_name?: string } | null;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout, user }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const isAdminOrGrand = user?.role === 'admin' || user?.role === 'grand_admin';

  const navItems = [
    { name: 'Vault Dashboard', path: RoutePath.DASHBOARD, icon: LayoutDashboard },
    { name: 'Team Comms', path: '/chat', icon: MessageSquare },
    { name: 'Dead Drop', path: RoutePath.DEAD_DROP, icon: Flame },
    ...(isAdminOrGrand ? [{ name: 'Access Control', path: RoutePath.USERS, icon: Users }] : []),
  ];

  const getRoleLabel = () => {
    if (user?.role === 'grand_admin') return 'Grand Administrator';
    if (user?.role === 'admin') return 'Administrator';
    return 'Authorized User';
  };

  const displayName = user?.full_name || user?.username || 'User';

  return (
    <div className="h-screen bg-zinc-950 flex font-sans text-zinc-100 overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      <CommandPalette onLogout={onLogout} />
      {user && <InactivityLock userEmail={displayName} onLogout={onLogout} timeoutMinutes={5} />}
      <StealthMode />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-zinc-950 text-white border-r border-zinc-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:flex md:flex-col flex-shrink-0`}>
        <div className="flex-shrink-0 flex items-center justify-between h-20 px-6 border-b border-zinc-800/50">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
               <Box className="h-5 w-5 text-indigo-500" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">ODL Vault</span>
          </div>
          <button onClick={toggleSidebar} className="md:hidden text-zinc-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="px-4 py-6 space-y-2">
            <p className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Operations</p>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`group flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-zinc-900 text-indigo-400 shadow-sm border border-zinc-800'
                      : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200 border border-transparent'
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <div className="flex items-center">
                    <item.icon className={`mr-3 h-5 w-5 transition-colors ${isActive ? 'text-indigo-500' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                    {item.name}
                  </div>
                  {isActive && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex-shrink-0 p-4 border-t border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-3 mb-3 px-2">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold shadow-sm ring-1 ring-inset ring-white/10 ${user?.role === 'grand_admin' ? 'bg-amber-600' : 'bg-indigo-600'}`}>
                    {user?.role === 'grand_admin' ? <Crown className="h-4 w-4" /> : (user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-200 truncate">{displayName}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 truncate">
                      {getRoleLabel()}
                    </p>
                  </div>
              </div>
              
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center px-4 py-2.5 text-xs font-semibold tracking-wide text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800/80 hover:text-rose-400 hover:border-rose-900/30 transition-all duration-200 group"
              >
                <LogOut className="mr-2 h-3.5 w-3.5 group-hover:text-rose-500 transition-colors" />
                End Session
              </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-zinc-950 relative">
        {/* Mobile Header */}
        <header className="bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 lg:hidden flex-shrink-0 z-10">
          <div className="flex items-center justify-between h-16 px-4">
            <button onClick={toggleSidebar} className="text-zinc-400 hover:text-white">
              <Menu className="h-6 w-6" />
            </button>
            <span className="text-lg font-bold text-white">ODL Vault</span>
            <div className="w-6" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;