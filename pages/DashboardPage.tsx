import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Trash2, Eye, EyeOff, Copy, Shield, ShieldAlert, Search, Lock, 
  ChevronRight, ChevronDown, ChevronLeft, Building, Pencil, 
  Loader2, Folder, FolderPlus, Square, CheckSquare, 
  RefreshCcw, Home, FileText, Globe, Calendar, Server,
  X, Move, CheckCheck, ListFilter, ListChecks, Settings,
  Link as LinkIcon, Save, Type, AlignLeft, Mail, Phone, ArrowRightLeft,
  LayoutTemplate, Clock, Hash, Database, ChevronUp, Tag, Code, Terminal,
  PlayCircle, PauseCircle, FileJson, Table as TableIcon, RefreshCw, AlertCircle,
  MoreHorizontal, AlertTriangle, ArrowRight, User as UserIcon, CheckCircle2,
  ExternalLink, Check, MousePointerClick, Briefcase, Ban
} from 'lucide-react';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import CipherText from '../components/CipherText';
import { StoredCredential, FormSubmission, User, Folder as FolderType } from '../types';
import { supabase } from '../services/supabase';

// --- TYPES & CONSTANTS ---

type FieldType = 'text' | 'textarea' | 'email' | 'phone';

interface FormField {
  id: string;
  name: string;
  type: FieldType;
  mappedKey?: string; 
}

interface FormDefinition {
  id: string;
  name: string;
  folderId: string | null;
  webhookKey: string; 
  webhookUrl: string;
  fields: FormField[];
  createdAt: string;
  status: 'draft' | 'active'; 
}

// Light Mode Colors for CRM Tags
const CRM_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', hover: 'hover:bg-blue-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hover: 'hover:bg-emerald-100' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', hover: 'hover:bg-purple-100' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hover: 'hover:bg-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', hover: 'hover:bg-rose-100' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', hover: 'hover:bg-indigo-100' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', hover: 'hover:bg-cyan-100' },
];

const COMMON_SERVICES = [
  'Salesforce', 'HubSpot', 'Zoho', 'Pipedrive', 'Zendesk', 
  'Slack', 'Jira', 'Asana', 'Trello', 'Monday', 
  'ClickUp', 'Notion', 'Airtable', 'Figma', 'Intercom',
  'Gmail', 'Outlook', 'AWS', 'Azure', 'Google Cloud',
  'Shopify', 'WordPress', 'Stripe', 'PayPal'
];

// "Goo & Simple" Animation Variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
    filter: 'blur(8px)'
  },
  show: { 
    opacity: 1, 
    scale: 1,
    filter: 'blur(0px)',
    transition: { 
      type: "spring",
      stiffness: 150,
      damping: 15,
      mass: 0.8
    } 
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    filter: 'blur(4px)',
    transition: { duration: 0.2 }
  }
};

interface DashboardPageProps {
  user: User | null;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState<'credentials' | 'submissions'>('credentials');
  
  // --- PERMISSIONS ---
  const hasVaultAccess = user?.role !== 'user';
  // canMutate = Can create/delete/edit records
  const canMutate = user?.role === 'grand_admin' || user?.role === 'master_admin'; 
  // canEditSchema = Can access Form Builder / Map Fields
  const canEditSchema = user?.role === 'grand_admin' || user?.role === 'master_admin';
  
  // --- CORE DATA STATE ---
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [forms, setForms] = useState<FormDefinition[]>([]); 
  const [activeFormSubmissions, setActiveFormSubmissions] = useState<FormSubmission[]>([]);
  
  // --- LOADING STATES ---
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // --- NAVIGATION & PAGINATION STATE (Separated for Stability) ---
  const [credFolderId, setCredFolderId] = useState<string | null>(null);
  const [formFolderId, setFormFolderId] = useState<string | null>(null);
  const [credPage, setCredPage] = useState(1);
  const [formPage, setFormPage] = useState(1);

  // Helper to fetch/set current context based on active tab
  const currentFolderId = activeMainTab === 'credentials' ? credFolderId : formFolderId;
  const currentPage = activeMainTab === 'credentials' ? credPage : formPage;

  const setCurrentFolderId = (id: string | null) => {
    if (activeMainTab === 'credentials') {
        setCredFolderId(id);
        setCredPage(1); // Always reset page when changing folders
    } else {
        setFormFolderId(id);
        setFormPage(1);
    }
    setSelectedItems(new Set()); // Clear selection on folder change
  };

  const setCurrentPage = (page: number) => {
      if (activeMainTab === 'credentials') setCredPage(page);
      else setFormPage(page);
  };

  // --- FORM DETAIL STATE ---
  const [currentFormId, setCurrentFormId] = useState<string | null>(null); 
  const [formViewMode, setFormViewMode] = useState<'overview' | 'builder' | 'mapping'>('overview');

