import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, LogOut, Menu, X, Users, Crown, MessageSquare, Flame, Box } from 'lucide-react';
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

  // Filter navigation items based on role
  const navItems = [
    { name: 'Vault Dashboard', path: RoutePath.DASHBOARD, icon: LayoutDashboard },
    { name: 'Team Comms', path: '/chat', icon: MessageSquare },
    { name: 'Dead Drop', path: RoutePath.DEAD_DROP, icon: Flame },
    // Only show Users tab if user is admin or grand_admin
    ...(isAdminOrGrand ? [{ name: 'Access Control', path: RoutePath.USERS, icon: Users }] : []),
  ];

  const getRoleLabel = () => {
    if (user?.role === 'grand_admin') return 'Grand Administrator';
    if (user?.role === 'admin') return 'Administrator';
    return 'Authorized User';
  };

  const getRoleColor = () => {
    if (user?.role === 'grand_admin') return 'text-amber-400';
    if (user?.role === 'admin') return 'text-indigo-400';
    return 'text-emerald-400';
  };

  const getRoleBg = () => {
    if (user?.role === 'grand_admin') return 'bg-amber-400';
    if (user?.role === 'admin') return 'bg-indigo-400';
    return 'bg-emerald-400';
  };

  const displayName = user?.full_name || user?.username || 'User';

  return (
    <div className="h-screen bg-gray-50 flex font-sans text-gray-900 overflow-hidden">
      {/* Global Command Palette */}
      <CommandPalette onLogout={onLogout} />
      
      {/* Auto Lock Screen */}
      {user && <InactivityLock userEmail={displayName} onLogout={onLogout} timeoutMinutes={5} />}

      {/* Stealth Mode Overlay */}
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
        {/* Header */}
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

        {/* Scrollable Nav */}
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

        {/* Fixed Footer (User Info & Logout) */}
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

      {/* Main Content */}
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
                {children}
             </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;