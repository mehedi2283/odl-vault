import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  LogOut, 
  Plus, 
  FolderPlus, 
  Command, 
  CornerDownLeft,
  Shield,
  EyeOff
} from 'lucide-react';
import { RoutePath } from '../../types';

interface CommandPaletteProps {
  onLogout: () => void;
  // We can pass functions to trigger modals in dashboard if we want deep integration, 
  // but for now we'll stick to navigation and global actions
}

type CommandItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string[];
  action: () => void;
  category: 'Navigation' | 'Actions' | 'System';
};

const CommandPalette: React.FC<CommandPaletteProps> = ({ onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  // Toggle on Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const commands: CommandItem[] = useMemo(() => [
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: LayoutDashboard,
      category: 'Navigation',
      action: () => navigate(RoutePath.DASHBOARD)
    },
    {
      id: 'nav-chat',
      label: 'Open Sentinel Chat',
      icon: MessageSquare,
      category: 'Navigation',
      action: () => navigate('/chat') // Assuming /chat route exists or will exist
    },
    {
      id: 'nav-users',
      label: 'Manage Operatives',
      icon: Users,
      category: 'Navigation',
      action: () => navigate(RoutePath.USERS)
    },
    {
      id: 'act-stealth',
      label: 'Engage Stealth Mode',
      icon: EyeOff,
      category: 'Actions',
      action: () => window.dispatchEvent(new Event('trigger-stealth-mode'))
    },
    {
      id: 'act-logout',
      label: 'End Session',
      icon: LogOut,
      category: 'System',
      action: onLogout
    }
  ], [navigate, onLogout]);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery) || 
      cmd.category.toLowerCase().includes(lowerQuery)
    );
  }, [query, commands]);

  // Keyboard Navigation inside Palette
  useEffect(() => {
    if (!isOpen) return;

    const handleNavigation = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          selected.action();
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleNavigation);
    return () => document.removeEventListener('keydown', handleNavigation);
  }, [isOpen, filteredCommands, selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm"
          />

          {/* Palette Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.1 }}
            className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden relative z-10 border border-gray-200"
          >
            {/* Search Input */}
            <div className="flex items-center px-4 py-4 border-b border-gray-100">
              <Search className="w-5 h-5 text-gray-400 mr-3" />
              <input
                type="text"
                className="w-full text-lg bg-transparent border-none focus:ring-0 focus:outline-none placeholder-gray-400 text-gray-900"
                placeholder="Type a command or search..."
                value={query}
                onChange={(e) => {
                   setQuery(e.target.value);
                   setSelectedIndex(0);
                }}
                autoFocus
              />
              <div className="hidden sm:flex items-center gap-1">
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[10px] font-medium text-gray-500">ESC</kbd>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto py-2">
              {filteredCommands.length > 0 ? (
                <div>
                   {filteredCommands.map((cmd, index) => {
                     const isSelected = index === selectedIndex;
                     return (
                       <div
                         key={cmd.id}
                         onClick={() => { cmd.action(); setIsOpen(false); }}
                         onMouseEnter={() => setSelectedIndex(index)}
                         className={`px-4 py-3 mx-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                           isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                         }`}
                       >
                         <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-md ${isSelected ? 'bg-white shadow-sm text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                             <cmd.icon className="w-4 h-4" />
                           </div>
                           <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                             {cmd.label}
                           </span>
                         </div>
                         
                         {isSelected && (
                           <motion.div 
                             initial={{ opacity: 0, x: -5 }}
                             animate={{ opacity: 1, x: 0 }}
                             className="flex items-center text-indigo-400"
                           >
                             <CornerDownLeft className="w-4 h-4" />
                           </motion.div>
                         )}
                       </div>
                     );
                   })}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No protocols match your query.</p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
               <div className="flex items-center gap-2">
                 <Command className="w-3 h-3" />
                 <span>Command Protocol</span>
               </div>
               <div className="flex gap-4">
                 <span>Use <strong className="text-gray-500">↑↓</strong> to navigate</span>
                 <span><strong className="text-gray-500">↵</strong> to select</span>
               </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;