  // --- MODAL STATES ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isCreateFormModalOpen, setIsCreateFormModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isDeleteRecordModalOpen, setIsDeleteRecordModalOpen] = useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  
  // --- ACTION STATE ---
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; id: string | null, type: 'credential' | 'folder' | 'bulk' | 'form' }>({ isOpen: false, id: null, type: 'credential' });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // --- FILTERS & EDITING ---
  const [searchQuery, setSearchQuery] = useState('');
  const [crmFilter, setCrmFilter] = useState<string>('All');
  const [isCrmFilterOpen, setIsCrmFilterOpen] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCred, setNewCred] = useState<Omit<StoredCredential, 'id' | 'lastUpdated'>>({ clientName: '', serviceName: '', crmLink: '', username: '', password: '', folderId: null });
  const [newFolderName, setNewFolderName] = useState('');
  const [showCrmDropdown, setShowCrmDropdown] = useState(false);
  
  // --- SUBMISSION & MAPPING STATE ---
  const [viewingSubmission, setViewingSubmission] = useState<FormSubmission & { mapped_data?: Record<string, any> } | null>(null);
  const [latestPayload, setLatestPayload] = useState<Record<string, any> | null>(null);
  const [mappingReferenceId, setMappingReferenceId] = useState<string | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [activeMappingFieldId, setActiveMappingFieldId] = useState<string | null>(null);
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isSubmissionDropdownOpen, setIsSubmissionDropdownOpen] = useState(false);

  // --- REFS ---
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const submissionDropdownRef = useRef<HTMLDivElement>(null);
  const crmDropdownRef = useRef<HTMLDivElement>(null);
  const crmFilterRef = useRef<HTMLDivElement>(null);

  const ITEMS_PER_PAGE = 6;
  const BASE_WEBHOOK_URL = "https://qqxdfqerllirceqiwyex.supabase.co/functions/v1/clever-worker";

  // --- INITIAL LOAD ---
  useEffect(() => {
    if (user && hasVaultAccess) fetchData();
  }, [user, hasVaultAccess]);

  // Click Outside Handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (submissionDropdownRef.current && !submissionDropdownRef.current.contains(event.target as Node)) {
          setIsSubmissionDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
          setIsStatusDropdownOpen(false);
      }
      if (crmDropdownRef.current && !crmDropdownRef.current.contains(event.target as Node)) {
          setShowCrmDropdown(false);
      }
      if (crmFilterRef.current && !crmFilterRef.current.contains(event.target as Node)) {
          setIsCrmFilterOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingId) {
       const cred = credentials.find(c => c.id === editingId);
       if (cred) setNewCred({ clientName: cred.clientName, serviceName: cred.serviceName, crmLink: cred.crmLink, username: cred.username, password: cred.password, folderId: cred.folderId });
    }
  }, [editingId, credentials]);

  // --- DATA FETCHING ---
  const fetchData = async () => {
    try {
      setIsLoadingData(true);
      // Fetch Credentials
      const { data: credsData, error: credsError } = await supabase.from('credentials').select('*').order('last_updated', { ascending: false });
      if (credsError) throw credsError;
      if (credsData) {
        setCredentials(credsData.map((item: any) => ({
          id: item.id,
          clientName: item.client_name,
          serviceName: item.service_name,
          crmLink: item.crm_link || '',
          username: item.username || '',
          password: item.password || '',
          lastUpdated: new Date(item.last_updated),
          folderId: item.folder_id || null
        })));
      }

      // Fetch Folders
      const { data: foldersData } = await supabase.from('folders').select('*').order('name', { ascending: true });
      if (foldersData) {
        setFolders(foldersData.map((item: any) => ({
          id: item.id,
          name: item.name,
          parentId: item.parent_id,
          createdAt: item.created_at,
          type: item.type // Fetch type from DB
        })));
      }

      // Fetch Forms
      const { data: formsData } = await supabase.from('forms').select('*').order('created_at', { ascending: false });
      if (formsData) {
        setForms(formsData.map((f: any) => ({
          id: f.id,
          name: f.name,
          folderId: f.folder_id,
          webhookKey: f.webhook_key, 
          webhookUrl: `${BASE_WEBHOOK_URL}?key=${f.webhook_key}`,
          fields: f.fields || [],
          createdAt: f.created_at,
          status: f.status || 'draft'
        })));
      }

    } catch (error: any) { 
        console.warn('Error fetching data', error);
        setToast({ message: "Sync error. Check connection or schema.", type: 'error' });
    } 
    finally { setIsLoadingData(false); }
  };

  const fetchFormSubmissions = async (formId: string) => {
      setIsLoadingSubmissions(true);
      try {
          const { data, error } = await supabase
            .from('form_submissions')
            .select('*')
            .eq('form_id', formId)
            .order('created_at', { ascending: false });
            
          if (error) throw error;
          
          if (data) {
              const mappedSubmissions = data.map((item: any) => ({
                  id: item.id,
                  source: item.source || 'Unknown Source',
                  timestamp: item.created_at,
                  status: item.status || 'pending',
                  ipAddress: item.ip_address || 'Hidden',
                  payload: item.payload || {},
                  mapped_data: item.mapped_data || null
              }));
              setActiveFormSubmissions(mappedSubmissions);
              
              if (mappedSubmissions.length > 0) {
                  setLatestPayload(mappedSubmissions[0].payload);
                  setMappingReferenceId(mappedSubmissions[0].id);
              }
          }
      } catch (err) {
          console.error("Failed to fetch form submissions", err);
          setToast({ message: "Failed to load submissions for this form", type: 'error' });
      } finally {
          setIsLoadingSubmissions(false);
      }
  };

  useEffect(() => {
      setActiveFormSubmissions([]);
      setViewingSubmission(null);
      setLatestPayload(null);
      setMappingReferenceId(null);
      if (currentFormId) fetchFormSubmissions(currentFormId);
  }, [currentFormId]);

  // --- HELPERS ---
  const flattenPayload = (obj: any, prefix = ''): Record<string, any> => {
    let result: Record<string, any> = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                Object.assign(result, flattenPayload(value, newKey));
            } else {
                result[newKey] = value;
            }
        }
    }
    return result;
  };

  const getNestedValue = (obj: any, path: string): any => {
      if (!path) return undefined;
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const getCrmStyle = (crmName: string) => {
    if (!crmName) return CRM_COLORS[0];
    let hash = 0;
    for (let i = 0; i < crmName.length; i++) hash = crmName.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % CRM_COLORS.length;
    return CRM_COLORS[index];
  };

  const breadcrumbPath = useMemo(() => {
    if (!currentFolderId) return [];
    const path: FolderType[] = [];
    let current = folders.find(f => f.id === currentFolderId);
    while (current) {
      path.unshift(current);
      current = folders.find(f => f.id === current!.parentId);
    }
    return path;
  }, [currentFolderId, folders]);

  const toggleSelection = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedItems(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          return newSet;
      });
  };

  const copyToClipboard = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setToast({ message: "Copied to clipboard", type: "success" });
  };

  // --- ACTIONS ---
  const handleCreateFolder = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newFolderName.trim()) return;
      setIsProcessingAction(true);
      try {
          // Determine type based on active tab
          const folderType = activeMainTab === 'credentials' ? 'credential' : 'form';
          
          const { data, error } = await supabase.from('folders').insert({
              name: newFolderName,
              parent_id: currentFolderId,
              type: folderType
          }).select().single();

          if (error) throw error;

          if (data) {
              setFolders(prev => [...prev, {
                  id: data.id,
                  name: data.name,
                  parentId: data.parent_id,
                  createdAt: data.created_at,
                  type: data.type
              }]);
              setIsCreateFolderModalOpen(false);
              setNewFolderName('');
              setToast({ message: "Folder created", type: "success" });
          }
      } catch (err: any) {
          setToast({ message: err.message || "Failed to create folder", type: "error" });
      } finally {
          setIsProcessingAction(false);
      }
  };

  const confirmDelete = async () => {
    const { id, type } = deleteConfirmation;
    setIsProcessingAction(true);
    try {
        if (type === 'bulk') {
            const ids = Array.from(selectedItems);
            if (activeMainTab === 'credentials') {
                await supabase.from('credentials').delete().in('id', ids);
                await supabase.from('folders').delete().in('id', ids);
                setCredentials(prev => prev.filter(c => !ids.includes(c.id)));
                setFolders(prev => prev.filter(f => !ids.includes(f.id)));
            } else {
                await supabase.from('forms').delete().in('id', ids);
                setForms(prev => prev.filter(f => !ids.includes(f.id)));
            }
            setSelectedItems(new Set());
            setToast({ message: `${ids.length} items deleted`, type: "success" });
        } else if (id) {
            if (type === 'credential') {
                await supabase.from('credentials').delete().eq('id', id);
                setCredentials(prev => prev.filter(c => c.id !== id));
            } else if (type === 'folder') {
                const { error } = await supabase.from('folders').delete().eq('id', id);
                if (error) throw error;
                setFolders(prev => prev.filter(f => f.id !== id));
            } else if (type === 'form') {
                await supabase.from('forms').delete().eq('id', id);
                setForms(prev => prev.filter(f => f.id !== id));
                if (currentFormId === id) setCurrentFormId(null);
            }
            setToast({ message: "Item deleted", type: "success" });
        }
    } catch (err: any) {
        if (err.code === '23503') {
             setToast({ message: "Cannot delete folder not empty.", type: "error" });
        } else {
             setToast({ message: err.message || "Delete failed", type: "error" });
        }
    } finally {
        setIsProcessingAction(false);
        setDeleteConfirmation({ isOpen: false, id: null, type: 'credential' });
    }
  };

  const handleBulkMove = async () => {
      if (!moveTargetFolderId && moveTargetFolderId !== null) return; 
      const ids = Array.from(selectedItems);
      setIsProcessingAction(true);
      
      try {
          if (activeMainTab === 'credentials') {
              const credIds = credentials.filter(c => ids.includes(c.id)).map(c => c.id);
              if (credIds.length > 0) {
                  await supabase.from('credentials').update({ folder_id: moveTargetFolderId }).in('id', credIds);
                  setCredentials(prev => prev.map(c => credIds.includes(c.id) ? { ...c, folderId: moveTargetFolderId } : c));
              }
              const folderIds = folders.filter(f => ids.includes(f.id)).map(f => f.id);
              if (folderIds.length > 0) {
                  await supabase.from('folders').update({ parent_id: moveTargetFolderId }).in('id', folderIds);
                  setFolders(prev => prev.map(f => folderIds.includes(f.id) ? { ...f, parentId: moveTargetFolderId } : f));
              }
          } else {
              const formIds = forms.filter(f => ids.includes(f.id)).map(f => f.id);
              if (formIds.length > 0) {
                  await supabase.from('forms').update({ folder_id: moveTargetFolderId }).in('id', formIds);
                  setForms(prev => prev.map(f => formIds.includes(f.id) ? { ...f, folderId: moveTargetFolderId } : f));
              }
          }
          setToast({ message: "Items moved successfully", type: "success" });
          setIsMoveModalOpen(false);
          setSelectedItems(new Set());
      } catch (err) {
          setToast({ message: "Failed to move items", type: "error" });
      } finally {
          setIsProcessingAction(false);
      }
  };

  // --- FILTERING & PAGINATION LOGIC ---
  const availableCrms = useMemo(() => {
    const services = new Set(credentials.map(c => c.serviceName).filter(Boolean));
    return ['All', ...Array.from(services).sort()];
  }, [credentials]);
  
  const currentFolders = folders.filter(f => {
      const isCorrectType = activeMainTab === 'credentials' 
          ? (f.type === 'credential' || !f.type) // Legacy support: null type shows in credentials
          : (f.type === 'form');

      if (searchQuery) return f.name.toLowerCase().includes(searchQuery.toLowerCase()) && isCorrectType;
      
      if (currentFolderId) {
          // Inside a folder, we trust the parent/child relationship
          return f.parentId === currentFolderId;
      } else {
          // Root Level: Must filter by type
          return f.parentId === null && isCorrectType;
      }
  });

  const currentCredentials = credentials.filter(c => {
      const matchesCrm = crmFilter === 'All' || c.serviceName === crmFilter;
      if (searchQuery) {
          return c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) && matchesCrm;
      }
      return c.folderId === currentFolderId && matchesCrm;
  });

  const currentForms = forms.filter(f => {
      if (searchQuery) return f.name.toLowerCase().includes(searchQuery.toLowerCase());
      return f.folderId === currentFolderId;
  });

  const activeItems = activeMainTab === 'credentials' ? currentCredentials : currentForms;
  
  const totalItems = currentFolders.length + activeItems.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  const displayFolders = currentFolders.slice(startIndex, endIndex);
  
  const slotsUsedByFolders = Math.max(0, Math.min(currentFolders.length, endIndex) - Math.max(0, startIndex));
  const remainingSlots = ITEMS_PER_PAGE - slotsUsedByFolders;
  
  let displayItems: any[] = [];
  if (remainingSlots > 0) {
      const itemStartIndex = Math.max(0, startIndex - currentFolders.length);
      displayItems = activeItems.slice(itemStartIndex, itemStartIndex + remainingSlots);
  }

  // --- SELECTION LOGIC ---
  const handleSelectAll = () => {
      const allVisibleIds = [...displayFolders, ...displayItems].map(i => i.id);
      
      // If all visible items are already selected, deselect them
      const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedItems.has(id));
      
      setSelectedItems(prev => {
          const newSet = new Set(prev);
          if (allSelected) {
              allVisibleIds.forEach(id => newSet.delete(id));
          } else {
              allVisibleIds.forEach(id => newSet.add(id));
          }
          return newSet;
      });
  };

  // --- RENDERERS ---
  const activeForm = forms.find(f => f.id === currentFormId);
  const computedMappedData = useMemo(() => {
      if (!viewingSubmission || !activeForm) return {};
      const dbMapped = viewingSubmission.mapped_data || {};
      const liveMapped: Record<string, any> = {};
      activeForm.fields.forEach(field => {
          if (field.mappedKey) {
              const val = getNestedValue(viewingSubmission.payload, field.mappedKey);
              if (val !== undefined) liveMapped[field.name] = val;
          }
      });
      return { ...dbMapped, ...liveMapped };
  }, [viewingSubmission, activeForm]);

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-center mt-12 mb-8 select-none">
            <div className="bg-white rounded-full shadow-sm border border-gray-200 p-1 flex items-center gap-2">
                <button 
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} 
                    disabled={currentPage === 1} 
                    className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition-all"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                
                <span className="text-xs font-semibold text-gray-700 px-3 min-w-[3rem] text-center">
                    {currentPage} / {totalPages}
                </span>
                
                <button 
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} 
                    disabled={currentPage === totalPages} 
                    className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition-all"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
  };

  // ... (Payload renderers remain unchanged)
  const PayloadRenderer = ({ data, level = 0 }: { data: any, level?: number }) => {
      if (typeof data !== 'object' || data === null) return <span className="text-gray-800 break-words font-mono text-sm">{String(data)}</span>;
      return (
          <div className="space-y-2">
              {Object.entries(data).map(([key, value]) => {
                  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
                  return (
                      <div key={key} className={`flex flex-col ${level > 0 ? 'ml-4 border-l border-gray-200 pl-4' : ''}`}>
                          {isObject ? (
                              <div className="mt-2 mb-1"><span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded-md">{key}</span><div className="mt-2"><PayloadRenderer data={value} level={level + 1} /></div></div>
                          ) : (
                              <div className="flex flex-col sm:flex-row gap-2 py-1 group"><div className="sm:w-1/3 pt-2"><label className="text-sm font-medium text-gray-700 break-words font-mono text-xs">{key}</label></div><div className="flex-1"><div className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 break-words font-mono min-h-[38px] shadow-sm group-hover:border-indigo-300 transition-colors">{String(value)}</div></div></div>
                          )}
                      </div>
                  );
              })}
          </div>
      );
  };

  const MappingPayloadRenderer = ({ data, parentKey = '' }: { data: Record<string, any>, parentKey?: string }) => {
    if (!data || Object.keys(data).length === 0) return null;
    return (
        <div className="space-y-6">{Object.entries(data).map(([key, value]) => {
                const fullKey = parentKey ? `${parentKey}.${key}` : key;
                const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
                if (isObject) return (<div key={key} className="pt-2"><div className="mb-3 flex items-center"><span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 shadow-sm">{key}</span><div className="h-px bg-gray-100 flex-1 ml-3"></div></div><div className="ml-2 pl-4 border-l-2 border-gray-100 space-y-4"><MappingPayloadRenderer data={value} parentKey={fullKey} /></div></div>);
                return (<div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 group transition-all rounded-lg p-2 -mx-2 hover:bg-gray-50 border border-transparent"><div className="sm:w-1/3 flex-shrink-0 min-w-0"><label className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors break-words">{key}</label></div><div className="flex-1 w-full min-w-0"><div className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 font-mono shadow-sm transition-colors group-hover:border-gray-300 break-all">{String(value)}</div></div></div>);
            })}</div>
    );
  };
  
  // ... (Other handlers unchanged)
  const handleFormStatusToggle = async () => { if (!currentFormId) return; const form = forms.find(f => f.id === currentFormId); if (!form) return; const newStatus = form.status === 'active' ? 'draft' : 'active'; setForms(prev => prev.map(f => f.id === currentFormId ? { ...f, status: newStatus } : f)); try { await supabase.from('forms').update({ status: newStatus }).eq('id', currentFormId); setToast({ message: `Form ${newStatus === 'active' ? 'Activated' : 'Deactivated'}`, type: 'success' }); } catch (err) { setForms(prev => prev.map(f => f.id === currentFormId ? { ...f, status: form.status } : f)); setToast({ message: "Failed to update status", type: "error" }); } };
  const handleRegenerateWebhookKey = async () => { if (!currentFormId) return; if (!window.confirm("Regenerating the key will break existing integrations. Continue?")) return; const newKey = crypto.randomUUID(); try { await supabase.from('forms').update({ webhook_key: newKey }).eq('id', currentFormId); setForms(prev => prev.map(f => f.id === currentFormId ? { ...f, webhookKey: newKey, webhookUrl: `${BASE_WEBHOOK_URL}?key=${newKey}` } : f)); setToast({ message: "Webhook Key Regenerated", type: "success" }); } catch (err) { setToast({ message: "Failed to regenerate key", type: "error" }); } };
  const addFieldToForm = async (type: FieldType) => { if (!currentFormId) return; const form = forms.find(f => f.id === currentFormId); if (!form) return; const newField: FormField = { id: crypto.randomUUID(), name: `New ${type} field`, type, mappedKey: undefined }; const updatedFields = [...form.fields, newField]; setForms(prev => prev.map(f => f.id === currentFormId ? { ...f, fields: updatedFields } : f)); try { await supabase.from('forms').update({ fields: updatedFields }).eq('id', currentFormId); } catch (err) { setToast({ message: "Failed to save field", type: "error" }); } };
  const updateFieldName = async (fieldId: string, newName: string) => { if (!currentFormId) return; setForms(prev => prev.map(f => { if (f.id !== currentFormId) return f; return { ...f, fields: f.fields.map(field => field.id === fieldId ? { ...field, name: newName } : field) }; })); const form = forms.find(f => f.id === currentFormId); if (form) { const updatedFields = form.fields.map(field => field.id === fieldId ? { ...field, name: newName } : field); await supabase.from('forms').update({ fields: updatedFields }).eq('id', currentFormId); } };
  const removeField = async (fieldId: string) => { if (!currentFormId) return; const form = forms.find(f => f.id === currentFormId); if (!form) return; const updatedFields = form.fields.filter(f => f.id !== fieldId); setForms(prev => prev.map(f => f.id === currentFormId ? { ...f, fields: updatedFields } : f)); try { await supabase.from('forms').update({ fields: updatedFields }).eq('id', currentFormId); } catch (err) { setToast({ message: "Failed to remove field", type: "error" }); } };
  const handleExplicitSaveMapping = async () => { if (!currentFormId) return; setIsProcessingAction(true); const form = forms.find(f => f.id === currentFormId); if (!form) return; try { await supabase.from('forms').update({ fields: form.fields }).eq('id', currentFormId); setToast({ message: "Mapping configuration saved", type: "success" }); } catch (err) { setToast({ message: "Failed to save mapping", type: "error" }); } finally { setIsProcessingAction(false); } };
  const handleReferenceSubmissionChange = (submissionId: string) => { setMappingReferenceId(submissionId); const sub = activeFormSubmissions.find(s => s.id === submissionId); if (sub) setLatestPayload(sub.payload); setIsSubmissionDropdownOpen(false); };
  const handleUpdateStatus = async (submissionId: string, status: 'pending' | 'processed' | 'flagged') => { setActiveFormSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status } : s)); if (viewingSubmission?.id === submissionId) setViewingSubmission(prev => prev ? { ...prev, status } : null); setIsStatusDropdownOpen(false); try { await supabase.from('form_submissions').update({ status }).eq('id', submissionId); setToast({ message: `Marked as ${status}`, type: "success" }); } catch (err) { setToast({ message: "Update failed", type: "error" }); } };
  const handleDeleteSubmission = async () => { if (!viewingSubmission) return; setIsProcessingAction(true); try { await supabase.from('form_submissions').delete().eq('id', viewingSubmission.id); setActiveFormSubmissions(prev => prev.filter(s => s.id !== viewingSubmission.id)); setViewingSubmission(null); setIsDeleteRecordModalOpen(false); setToast({ message: "Submission deleted", type: "success" }); } catch (err) { setToast({ message: "Delete failed", type: "error" }); } finally { setIsProcessingAction(false); } };
  const handleSelectMappingKey = (key: string) => { if (!currentFormId || !activeMappingFieldId) return; setForms(prev => prev.map(f => { if (f.id !== currentFormId) return f; return { ...f, fields: f.fields.map(field => field.id === activeMappingFieldId ? { ...field, mappedKey: key } : field) }; })); setIsMappingModalOpen(false); setActiveMappingFieldId(null); };

  const renderMappingPicker = () => {
      if (!latestPayload) return <div className="p-4 text-gray-500 text-sm">No reference data available.</div>;
      const flat = flattenPayload(latestPayload);
      const keys = Object.keys(flat).filter(k => k.toLowerCase().includes(mappingSearchQuery.toLowerCase()));
      if (keys.length === 0) return <div className="p-4 text-gray-500 text-sm">No matching keys found.</div>;
      return (
          <div className="space-y-1">
              {keys.map(key => (
                  <button key={key} onClick={() => handleSelectMappingKey(key)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 text-sm font-mono text-gray-700 hover:text-indigo-700 flex justify-between items-center group">
                      <span>{key}</span>
                      <span className="text-gray-400 text-xs truncate max-w-[150px] group-hover:text-indigo-400">{String(flat[key])}</span>
                  </button>
              ))}
          </div>
      );
  };

  // --- RESTRICTED ACCESS VIEW ---
  if (!hasVaultAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="bg-gray-100 p-6 rounded-full mb-6">
          <Ban className="h-16 w-16 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Restricted Access</h1>
        <p className="text-gray-500 max-w-md mx-auto mb-8">
          Your operative clearance level does not grant access to the secured vault. Contact a Master Administrator if you require elevated privileges.
        </p>
        <Button onClick={() => navigate('/chat')}>Proceed to Comms</Button>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <div className="space-y-6 pb-24 relative min-h-screen"> 
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4 sticky top-0 bg-gray-50 z-30 py-4 -mt-4 px-1">
        <div><h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2"><CipherText text="ODL Vault" /></h1><p className="mt-1 text-gray-500">Secured Operation Data Layer</p></div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center">
            {!currentFormId && (
                <div className="relative group w-full md:w-64 lg:w-80 shadow-sm rounded-xl"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div><input type="text" className="block w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all" placeholder={activeMainTab === 'credentials' ? "Search secure records..." : "Search forms..."} value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} /></div>
            )}

            {/* CRM Filter Dropdown */}
            {!currentFormId && activeMainTab === 'credentials' && (
                <div className="relative" ref={crmFilterRef}>
                    <button
                        onClick={() => setIsCrmFilterOpen(!isCrmFilterOpen)}
                        className={`flex items-center gap-2 px-3 py-2.5 bg-white border rounded-xl text-sm font-medium transition-all shadow-sm ${
                            crmFilter !== 'All' 
                            ? 'border-indigo-200 text-indigo-600 bg-indigo-50' 
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                        <ListFilter className="h-4 w-4" />
                        <span className="max-w-[100px] truncate">{crmFilter === 'All' ? 'Filter CRM' : crmFilter}</span>
                        <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${isCrmFilterOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                        {isCrmFilterOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto"
                            >
                                <div className="p-1">
                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Services</div>
                                    {availableCrms.map(crm => (
                                        <button
                                            key={crm}
                                            onClick={() => { setCrmFilter(crm); setIsCrmFilterOpen(false); setCurrentPage(1); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                                                crmFilter === crm ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span className="truncate">{crm}</span>
                                            {crmFilter === crm && <Check size={14} className="text-indigo-600" />}
                                        </button>
                                    ))}
                                    {availableCrms.length === 1 && (
                                        <div className="px-3 py-4 text-center text-xs text-gray-400 italic">No services found</div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

           <div className="flex-shrink-0 flex space-x-2">
               {canMutate && (
                 <>
                   <Button onClick={() => setIsCreateFolderModalOpen(true)} variant="secondary" className="bg-white border-gray-200 text-gray-600 hover:bg-gray-50 px-3 shadow-sm"><FolderPlus className="h-5 w-5" /></Button>
                   {activeMainTab === 'credentials' ? <Button onClick={() => { setEditingId(null); setIsAddModalOpen(true); }} className="w-full sm:w-auto shadow-sm shadow-indigo-200"><Plus className="h-5 w-5 mr-2" />Add Credential</Button> : !currentFormId && <Button onClick={() => setIsCreateFormModalOpen(true)} className="w-full sm:w-auto shadow-sm shadow-indigo-200"><Plus className="h-5 w-5 mr-2" />New Form</Button>}
                 </>
               )}
           </div>
        </div>
      </div>
      
      {/* TABS */}
      <div className="border-b border-gray-200 flex items-center justify-between pr-4"><nav className="-mb-px flex space-x-8"><button onClick={() => { setActiveMainTab('credentials'); setCurrentFormId(null); }} className={`${activeMainTab === 'credentials' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all outline-none focus:outline-none`}><Lock className={`-ml-0.5 mr-2 h-5 w-5 ${activeMainTab === 'credentials' ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}`} /><span>Credentials Vault</span></button><button onClick={() => { setActiveMainTab('submissions'); }} className={`${activeMainTab === 'submissions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all outline-none focus:outline-none`}><FileText className={`-ml-0.5 mr-2 h-5 w-5 ${activeMainTab === 'submissions' ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}`} /><span>Form Manager</span></button></nav></div>

      {/* MAIN CONTENT AREA */}
      <section className="relative mt-6 h-full min-h-[400px]">
          {isLoadingData ? (<div className="flex flex-col items-center justify-center h-64 mt-8"><Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" /><p className="text-gray-500 font-medium">Decrypting Vault...</p></div>) : (
            <>
                {/* BREADCRUMBS */}
                {!currentFormId && !searchQuery && (
                    <div className="flex items-center mb-6 text-sm text-gray-500 animate-fade-in">
                        <button onClick={() => setCurrentFolderId(null)} className={`flex items-center hover:text-indigo-600 transition-colors ${!currentFolderId ? 'font-bold text-gray-800' : ''}`}><Home className="h-4 w-4 mr-1" />{activeMainTab === 'credentials' ? 'Vault Root' : 'Forms Root'}</button>
                        {breadcrumbPath.map((folder, index) => (<div key={folder.id} className="flex items-center"><ChevronRight className="h-4 w-4 mx-1 text-gray-300" /><button onClick={() => setCurrentFolderId(folder.id)} className={`hover:text-indigo-600 transition-colors ${index === breadcrumbPath.length - 1 ? 'font-bold text-gray-800' : ''}`}>{folder.name}</button></div>))}
                    </div>
                )}

                {/* VIEW SWITCHER */}
                {activeMainTab === 'submissions' && currentFormId ? (
                    // --- SINGLE FORM DETAIL VIEW ---
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-180px)] animate-fade-in-up">
                        {/* (... existing Form Detail content kept as is for brevity ...) */}
                        <div className="border-b border-gray-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50/50 gap-4 flex-shrink-0">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <button onClick={() => setCurrentFormId(null)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 transition-all border border-transparent hover:border-gray-200 flex-shrink-0"><ChevronLeft className="h-5 w-5" /></button>
                                <div className="min-w-0"><h2 className="text-xl font-bold text-gray-900 truncate">{activeForm?.name}</h2><div className="flex items-center gap-2 mt-1"><div className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2" style={{ backgroundColor: activeForm?.status === 'active' ? '#10b981' : '#e5e7eb' }} onClick={handleFormStatusToggle}><span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${activeForm?.status === 'active' ? 'translate-x-4' : 'translate-x-0'}`} /></div><span className={`text-[10px] font-bold uppercase tracking-wider ${activeForm?.status === 'active' ? 'text-emerald-600' : 'text-gray-400'}`}>{activeForm?.status === 'active' ? 'Active' : 'Draft'}</span><div className="h-4 w-px bg-gray-300 mx-1"></div><span className="text-xs text-gray-400 font-mono flex items-center gap-1 truncate max-w-[150px] sm:max-w-[300px]"><LinkIcon className="h-3 w-3 flex-shrink-0" />{activeForm?.webhookUrl}</span><button onClick={() => copyToClipboard(activeForm?.webhookUrl || '')} className="p-1 hover:bg-white hover:text-indigo-600 rounded-md transition-colors text-gray-400" title="Copy Webhook URL"><Copy className="h-3.5 w-3.5" /></button><button onClick={handleRegenerateWebhookKey} className="p-1 hover:bg-white hover:text-indigo-600 rounded-md transition-colors text-gray-400 ml-1" title="Regenerate Key"><RefreshCcw className="h-3.5 w-3.5" /></button></div></div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                                <div className="flex bg-gray-200/50 p-1.5 rounded-xl">
                                    <button onClick={() => setFormViewMode('overview')} className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${formViewMode === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Submissions</button>
                                    {canEditSchema && (
                                        <>
                                            <button onClick={() => setFormViewMode('builder')} className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${formViewMode === 'builder' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Form Builder</button>
                                            <button onClick={() => setFormViewMode('mapping')} className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${formViewMode === 'mapping' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Map Fields</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 bg-gray-50/30 overflow-hidden flex flex-col relative h-full">
                            {/* ... Content bodies (builder, mapping, overview) ... */}
                            {formViewMode === 'builder' && canEditSchema && (
                                <div className="w-full h-full flex flex-col lg:flex-row overflow-hidden">
                                    <div className="flex-1 lg:w-2/3 flex flex-col min-h-0 overflow-y-auto p-6 md:p-8 space-y-4">
                                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Form Structure</h3>
                                        {activeForm?.fields.length === 0 && <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400"><LayoutTemplate className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>No fields defined yet.</p></div>}
                                        {activeForm?.fields.map((field) => (
                                            <div key={field.id} className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3 group transition-colors">
                                                <div className="p-2 bg-gray-50 rounded-lg text-gray-500">{field.type === 'text' && <Type className="h-4 w-4" />}{field.type === 'textarea' && <AlignLeft className="h-4 w-4" />}{field.type === 'email' && <Mail className="h-4 w-4" />}{field.type === 'phone' && <Phone className="h-4 w-4" />}</div>
                                                <input value={field.name} onChange={(e) => updateFieldName(field.id, e.target.value)} className="flex-1 bg-transparent rounded-lg px-2 py-1 outline-none font-medium text-gray-900 placeholder-gray-400 transition-colors hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100" placeholder="Field Name" />
                                                <button onClick={() => removeField(field.id)} className="text-gray-300 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="w-full lg:w-1/3 bg-white border-l border-gray-200 p-6 overflow-y-auto">
                                        <div className="sticky top-0"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center"><Plus className="w-3 h-3 mr-1"/> Add Field</h3><div className="grid grid-cols-2 gap-3"><button onClick={() => addFieldToForm('text')} className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all text-gray-600 group"><Type className="h-6 w-6 mb-2 opacity-70 group-hover:scale-110 transition-transform" /><span className="text-xs font-medium">Text</span></button><button onClick={() => addFieldToForm('textarea')} className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all text-gray-600 group"><AlignLeft className="h-6 w-6 mb-2 opacity-70 group-hover:scale-110 transition-transform" /><span className="text-xs font-medium">Large Text</span></button><button onClick={() => addFieldToForm('email')} className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all text-gray-600 group"><Mail className="h-6 w-6 mb-2 opacity-70 group-hover:scale-110 transition-transform" /><span className="text-xs font-medium">Email</span></button><button onClick={() => addFieldToForm('phone')} className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all text-gray-600 group"><Phone className="h-6 w-6 mb-2 opacity-70 group-hover:scale-110 transition-transform" /><span className="text-xs font-medium">Phone</span></button></div></div>
                                    </div>
                                </div>
                            )}
                            {formViewMode === 'mapping' && canEditSchema && (
                                <div className="w-full h-full flex flex-col lg:flex-row overflow-hidden">
                                    <div className="flex-1 lg:w-1/2 flex flex-col min-h-0 overflow-hidden bg-gray-50/50 border-r border-gray-200 order-2 lg:order-1">
                                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white"><h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Field Mapping</h3><Button onClick={handleExplicitSaveMapping} className="h-8 text-xs" isLoading={isProcessingAction}><Save className="h-3 w-3 mr-2" />Save Configuration</Button></div>
                                        <div className="overflow-y-auto p-6 space-y-3 flex-1">
                                            {activeForm?.fields.map(field => {
                                                return (
                                                    <div key={field.id} className={`flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border shadow-sm gap-4 transition-all border-gray-200 hover:border-indigo-300`}>
                                                        <div className="flex items-center gap-3"><div className={`p-2 rounded-lg bg-indigo-50 text-indigo-600`}>{field.type === 'email' ? <Mail size={16} /> : <Type size={16} />}</div><span className={`font-medium text-sm text-gray-900`}>{field.name}</span></div>
                                                        <div className="hidden sm:block"><ArrowRightLeft className={`h-4 w-4 text-gray-300`} /></div>
                                                        <div className="w-full sm:w-1/2"><button onClick={() => { setActiveMappingFieldId(field.id); setIsMappingModalOpen(true); setMappingSearchQuery(''); }} className={`w-full text-left bg-gray-50 border hover:bg-white transition-all rounded-lg px-3 py-2.5 text-sm flex items-center justify-between group border-gray-200 hover:border-indigo-300`}>{field.mappedKey ? <span className="font-mono text-indigo-600 font-medium truncate">{field.mappedKey}</span> : <span className="text-gray-400 italic">Select data point...</span>}<ChevronDown size={14} className="text-gray-400 group-hover:text-indigo-500 flex-shrink-0 ml-2" /></button></div>
                                                    </div>
                                                );
                                            })}
                                            {activeForm?.fields.length === 0 && <div className="text-center p-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200"><Settings className="h-8 w-8 mx-auto mb-2 opacity-20" /><p className="text-xs">No fields to map. Go to <b>Form Builder</b> to add fields.</p></div>}
                                        </div>
                                    </div>
                                    <div className="flex-1 lg:w-1/2 flex flex-col min-h-0 bg-white order-1 lg:order-2">
                                        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                                            <div><h3 className="text-sm font-bold text-gray-800">Inbound Data</h3><p className="text-[10px] text-gray-500 mt-0.5">Reference Payload</p></div>
                                            <div className="flex items-center gap-2 relative" ref={submissionDropdownRef}>
                                                <button onClick={() => currentFormId && fetchFormSubmissions(currentFormId)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-gray-200" title="Refresh Data"><RefreshCw className={`h-3.5 w-3.5 ${isLoadingSubmissions ? 'animate-spin' : ''}`} /></button>
                                                <div className="relative">
                                                    <button onClick={() => setIsSubmissionDropdownOpen(!isSubmissionDropdownOpen)} className="flex items-center justify-between max-w-[140px] px-2 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm text-[10px] text-gray-700 hover:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"><span className="truncate">{activeFormSubmissions.find(s => s.id === mappingReferenceId) ? `${new Date(activeFormSubmissions.find(s => s.id === mappingReferenceId)!.timestamp).toLocaleTimeString()}...` : "Select..."}</span><ChevronDown className={`ml-1 h-3 w-3 text-gray-400 transition-transform ${isSubmissionDropdownOpen ? 'rotate-180' : ''}`} /></button>
                                                    <AnimatePresence>{isSubmissionDropdownOpen && (<motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">{activeFormSubmissions.length > 0 ? (<div className="py-1">{activeFormSubmissions.slice(0, 20).map((sub) => (<button key={sub.id} onClick={() => handleReferenceSubmissionChange(sub.id)} className={`w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 flex items-center justify-between group border-b border-gray-50 last:border-0 ${mappingReferenceId === sub.id ? 'bg-indigo-50/50 text-indigo-700' : 'text-gray-600'}`}><span className="font-medium truncate">{new Date(sub.timestamp).toLocaleString()}</span><span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-2 font-mono">{sub.id.slice(0, 4)}</span></button>))}</div>) : (<div className="px-4 py-8 text-center text-gray-400 text-xs">No submissions found</div>)}</motion.div>)}</AnimatePresence>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto flex-1 p-6 bg-white">{latestPayload ? (<MappingPayloadRenderer data={latestPayload} />) : (<div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-8"><Database className="h-8 w-8 mb-2 opacity-20" /><p className="text-xs italic">Waiting for data...</p></div>)}</div>
                                    </div>
                                </div>
                            )}
                            {(formViewMode === 'overview' || !canEditSchema) && (
                                <div className="flex flex-col lg:flex-row h-full overflow-hidden">
                                    <div className="w-full lg:w-[400px] border-r border-gray-200 bg-white flex-shrink-0 flex flex-col">
                                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Submitted Data</h3></div>
                                        <div className="flex-1 overflow-y-auto">
                                            {isLoadingSubmissions ? (<div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" /><p className="text-xs text-gray-400">Loading requests...</p></div>) : activeFormSubmissions.length > 0 ? (<div className="divide-y divide-gray-100">{activeFormSubmissions.map(sub => {
                                                        const isActive = viewingSubmission?.id === sub.id;
                                                        // ... Title Generation ...
                                                        let displayTitle = 'Unprocessed';
                                                        if (sub.mapped_data && Object.keys(sub.mapped_data).length > 0) {
                                                            const nameKey = Object.keys(sub.mapped_data).find(k => k.toLowerCase().includes('name'));
                                                            displayTitle = nameKey ? String(sub.mapped_data[nameKey]) : String(Object.values(sub.mapped_data)[0]);
                                                        } else if (activeForm && activeForm.fields.length > 0) {
                                                            const nameField = activeForm.fields.find(f => f.name.toLowerCase().includes('name'));
                                                            if (nameField && nameField.mappedKey) { const val = getNestedValue(sub.payload, nameField.mappedKey); if (val) displayTitle = String(val); }
                                                            if (displayTitle === 'Unprocessed') { const firstMapped = activeForm.fields.find(f => f.mappedKey); if (firstMapped) { const val = getNestedValue(sub.payload, firstMapped.mappedKey); if (val) displayTitle = String(val); } }
                                                            if (displayTitle === 'Unprocessed' && sub.payload) { const flattened = flattenPayload(sub.payload); const nameKey = Object.keys(flattened).find(k => ['name', 'full_name', 'firstname', 'client', 'customer', 'user', 'email'].some(term => k.toLowerCase().includes(term))); if (nameKey) displayTitle = String(flattened[nameKey]); }
                                                        }
                                                        if (displayTitle === 'Unprocessed') displayTitle = `Submission ${sub.id.slice(0,6)}`;
                                                        const hasMappedData = displayTitle !== `Submission ${sub.id.slice(0,6)}` && displayTitle !== 'Unprocessed';

                                                        return (
                                                            <div key={sub.id} onClick={() => setViewingSubmission(sub)} className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${isActive ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}>
                                                                <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-2"><span className={`text-xs font-semibold truncate max-w-[180px] ${isActive ? 'text-indigo-900' : (hasMappedData ? 'text-gray-900' : 'text-indigo-600')}`}>{displayTitle}</span></div><span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide ${sub.status === 'processed' ? 'bg-emerald-100 text-emerald-700' : sub.status === 'flagged' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{sub.status}</span></div>
                                                                <div className="text-[10px] text-gray-400 truncate">{new Date(sub.timestamp).toLocaleDateString()} {new Date(sub.timestamp).toLocaleTimeString()} • {sub.source}</div>
                                                            </div>
                                                        );
                                                    })}</div>) : (<div className="p-8 text-center text-gray-400"><FileText className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-xs">No requests logged.</p></div>)}
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-gray-50/30 overflow-y-auto p-6 md:p-8">
                                        {/* ... Detail Right Panel ... */}
                                        {viewingSubmission ? (
                                            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                    <div><h3 className="text-lg font-bold text-gray-900 mb-1">Submission Details</h3><div className="flex gap-4 text-xs text-gray-500"><span>ID: {viewingSubmission.id}</span><span>{new Date(viewingSubmission.timestamp).toLocaleString()}</span></div></div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative" ref={statusDropdownRef}>
                                                            <button onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${viewingSubmission.status === 'processed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' : viewingSubmission.status === 'flagged' ? 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'}`}>{viewingSubmission.status}<ChevronDown size={14} /></button>
                                                            <AnimatePresence>{isStatusDropdownOpen && (<motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full right-0 mt-2 w-32 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden"><div className="py-1"><button onClick={() => handleUpdateStatus(viewingSubmission.id, 'pending')} className="w-full text-left px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50">Pending</button><button onClick={() => handleUpdateStatus(viewingSubmission.id, 'processed')} className="w-full text-left px-4 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50">Processed</button><button onClick={() => handleUpdateStatus(viewingSubmission.id, 'flagged')} className="w-full text-left px-4 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50">Flagged</button></div></motion.div>)}</AnimatePresence>
                                                        </div>
                                                        <div className="h-6 w-px bg-gray-200 mx-2"></div>
                                                        <button onClick={() => setShowRawPayload(!showRawPayload)} className={`p-2 rounded-lg transition-colors border ${showRawPayload ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-gray-400 border-transparent hover:bg-gray-100'}`} title="Toggle Raw JSON">{showRawPayload ? <TableIcon size={18} /> : <FileJson size={18} />}</button>
                                                    </div>
                                                </div>
                                                {!showRawPayload ? (
                                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200"><h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Processed Data</h4></div>
                                                        <div className="divide-y divide-gray-100">
                                                            {Object.keys(computedMappedData).length > 0 ? (
                                                                Object.entries(computedMappedData).map(([key, value]) => {
                                                                    const isEmpty = !value || value === 'null' || value === '';
                                                                    return (
                                                                        <div key={key} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-gray-50 transition-colors">
                                                                            <div className="sm:w-1/3 flex items-center gap-2"><div className={`p-1.5 rounded-md ${isEmpty ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{isEmpty ? <AlertCircle size={14} /> : <CheckCheck size={14} />}</div><span className="text-sm font-medium text-gray-700">{key}</span></div>
                                                                            <div className="flex-1"><div className={`text-sm rounded-lg px-3 py-2 border ${isEmpty ? 'text-rose-600 bg-rose-50 border-rose-200 font-semibold' : 'text-gray-900 bg-gray-50 border-gray-200'}`}>{isEmpty ? 'No Data Found' : String(value)}</div></div>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (<div className="p-8 text-center"><ShieldAlert className="h-8 w-8 mx-auto mb-2 text-gray-300" /><p className="text-sm font-medium text-gray-600">No processed data available.</p><p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">This submission has not been processed against the current map. Go to <b>Map Fields</b> and click <b>Save Configuration</b> to process historical data.</p></div>)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
                                                        <div className="mb-4 pb-2 border-b border-gray-100 flex justify-between items-center"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Raw Payload Data</h4></div>
                                                        <PayloadRenderer data={viewingSubmission.payload} />
                                                    </div>
                                                )}
                                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                                                    <Button variant="danger" onClick={() => setIsDeleteRecordModalOpen(true)} className="text-xs">Delete Record</Button>
                                                    {canEditSchema && <Button className="text-xs" onClick={() => setFormViewMode('mapping')}><Settings className="w-3.5 h-3.5 mr-2" />Configure Mapping</Button>}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8"><div className="w-16 h-16 bg-gray-200/50 rounded-full flex items-center justify-center mb-4"><LayoutTemplate className="w-8 h-8 text-gray-300" /></div><h3 className="text-lg font-semibold text-gray-500 mb-2">No Data Selected</h3><p className="text-sm max-w-xs text-center">Select a submission from the list on the left to view detailed payload information.</p></div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // --- GRID VIEW ---
                    <motion.div 
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 pb-20"
                    >
                        {/* FOLDERS GRID */}
                        <AnimatePresence mode='popLayout'>
                            {displayFolders.map(folder => (
                                <motion.div 
                                    variants={itemVariants}
                                    key={folder.id} 
                                    onClick={() => setCurrentFolderId(folder.id)} 
                                    exit="exit"
                                    className={`group relative bg-white p-6 rounded-2xl border transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between h-[200px] min-w-0 ${selectedItems.has(folder.id) ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50/10' : 'border-gray-200 hover:border-indigo-200'}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="ml-auto z-10">
                                           <div onClick={(e) => toggleSelection(folder.id, e)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedItems.has(folder.id) ? 'bg-indigo-600 border-indigo-600 text-white scale-110' : 'bg-white border-gray-200 text-transparent hover:border-indigo-400'}`}>
                                              <Check size={16} strokeWidth={3} />
                                           </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 relative">
                                        <div className="absolute -top-12 -left-2 p-3 bg-indigo-50 rounded-2xl group-hover:scale-110 transition-transform">
                                            <Folder className={`h-8 w-8 ${selectedItems.has(folder.id) ? 'text-indigo-600' : 'text-indigo-500'}`} />
                                        </div>
                                        <div className="mt-6 min-w-0">
                                            <h3 className="text-xl font-bold text-gray-900 truncate tracking-tight">{folder.name}</h3>
                                            <p className="text-sm text-gray-500 mt-1 font-medium">{folders.filter(f => f.parentId === folder.id).length} sub-folders</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {/* ITEMS GRID */}
                            {displayItems.map(item => {
                                if (activeMainTab === 'credentials') {
                                    const cred = item as StoredCredential;
                                    const style = getCrmStyle(cred.serviceName);
                                    return (
                                        <motion.div 
                                            variants={itemVariants}
                                            key={cred.id} 
                                            onClick={() => canMutate && setEditingId(cred.id)}
                                            exit="exit"
                                            className={`group relative bg-white rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col h-[220px] min-w-0 ${selectedItems.has(cred.id) ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}
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
                                                
                                                <h3 className="font-bold text-gray-900 truncate text-lg mb-4 flex items-center gap-2 group-hover:text-indigo-600 transition-colors min-w-0">
                                                    <span className="truncate">{cred.clientName}</span>
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
                                                        onClick={(e) => copyToClipboard(cred.username, e)}
                                                        className="flex items-center text-sm text-gray-600 group/row hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-100 min-w-0"
                                                        title="Click to copy"
                                                    >
                                                        <UserIcon size={14} className="mr-2 text-gray-400 group-hover/row:text-indigo-500 flex-shrink-0" />
                                                        <span className="truncate flex-1 font-medium">{cred.username}</span>
                                                        <MousePointerClick size={12} className="text-indigo-400 opacity-0 group-hover/row:opacity-100 transition-opacity translate-x-2 group-hover/row:translate-x-0 flex-shrink-0" />
                                                    </div>
                                                    <div 
                                                        onClick={(e) => copyToClipboard(cred.password, e)}
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
                                                          <button onClick={() => setEditingId(cred.id)} className="hover:text-indigo-600 transition-colors p-1"><Pencil size={14} /></button>
                                                          <button onClick={() => setDeleteConfirmation({ isOpen: true, id: cred.id, type: 'credential' })} className="hover:text-rose-600 transition-colors p-1"><Trash2 size={14} /></button>
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
                                            onClick={() => setCurrentFormId(form.id)} 
                                            exit="exit"
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
                                                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmation({ isOpen: true, id: form.id, type: 'form' }); }} className="text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 flex-shrink-0"><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                }
                            })}
                        </AnimatePresence>

                        {/* Empty State */}
                        {displayFolders.length === 0 && displayItems.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                                <div className="bg-white p-4 rounded-full shadow-sm mb-4"><Shield className="h-10 w-10 text-gray-300" /></div>
                                <h3 className="text-base font-bold text-gray-900">Vault Empty</h3>
                                <p className="text-sm text-gray-500 mt-1 mb-6 max-w-sm mx-auto">No records found in this sector. Initiate a new record or create a directory.</p>
                                {canMutate && <Button onClick={() => activeMainTab === 'credentials' ? setIsAddModalOpen(true) : setIsCreateFormModalOpen(true)} variant="secondary" className="text-xs">Create First Record</Button>}
                            </div>
                        )}
                        
                        <div className="col-span-full">
                            <PaginationControls />
                        </div>
                    </motion.div>
                )}
            </>
          )}
      </section>

      {/* --- MODALS --- */}
      
      {/* Create Folder Modal */}
      <Modal isOpen={isCreateFolderModalOpen} onClose={() => setIsCreateFolderModalOpen(false)} title="New Directory">
          <form onSubmit={handleCreateFolder}>
              <Input label="Folder Name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g. Finance, Operations" autoFocus />
              <div className="mt-6 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setIsCreateFolderModalOpen(false)}>Cancel</Button><Button type="submit" isLoading={isProcessingAction}>Create Folder</Button></div>
          </form>
      </Modal>

      {/* Create Form Modal */}
      <Modal isOpen={isCreateFormModalOpen} onClose={() => setIsCreateFormModalOpen(false)} title="Initiate Form Protocol">
          <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newFolderName.trim()) return; 
              setIsProcessingAction(true);
              try {
                  const { data, error } = await supabase.from('forms').insert({ name: newFolderName, folder_id: currentFolderId, status: 'draft' }).select().single();
                  if (error) throw error;
                  setForms(prev => [{ id: data.id, name: data.name, folderId: data.folder_id, webhookKey: data.webhook_key, webhookUrl: `${BASE_WEBHOOK_URL}?key=${data.webhook_key}`, fields: [], createdAt: data.created_at, status: 'draft' }, ...prev]);
                  setIsCreateFormModalOpen(false);
                  setNewFolderName('');
                  setCurrentFormId(data.id);
                  setFormViewMode('builder');
              } catch (err) { setToast({ message: "Creation failed", type: "error" }); } finally { setIsProcessingAction(false); }
          }}>
              <Input label="Form Name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g. Client Intake V1" autoFocus />
              <div className="mt-6 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setIsCreateFormModalOpen(false)}>Cancel</Button><Button type="submit" isLoading={isProcessingAction}>Initialize Form</Button></div>
          </form>
      </Modal>
      
      {/* Mapping Key Modal */}
      <Modal isOpen={isMappingModalOpen} onClose={() => setIsMappingModalOpen(false)} title="Select Data Point">
          <div className="mb-4 relative">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
             <input type="text" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none" placeholder="Search keys..." value={mappingSearchQuery} onChange={(e) => setMappingSearchQuery(e.target.value)} autoFocus />
          </div>
          <div className="max-h-[300px] overflow-y-auto border border-gray-100 rounded-lg bg-gray-50 p-2">
              {renderMappingPicker()}
          </div>
      </Modal>
      
      {/* Delete Confirmation */}
      <Modal isOpen={deleteConfirmation.isOpen} onClose={() => setDeleteConfirmation({ isOpen: false, id: null, type: 'credential' })} title="Confirm Termination">
          <div className="text-center p-4">
              <div className="bg-rose-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-8 w-8 text-rose-600" /></div>
              <h3 className="text-lg font-bold text-gray-900">Delete {deleteConfirmation.type === 'bulk' ? 'Selected Items' : 'Record'}?</h3>
              <p className="text-sm text-gray-500 mt-2">This action is irreversible. All associated data will be incinerated.</p>
              <div className="mt-8 flex justify-center gap-3"><Button variant="secondary" onClick={() => setDeleteConfirmation({ isOpen: false, id: null, type: 'credential' })}>Cancel</Button><Button variant="danger" onClick={confirmDelete} isLoading={isProcessingAction}>Confirm Deletion</Button></div>
          </div>
      </Modal>

      {/* Move Modal */}
      <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} title={`Move ${selectedItems.size} Item(s)`}>
          <div className="space-y-4">
               <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-colors flex items-center" onClick={() => setMoveTargetFolderId(null)}>
                    <Home className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-700">Vault Root</span>
                    {moveTargetFolderId === null && <CheckCircle2 className="h-4 w-4 ml-auto text-indigo-600" />}
               </div>
               <div className="max-h-[200px] overflow-y-auto space-y-2">
                   {folders.filter(f => !selectedItems.has(f.id) && f.type === (activeMainTab === 'credentials' ? 'credential' : 'form')).map(f => (
                       <div key={f.id} onClick={() => setMoveTargetFolderId(f.id)} className={`p-3 rounded-lg border cursor-pointer flex items-center transition-colors ${moveTargetFolderId === f.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                            <Folder className={`h-5 w-5 mr-3 ${moveTargetFolderId === f.id ? 'text-indigo-500' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${moveTargetFolderId === f.id ? 'text-indigo-900' : 'text-gray-700'}`}>{f.name}</span>
                            {moveTargetFolderId === f.id && <CheckCircle2 className="h-4 w-4 ml-auto text-indigo-600" />}
                       </div>
                   ))}
               </div>
               <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                   <Button variant="secondary" onClick={() => setIsMoveModalOpen(false)}>Cancel</Button>
                   <Button onClick={handleBulkMove} isLoading={isProcessingAction}>Move Items</Button>
               </div>
          </div>
      </Modal>

      {/* Add/Edit Credential Modal */}
      <Modal isOpen={isAddModalOpen || !!editingId} onClose={() => { setIsAddModalOpen(false); setEditingId(null); setNewCred({ clientName: '', serviceName: '', crmLink: '', username: '', password: '', folderId: null }); setShowCrmDropdown(false); }} title={editingId ? 'Edit Credential' : 'Add Credential'}>
           <form onSubmit={async (e) => {
               e.preventDefault();
               setIsProcessingAction(true);
               try {
                   const payload = { 
                       client_name: newCred.clientName,
                       service_name: newCred.serviceName,
                       crm_link: newCred.crmLink,
                       username: newCred.username,
                       password: newCred.password,
                       folder_id: currentFolderId || newCred.folderId 
                   };
                   
                   if (editingId) {
                       const { error } = await supabase.from('credentials').update({ ...payload, last_updated: new Date() }).eq('id', editingId);
                       if (error) throw error;
                       setCredentials(prev => prev.map(c => c.id === editingId ? { ...c, ...payload, id: editingId, lastUpdated: new Date() } : c));
                   } else {
                       const { data, error } = await supabase.from('credentials').insert(payload).select().single();
                       if (error) throw error;
                       setCredentials(prev => [{ id: data.id, clientName: data.client_name, serviceName: data.service_name, crmLink: data.crm_link, username: data.username, password: data.password, lastUpdated: new Date(data.created_at), folderId: data.folder_id }, ...prev]);
                   }
                   setToast({ message: "Credential Saved", type: "success" });
                   setIsAddModalOpen(false);
                   setEditingId(null);
                   setNewCred({ clientName: '', serviceName: '', crmLink: '', username: '', password: '', folderId: null });
               } catch(err) { setToast({ message: "Operation failed", type: "error" }); } finally { setIsProcessingAction(false); }
           }}>
               <div className="space-y-4">
                   <Input label="Client Name" value={newCred.clientName} onChange={e => setNewCred({...newCred, clientName: e.target.value})} required />
                   <div className="relative" ref={crmDropdownRef}>
                        <Input 
                            label="Service / CRM" 
                            value={newCred.serviceName} 
                            onChange={e => setNewCred({...newCred, serviceName: e.target.value})}
                            onFocus={() => setShowCrmDropdown(true)}
                            required 
                        />
                        <AnimatePresence>
                        {showCrmDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto overflow-x-hidden animate-fade-in">
                                {COMMON_SERVICES.filter(s => s.toLowerCase().includes(newCred.serviceName.toLowerCase())).map(service => (
                                    <div 
                                        key={service} 
                                        onClick={() => { setNewCred({...newCred, serviceName: service}); setShowCrmDropdown(false); }}
                                        className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-gray-700 flex items-center transition-colors"
                                    >
                                        <Briefcase className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                        {service}
                                    </div>
                                ))}
                                {COMMON_SERVICES.filter(s => s.toLowerCase().includes(newCred.serviceName.toLowerCase())).length === 0 && (
                                    <div className="px-4 py-2 text-xs text-gray-400 italic">Type to add custom service...</div>
                                )}
                            </div>
                        )}
                        </AnimatePresence>
                   </div>
                   <Input label="Link" value={newCred.crmLink} onChange={e => setNewCred({...newCred, crmLink: e.target.value})} />
                   <div className="grid grid-cols-2 gap-4">
                       <Input label="Username" value={newCred.username} onChange={e => setNewCred({...newCred, username: e.target.value})} />
                       <Input label="Password" type="text" value={newCred.password} onChange={e => setNewCred({...newCred, password: e.target.value})} />
                   </div>
                   <div className="pt-4 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => { setIsAddModalOpen(false); setEditingId(null); }}>Cancel</Button><Button type="submit" isLoading={isProcessingAction}>Save Record</Button></div>
               </div>
           </form>
      </Modal>

      {/* Delete Submission Modal */}
      <Modal isOpen={isDeleteRecordModalOpen} onClose={() => setIsDeleteRecordModalOpen(false)} title="Delete Submission">
          <div className="text-center p-4">
               <p className="text-gray-600 mb-6">Are you sure you want to delete this submission record?</p>
               <div className="flex justify-center gap-3"><Button variant="secondary" onClick={() => setIsDeleteRecordModalOpen(false)}>Cancel</Button><Button variant="danger" onClick={handleDeleteSubmission} isLoading={isProcessingAction}>Delete</Button></div>
          </div>
      </Modal>

      {/* --- Floating Bottom Navigation --- */}
      {createPortal(
        <AnimatePresence>
          {selectedItems.size > 0 && (
            <div className="navbar-fixed-container">
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="selection-navbar"
              >
                <div className="selection-count-badge">{selectedItems.size}</div>
                <span className="text-sm font-medium whitespace-nowrap">Selected</span>
                
                <div className="navbar-divider"></div>

                <div className="flex items-center gap-2">
                    <button onClick={handleSelectAll} className="navbar-btn-icon group" title="Select All">
                        <ListChecks size={18} />
                    </button>
                </div>
                
                <div className="navbar-divider"></div>

                <div className="flex items-center gap-2">
                   {canMutate && (
                       <>
                           <button onClick={() => setIsMoveModalOpen(true)} className="navbar-btn-move">
                             <Move size={14} /> Move
                           </button>
                           <button onClick={() => setDeleteConfirmation({ isOpen: true, id: null, type: 'bulk' })} className="navbar-btn-delete">
                             <Trash2 size={14} /> Delete
                           </button>
                       </>
                   )}
                   {!canMutate && (
                       <span className="text-xs text-gray-500 italic px-2">Read Only</span>
                   )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
};

export default DashboardPage;