import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder as FolderIcon, FileText, Lock, Plus, Search, Grid, 
  ChevronLeft, ChevronRight, Home, Settings, Check, ExternalLink, 
  User as UserIcon, MousePointerClick, Pencil, Trash2, LayoutTemplate, 
  Shield, Network, FolderPlus, Save, X, RefreshCw, Copy, ChevronDown
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { 
  User, ToastContextType, Folder, 
  StoredCredential, FormDefinition 
} from '../types';
import Button from '../components/Button';
import NetworkGraph from '../components/NetworkGraph';
import Modal from '../components/Modal';
import Input from '../components/Input';

const PAGE_SIZE = 12;
const BASE_WEBHOOK_URL = "https://qqxdfqerllirceqiwyex.supabase.co/functions/v1/clever-worker";

const COMMON_SERVICES = [
    "Google", "AWS", "Azure", "GitHub", "GitLab", 
    "DigitalOcean", "Heroku", "Vercel", "Netlify", 
    "Slack", "Discord", "Linear", "Notion", "Figma", 
    "Adobe", "Microsoft", "Apple", "Facebook", "Twitter", 
    "LinkedIn", "Stripe", "PayPal", "Supabase", "Firebase",
    "OpenAI", "Anthropic"
];

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 }
};

const getCrmStyle = (serviceName: string) => {
    const s = (serviceName || '').toLowerCase();
    if (s.includes('google') || s.includes('gmail')) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' };
    if (s.includes('aws') || s.includes('amazon')) return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' };
    if (s.includes('azure') || s.includes('microsoft')) return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' };
    if (s.includes('github') || s.includes('gitlab')) return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
    return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' };
};

const DashboardPage: React.FC<{ user: User | null }> = ({ user }) => {
  const { showToast } = useOutletContext<ToastContextType>();
  
  // Data State
  const [folders, setFolders] = useState<Folder[]>([]);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // View State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>('grid');
  const [activeMainTab, setActiveMainTab] = useState<'credentials' | 'forms'>('credentials');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // --- MODAL STATE ---
  // Folder Modal
  const [folderModal, setFolderModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<Folder> | null }>({ open: false, mode: 'create', data: null });
  
  // Credential Modal
  const [credModal, setCredModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<StoredCredential> | null }>({ open: false, mode: 'create', data: null });
  
  // Service Combobox State
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const serviceInputRef = useRef<HTMLDivElement>(null);
  
  // Form Modal
  const [formModal, setFormModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<FormDefinition> | null }>({ open: false, mode: 'create', data: null });

  // Delete Confirmation
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string | null; type: 'folder' | 'credential' | 'form' }>({ open: false, id: null, type: 'folder' });
  const [isMutating, setIsMutating] = useState(false);

  // Permissions
  const canMutate = useMemo(() => {
      if (!user) return false;
      return ['grand_admin', 'master_admin', 'admin'].includes(user.role);
  }, [user]);

  // Handle Click Outside for Service Dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (serviceInputRef.current && !serviceInputRef.current.contains(event.target as Node)) {
              setIsServiceDropdownOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
        const [foldersRes, credsRes, formsRes] = await Promise.all([
            supabase.from('folders')
                .select('*, profiles!created_by(username, full_name)')
                .order('name'),
            supabase.from('credentials')
                .select('*, profiles!created_by(username, full_name)')
                .order('created_at', { ascending: false }),
            supabase.from('forms')
                .select('*, profiles!created_by(username, full_name)')
                .order('created_at', { ascending: false })
        ]);

        if (foldersRes.error) throw foldersRes.error;
        if (credsRes.error) throw credsRes.error;
        if (formsRes.error) throw formsRes.error;

        // Map Folders
        const mappedFolders: Folder[] = (foldersRes.data || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            parentId: f.parent_id,
            createdAt: f.created_at,
            type: f.type, // Ensure DB has 'type' column
            createdBy: f.profiles
        }));

        // Map Credentials
        const mappedCreds: StoredCredential[] = (credsRes.data || []).map((c: any) => ({
            id: c.id,
            clientName: c.client_name,
            serviceName: c.service_name,
            crmLink: c.crm_link,
            username: c.username,
            password: c.password,
            lastUpdated: c.last_updated ? new Date(c.last_updated) : new Date(c.created_at),
            folderId: c.folder_id,
            createdAt: c.created_at,
            createdBy: c.profiles
        }));

        // Map Forms
        const mappedForms: FormDefinition[] = (formsRes.data || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            folderId: f.folder_id,
            webhookKey: f.webhook_key,
            webhookUrl: `${BASE_WEBHOOK_URL}?key=${f.webhook_key}`,
            fields: f.fields || [],
            createdAt: f.created_at,
            status: f.status,
            createdBy: f.profiles
        }));

        setFolders(mappedFolders);
        setCredentials(mappedCreds);
        setForms(mappedForms);
    } catch (e: any) {
        console.error("Fetch Error:", e);
        showToast("Failed to load vault data", "error");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Logic
  const { displayFolders, displayItems, totalPages } = useMemo(() => {
      let filteredFolders: Folder[] = [];
      let filteredItems: (StoredCredential | FormDefinition)[] = [];

      const isCredentialTab = activeMainTab === 'credentials';

      // 1. FILTER FOLDERS
      if (searchQuery) {
          const lower = searchQuery.toLowerCase();
          filteredFolders = folders.filter(f => {
              const nameMatch = f.name.toLowerCase().includes(lower);
              // Strict Type Matching
              const typeMatch = isCredentialTab 
                  ? (f.type === 'credential' || !f.type) 
                  : f.type === 'form';
              return nameMatch && typeMatch;
          });
      } else {
          filteredFolders = folders.filter(f => {
              const parentMatch = f.parentId === currentFolderId;
              // Strict Type Matching
              const typeMatch = isCredentialTab 
                  ? (f.type === 'credential' || !f.type) 
                  : f.type === 'form';
              return parentMatch && typeMatch;
          });
      }

      // 2. FILTER ITEMS
      if (isCredentialTab) {
          if (searchQuery) {
              const lower = searchQuery.toLowerCase();
              filteredItems = credentials.filter(c => 
                  c.clientName.toLowerCase().includes(lower) || 
                  c.serviceName.toLowerCase().includes(lower) ||
                  c.username.toLowerCase().includes(lower)
              );
          } else {
              filteredItems = credentials.filter(c => c.folderId === currentFolderId);
          }
      } else {
          if (searchQuery) {
              const lower = searchQuery.toLowerCase();
              filteredItems = forms.filter(f => f.name.toLowerCase().includes(lower));
          } else {
              filteredItems = forms.filter(f => f.folderId === currentFolderId);
          }
      }

      // Pagination
      const allItems = [...filteredFolders, ...filteredItems];
      const total = Math.ceil(allItems.length / PAGE_SIZE);
      
      const startIndex = (currentPage - 1) * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const sliced = allItems.slice(startIndex, endIndex);
      
      const pagedFolders = sliced.filter(i => 'parentId' in i) as Folder[];
      const pagedItems = sliced.filter(i => !('parentId' in i)) as (StoredCredential | FormDefinition)[];

      return {
          displayFolders: pagedFolders,
          displayItems: pagedItems,
          totalPages: total || 1
      };
  }, [folders, credentials, forms, currentFolderId, activeMainTab, searchQuery, currentPage]);

  // --- CRUD HANDLERS ---

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderModal.data?.name) return;
    setIsMutating(true);
    try {
        if (folderModal.mode === 'create') {
            const { error } = await supabase.from('folders').insert({
                name: folderModal.data.name,
                parent_id: currentFolderId,
                type: activeMainTab === 'forms' ? 'form' : 'credential', // Assign type based on current tab
                created_by: user?.id
            });
            if (error) throw error;
            showToast("Folder created", "success");
        } else {
            const { error } = await supabase.from('folders')
                .update({ name: folderModal.data.name })
                .eq('id', folderModal.data.id);
            if (error) throw error;
            showToast("Folder updated", "success");
        }
        setFolderModal({ open: false, mode: 'create', data: null });
        fetchData();
    } catch (err: any) {
        showToast(err.message, "error");
    } finally {
        setIsMutating(false);
    }
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credModal.data?.clientName || !credModal.data?.username) return;
    setIsMutating(true);
    try {
        const payload = {
            client_name: credModal.data.clientName,
            service_name: credModal.data.serviceName || 'Service',
            crm_link: credModal.data.crmLink,
            username: credModal.data.username,
            password: credModal.data.password,
            folder_id: currentFolderId,
            last_updated: new Date().toISOString()
        };

        if (credModal.mode === 'create') {
            const { error } = await supabase.from('credentials').insert({
                ...payload,
                created_by: user?.id
            });
            if (error) throw error;
            showToast("Credential secure", "success");
        } else {
            const { error } = await supabase.from('credentials').update(payload).eq('id', credModal.data.id);
            if (error) throw error;
            showToast("Credential updated", "success");
        }
        setCredModal({ open: false, mode: 'create', data: null });
        fetchData();
    } catch (err: any) {
        showToast(err.message, "error");
    } finally {
        setIsMutating(false);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formModal.data?.name) return;
    setIsMutating(true);
    try {
        if (formModal.mode === 'create') {
            const { error } = await supabase.from('forms').insert({
                name: formModal.data.name,
                folder_id: currentFolderId,
                status: formModal.data.status || 'draft',
                webhook_key: crypto.randomUUID(), // Auto-generate key
                created_by: user?.id
            });
            if (error) throw error;
            showToast("Form initialized", "success");
        } else {
            const { error } = await supabase.from('forms')
                .update({ name: formModal.data.name, status: formModal.data.status })
                .eq('id', formModal.data.id);
            if (error) throw error;
            showToast("Form updated", "success");
        }
        setFormModal({ open: false, mode: 'create', data: null });
        fetchData();
    } catch (err: any) {
        showToast(err.message, "error");
    } finally {
        setIsMutating(false);
    }
  };

  const handleDelete = async () => {
      if (!deleteModal.id) return;
      setIsMutating(true);
      try {
          const table = deleteModal.type === 'folder' ? 'folders' : deleteModal.type === 'credential' ? 'credentials' : 'forms';
          const { error } = await supabase.from(table).delete().eq('id', deleteModal.id);
          if (error) throw error;
          showToast(`${deleteModal.type} deleted`, "success");
          setDeleteModal({ open: false, id: null, type: 'folder' });
          fetchData();
      } catch (err: any) {
          showToast(err.message, "error");
      } finally {
          setIsMutating(false);
      }
  };

  // --- ACTIONS ---

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      showToast("Copied to clipboard", "success");
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const next = new Set(selectedItems);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedItems(next);
  };

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
      const path: Folder[] = [];
      let current = folders.find(f => f.id === currentFolderId);
      while (current) {
          path.unshift(current);
          current = folders.find(f => f.id === current.parentId);
      }
      return path;
  }, [folders, currentFolderId]);

  // Pagination Controls Component
  const PaginationControls = () => {
      if (totalPages <= 1) return null;
      return (
          <div className="flex justify-center items-center gap-4 mt-8">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"><ChevronLeft /></button>
              <span className="text-sm font-medium text-gray-600">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"><ChevronRight /></button>
          </div>
      );
  };

  return (
    <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        {currentFolderId ? breadcrumbs[breadcrumbs.length - 1].name : 'Vault Dashboard'}
                    </h1>
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                        <button onClick={() => setCurrentFolderId(null)} className={`hover:text-indigo-600 flex items-center gap-1 ${!currentFolderId ? 'font-bold text-indigo-600' : ''}`}>
                            <Home size={14} /> Root
                        </button>
                        {breadcrumbs.map((folder, idx) => (
                            <React.Fragment key={folder.id}>
                                <ChevronRight size={14} className="text-gray-300" />
                                <button 
                                    onClick={() => setCurrentFolderId(folder.id)}
                                    className={`hover:text-indigo-600 ${idx === breadcrumbs.length - 1 ? 'font-bold text-indigo-600' : ''}`}
                                >
                                    {folder.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}><Grid size={18} /></button>
                        <button onClick={() => setViewMode('graph')} className={`p-2 rounded-lg transition-all ${viewMode === 'graph' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}><Network size={18} /></button>
                    </div>
                    {canMutate && (
                        <div className="flex gap-2">
                             <Button onClick={() => setFolderModal({ open: true, mode: 'create', data: { name: '' } })} variant="secondary" className="hidden sm:flex"><FolderPlus size={16} className="mr-2" /> Folder</Button>
                             <Button onClick={() => activeMainTab === 'credentials' ? setCredModal({ open: true, mode: 'create', data: { clientName: '' } }) : setFormModal({ open: true, mode: 'create', data: { name: '' } })}><Plus size={16} className="mr-2" /> New {activeMainTab === 'credentials' ? 'Credential' : 'Form'}</Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm">
                 <div className="flex gap-2 w-full sm:w-auto">
                     <button 
                        onClick={() => { setActiveMainTab('credentials'); setCurrentFolderId(null); setSearchQuery(''); setCurrentPage(1); }} 
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeMainTab === 'credentials' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                     >
                        Credentials
                     </button>
                     <button 
                        onClick={() => { setActiveMainTab('forms'); setCurrentFolderId(null); setSearchQuery(''); setCurrentPage(1); }} 
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeMainTab === 'forms' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                     >
                        Forms
                     </button>
                 </div>
                 <div className="relative w-full sm:w-64">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                     <input 
                        type="text" 
                        placeholder="Search vault..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 rounded-xl text-sm transition-all outline-none border"
                     />
                 </div>
            </div>
        </div>

        {/* Content */}
        {viewMode === 'graph' ? (
            <NetworkGraph 
                folders={folders} 
                credentials={credentials} 
                forms={forms} 
                currentFolderId={currentFolderId} 
                onFolderClick={setCurrentFolderId}
                onItemClick={(id, type) => {
                    if (!canMutate) return;
                    if (type === 'credential') {
                        const item = credentials.find(c => c.id === id);
                        if (item) setCredModal({ open: true, mode: 'edit', data: item });
                    } else {
                        const item = forms.find(f => f.id === id);
                        if (item) setFormModal({ open: true, mode: 'edit', data: item });
                    }
                }}
            />
        ) : (
            <AnimatePresence mode="wait">
                <motion.div 
                    key={`${activeMainTab}-${currentPage}-${currentFolderId || 'root'}`}
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 pb-6"
                >
                    {/* FOLDERS GRID */}
                    {displayFolders.map(folder => {
                        const subFolderCount = folders.filter(f => f.parentId === folder.id).length;
                        const itemsCount = activeMainTab === 'credentials' 
                            ? credentials.filter(c => c.folderId === folder.id).length 
                            : forms.filter(f => f.folderId === folder.id).length;
                        const itemLabel = activeMainTab === 'credentials' ? 'credentials' : 'forms';

                        return (
                            <motion.div 
                                variants={itemVariants}
                                key={folder.id} 
                                onClick={() => setCurrentFolderId(folder.id)} 
                                className={`group relative bg-white p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between h-[150px] min-w-0 ${selectedItems.has(folder.id) ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50/10' : 'border-gray-200 hover:border-indigo-200'}`}
                            >
                                <div className="flex items-start justify-between">
                                        <div className="p-3 bg-indigo-50 rounded-2xl group-hover:scale-105 transition-transform">
                                        <FolderIcon className={`h-6 w-6 ${selectedItems.has(folder.id) ? 'text-indigo-600' : 'text-indigo-500'}`} />
                                    </div>
                                    
                                    <div className="flex gap-2 z-10">
                                        {canMutate && (
                                            <div onClick={(e) => { e.stopPropagation(); setFolderModal({ open: true, mode: 'edit', data: folder }); }} className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 flex items-center justify-center transition-colors text-gray-400 opacity-0 group-hover:opacity-100" title="Edit Folder">
                                                <Settings size={14} />
                                            </div>
                                        )}
                                        <div onClick={(e) => toggleSelection(folder.id, e)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedItems.has(folder.id) ? 'bg-indigo-600 border-indigo-600 text-white scale-110 opacity-100' : 'bg-white border-gray-200 text-transparent hover:border-indigo-400 opacity-0 group-hover:opacity-100'}`}>
                                            <Check size={14} strokeWidth={3} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-4 min-w-0">
                                    <h3 className="text-lg font-bold text-gray-900 truncate tracking-tight">{folder.name}</h3>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 font-medium">
                                            <span>{subFolderCount} sub-folders</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            <span>{itemsCount} {itemLabel}</span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* ITEMS GRID */}
                    {displayItems.map(item => {
                        if (activeMainTab === 'credentials') {
                            const cred = item as StoredCredential;
                            const style = getCrmStyle(cred.serviceName);
                            return (
                                <motion.div 
                                    variants={itemVariants}
                                    key={cred.id} 
                                    onClick={() => canMutate && setCredModal({ open: true, mode: 'edit', data: cred })}
                                    className={`group relative bg-white rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col h-[240px] min-w-0 ${selectedItems.has(cred.id) ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}
                                >
                                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                                        <div onClick={(e) => toggleSelection(cred.id, e)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedItems.has(cred.id) ? 'bg-indigo-600 border-indigo-600 text-white scale-110' : 'bg-white border-gray-200 text-transparent hover:border-indigo-400'}`}>
                                            <Check size={16} strokeWidth={3} />
                                        </div>
                                    </div>
                                    
                                    <div className="p-6 flex flex-col h-full min-w-0">
                                        <div className="flex items-start justify-between mb-4 pr-10">
                                            <div className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border shadow-sm ${style.bg} ${style.text} ${style.border}`}>
                                                {cred.serviceName || 'Service'}
                                            </div>
                                        </div>
                                        
                                        <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2 group-hover:text-indigo-600 transition-colors min-w-0 flex-shrink-0 min-h-[1.75rem]">
                                            <span className="truncate">{cred.clientName || 'Untitled Credential'}</span>
                                            {cred.crmLink && (
                                                <a 
                                                    href={cred.crmLink} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-gray-400 hover:text-indigo-600 transition-colors p-1 flex-shrink-0"
                                                    title="Open Link"
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                            )}
                                        </h3>
                                        
                                        <div className="space-y-2 flex-1 min-w-0">
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); handleCopy(cred.username); }}
                                                className="flex items-center text-sm text-gray-600 group/row hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-100 min-w-0"
                                                title="Click to copy"
                                            >
                                                <UserIcon size={14} className="mr-2 text-gray-400 group-hover/row:text-indigo-500 flex-shrink-0" />
                                                <span className="truncate flex-1 font-medium">{cred.username}</span>
                                                <MousePointerClick size={12} className="text-indigo-400 opacity-0 group-hover/row:opacity-100 transition-opacity translate-x-2 group-hover/row:translate-x-0 flex-shrink-0" />
                                            </div>
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); handleCopy(cred.password); }}
                                                className="flex items-center text-sm text-gray-600 group/row hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-100 min-w-0"
                                                title="Click to copy"
                                            >
                                                <Lock size={14} className="mr-2 text-gray-400 group-hover/row:text-indigo-500 flex-shrink-0" />
                                                <span className="truncate flex-1 font-mono text-xs">••••••••••••</span>
                                                <MousePointerClick size={12} className="text-indigo-400 opacity-0 group-hover/row:opacity-100 transition-opacity translate-x-2 group-hover/row:translate-x-0 flex-shrink-0" />
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 min-w-0">
                                            <span className="truncate">Updated: {new Date(cred.lastUpdated).toLocaleDateString()}</span>
                                            {canMutate && (
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => setCredModal({ open: true, mode: 'edit', data: cred })} className="hover:text-indigo-600 transition-colors p-1"><Pencil size={14} /></button>
                                                    <button onClick={() => setDeleteModal({ open: true, id: cred.id, type: 'credential' })} className="hover:text-rose-600 transition-colors p-1"><Trash2 size={14} /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        } else {
                            const form = item as FormDefinition;
                            return (
                                <motion.div 
                                    variants={itemVariants}
                                    key={form.id} 
                                    onClick={() => canMutate && setFormModal({ open: true, mode: 'edit', data: form })}
                                    className={`group relative bg-white p-6 rounded-2xl border transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between h-[200px] min-w-0 ${selectedItems.has(form.id) ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}
                                >
                                        <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                                        <div onClick={(e) => toggleSelection(form.id, e)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedItems.has(form.id) ? 'bg-indigo-600 border-indigo-600 text-white scale-110' : 'bg-white border-gray-200 text-transparent hover:border-indigo-400'}`}>
                                            <Check size={16} strokeWidth={3} />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`p-3 rounded-2xl ${selectedItems.has(form.id) ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-500'} transition-colors`}>
                                                <LayoutTemplate className="h-6 w-6" />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mb-1 min-w-0">
                                            <h3 className="text-xl font-bold text-gray-900 truncate">{form.name}</h3>
                                        </div>
                                        <div className="flex items-center mt-2">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${form.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${form.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                                                {form.status === 'active' ? 'Active' : 'Draft'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center min-w-0">
                                        <p className="text-xs text-gray-400 font-medium truncate">Created {new Date(form.createdAt).toLocaleDateString()}</p>
                                        {canMutate && (
                                            <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, id: form.id, type: 'form' }); }} className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 flex-shrink-0"><Trash2 size={16} /></button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        }
                    })}

                    {/* Empty State */}
                    {displayFolders.length === 0 && displayItems.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                            <div className="bg-white p-4 rounded-full shadow-sm mb-4"><Shield className="h-10 w-10 text-gray-300" /></div>
                            <h3 className="text-base font-bold text-gray-900">Vault Empty</h3>
                            <p className="text-sm text-gray-500 mt-1 mb-6 max-w-sm mx-auto">No records found in this sector. Initiate a new record or create a directory.</p>
                            {canMutate && <Button onClick={() => activeMainTab === 'credentials' ? setCredModal({ open: true, mode: 'create', data: { clientName: '' } }) : setFormModal({ open: true, mode: 'create', data: { name: '' } })} variant="secondary" className="text-xs">Create First Record</Button>}
                        </div>
                    )}
                    
                    <div className="col-span-full">
                        <PaginationControls />
                    </div>
                </motion.div>
            </AnimatePresence>
        )}

        {/* --- MODALS --- */}
        
        {/* FOLDER MODAL */}
        <Modal isOpen={folderModal.open} onClose={() => setFolderModal({ ...folderModal, open: false })} title={folderModal.mode === 'create' ? 'Create Folder' : 'Edit Folder'}>
            <form onSubmit={handleSaveFolder} className="space-y-4">
                <Input label="Folder Name" value={folderModal.data?.name || ''} onChange={(e) => setFolderModal({ ...folderModal, data: { ...folderModal.data, name: e.target.value } })} placeholder="e.g. Finance, Client A" autoFocus required />
                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={() => setFolderModal({ ...folderModal, open: false })}>Cancel</Button>
                    <Button type="submit" isLoading={isMutating}>{folderModal.mode === 'create' ? 'Create Folder' : 'Save Changes'}</Button>
                </div>
            </form>
        </Modal>

        {/* CREDENTIAL MODAL */}
        <Modal isOpen={credModal.open} onClose={() => setCredModal({ ...credModal, open: false })} title={credModal.mode === 'create' ? 'New Credential' : 'Edit Credential'}>
            <form onSubmit={handleSaveCredential} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Client / App Name" value={credModal.data?.clientName || ''} onChange={(e) => setCredModal({ ...credModal, data: { ...credModal.data, clientName: e.target.value } })} placeholder="e.g. OpenAI" autoFocus required />
                    <div className="space-y-1.5" ref={serviceInputRef}>
                        <label className="block text-sm font-medium text-gray-700 ml-1">Service</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={credModal.data?.serviceName || ''} 
                                onChange={(e) => setCredModal({ ...credModal, data: { ...credModal.data, serviceName: e.target.value } })}
                                onFocus={() => setIsServiceDropdownOpen(true)}
                                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all sm:text-sm"
                                placeholder="Select or type..." 
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <ChevronDown size={16} />
                            </div>
                            <AnimatePresence>
                                {isServiceDropdownOpen && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }} 
                                        animate={{ opacity: 1, y: 0 }} 
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute z-50 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto"
                                    >
                                        {COMMON_SERVICES.filter(s => s.toLowerCase().includes((credModal.data?.serviceName || '').toLowerCase())).length > 0 ? (
                                            COMMON_SERVICES.filter(s => s.toLowerCase().includes((credModal.data?.serviceName || '').toLowerCase())).map(service => (
                                                <div 
                                                    key={service}
                                                    onClick={() => {
                                                        setCredModal({ ...credModal, data: { ...credModal.data, serviceName: service } });
                                                        setIsServiceDropdownOpen(false);
                                                    }}
                                                    className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-gray-700 transition-colors"
                                                >
                                                    {service}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2 text-xs text-gray-400 italic">Type to create custom service...</div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
                <Input label="Login URL" value={credModal.data?.crmLink || ''} onChange={(e) => setCredModal({ ...credModal, data: { ...credModal.data, crmLink: e.target.value } })} placeholder="https://..." />
                <Input label="Username / Email" value={credModal.data?.username || ''} onChange={(e) => setCredModal({ ...credModal, data: { ...credModal.data, username: e.target.value } })} placeholder="user@domain.com" required />
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700 ml-1">Password</label>
                    <input 
                        type="text" 
                        value={credModal.data?.password || ''} 
                        onChange={(e) => setCredModal({ ...credModal, data: { ...credModal.data, password: e.target.value } })} 
                        className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all sm:text-sm font-mono"
                        placeholder="••••••••" 
                    />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={() => setCredModal({ ...credModal, open: false })}>Cancel</Button>
                    <Button type="submit" isLoading={isMutating}>{credModal.mode === 'create' ? 'Secure Credential' : 'Update Credential'}</Button>
                </div>
            </form>
        </Modal>

        {/* FORM MODAL */}
        <Modal isOpen={formModal.open} onClose={() => setFormModal({ ...formModal, open: false })} title={formModal.mode === 'create' ? 'Initialize Form' : 'Edit Form Config'}>
            <form onSubmit={handleSaveForm} className="space-y-4">
                <Input label="Form Name" value={formModal.data?.name || ''} onChange={(e) => setFormModal({ ...formModal, data: { ...formModal.data, name: e.target.value } })} placeholder="e.g. Contact Us" autoFocus required />
                
                {formModal.mode === 'edit' && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Webhook Endpoint</label>
                        <div className="flex items-center gap-2">
                             <code className="flex-1 text-xs bg-white p-2 rounded border border-gray-200 truncate font-mono text-gray-600">
                                {formModal.data?.webhookUrl}
                             </code>
                             <button type="button" onClick={() => handleCopy(formModal.data?.webhookUrl || '')} className="p-2 bg-white border border-gray-200 rounded hover:text-indigo-600 hover:border-indigo-200"><Copy size={14} /></button>
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700 ml-1">Status</label>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="status" checked={formModal.data?.status === 'active'} onChange={() => setFormModal({ ...formModal, data: { ...formModal.data, status: 'active' } })} className="text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm text-gray-700">Active</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="status" checked={formModal.data?.status !== 'active'} onChange={() => setFormModal({ ...formModal, data: { ...formModal.data, status: 'draft' } })} className="text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm text-gray-700">Draft</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={() => setFormModal({ ...formModal, open: false })}>Cancel</Button>
                    <Button type="submit" isLoading={isMutating}>{formModal.mode === 'create' ? 'Create Form' : 'Save Configuration'}</Button>
                </div>
            </form>
        </Modal>

        {/* DELETE CONFIRMATION */}
        <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ ...deleteModal, open: false })} title="Confirm Deletion">
            <div className="text-center p-4">
                <div className="bg-rose-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="h-8 w-8 text-rose-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Delete {deleteModal.type}?</h3>
                <p className="text-sm text-gray-500 mt-2 mb-6">
                    This action is permanent and cannot be undone. All contained data will be lost.
                </p>
                <div className="flex justify-center gap-3">
                    <Button variant="secondary" onClick={() => setDeleteModal({ ...deleteModal, open: false })}>Cancel</Button>
                    <Button variant="danger" onClick={handleDelete} isLoading={isMutating}>Delete Permanently</Button>
                </div>
            </div>
        </Modal>

    </div>
  );
};

export default DashboardPage;