import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  Globe, 
  Shield, 
  Search,
  FileText,
  Lock,
  Inbox,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Building,
  Pencil,
  Link as LinkIcon,
  ExternalLink,
  Loader2,
  Terminal,
  AlertCircle,
  Check,
  X,
  Folder,
  FolderPlus,
  Move,
  Home,
  ArrowUpLeft,
  CheckSquare,
  Square,
  ListChecks,
  Sparkles,
  RefreshCcw
} from 'lucide-react';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import CipherText from '../components/CipherText';
import { StoredCredential, FormSubmission, RoutePath, User, Folder as FolderType } from '../types';
import { supabase } from '../services/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Form Types Definition
const FORM_TYPES = [
  'SMS Onboarding form',
  'Jack Ryan A.I. 1st Call',
  'Call List Submission Form',
  'Jack Ryan A.I. Client Onboarding Form'
];

// Mapping Forms to Specific Tables
const TABLE_MAP: Record<string, string> = {
  'SMS Onboarding form': 'sms_onboarding_submissions',
  'Jack Ryan A.I. 1st Call': 'first_call_submissions',
  'Call List Submission Form': 'call_list_submissions',
  'Jack Ryan A.I. Client Onboarding Form': 'client_onboarding_submissions'
};

// Default Palette for CRMs without specific branding
const CRM_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', hover: 'hover:bg-blue-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hover: 'hover:bg-emerald-100' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', hover: 'hover:bg-purple-100' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hover: 'hover:bg-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', hover: 'hover:bg-rose-100' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', hover: 'hover:bg-indigo-100' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', hover: 'hover:bg-cyan-100' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', hover: 'hover:bg-fuchsia-100' },
];

// Custom Brand Overrides
const CRM_BRAND_DEFAULTS: Record<string, typeof CRM_COLORS[0]> = {
  'boomtown': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', hover: 'hover:bg-orange-100' },
  'boom town': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', hover: 'hover:bg-orange-100' },
  'cinc': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', hover: 'hover:bg-cyan-100' },
  'follow up boss': { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', hover: 'hover:bg-sky-100' },
  'fub': { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', hover: 'hover:bg-sky-100' },
  'hubspot': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', hover: 'hover:bg-orange-100' },
  'salesforce': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', hover: 'hover:bg-blue-100' },
  'kvcore': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hover: 'hover:bg-emerald-100' },
  'chime': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', hover: 'hover:bg-violet-100' },
  'lofty': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', hover: 'hover:bg-violet-100' },
  'redfin': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', hover: 'hover:bg-red-100' },
  'zillow': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', hover: 'hover:bg-blue-100' },
};

const COMMON_CRMS = [
  'HubSpot', 'Salesforce', 'Zoho CRM', 'Pipedrive', 'Monday.com', 
  'CINC', 'BoomTown', 'KVCore', 'Follow Up Boss', 'LionDesk', 
  'RealtyJuggler', 'Top Producer', 'Wise Agent', 'Chime', 'Brivity', 
  'Market Leader', 'Lofty', 'Sierra Interactive', 'Redfin', 'Zillow Premier Agent'
];

// Mock Data for Fallback (if DB connection fails)
const FALLBACK_SUBMISSIONS: FormSubmission[] = [
  { 
    id: 'sub_demo_1', 
    source: 'SMS Onboarding form', 
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), 
    status: 'processed', 
    ipAddress: '192.168.1.45', 
    payload: { 
      "business_name": "Apex Realty Group", 
      "industry": "Real Estate", 
      "full_name": "John Doe",
      "primary_bot_goal": "Book seller appointments",
      "note": "Demo Data - Database Table Missing"
    } 
  }
];

const SETUP_SQL = `-- Run this in your Supabase SQL Editor to create the required tables

-- 1. Folders Table
create table if not exists public.folders (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.folders enable row level security;
drop policy if exists "Allow all access for authenticated users" on public.folders;
create policy "Allow all access for authenticated users" on public.folders for all to authenticated using (true);

-- 2. Credentials Table
create table if not exists public.credentials (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  client_name text,
  service_name text,
  crm_link text,
  username text,
  password text,
  last_updated timestamp with time zone default timezone('utc'::text, now()),
  folder_id uuid references public.folders(id) on delete set null
);
alter table public.credentials enable row level security;
drop policy if exists "Allow all access for authenticated users" on public.credentials;
create policy "Allow all access for authenticated users" on public.credentials for all to authenticated using (true);

-- 3. Form Submission Tables (All 4 Types)
-- (Simplified for brevity, ensure all 4 are created with similar policies)
create table if not exists public.sms_onboarding_submissions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text default 'pending',
  ip_address text,
  payload jsonb default '{}'::jsonb,
  source text default 'SMS Onboarding form'
);
alter table public.sms_onboarding_submissions enable row level security;
drop policy if exists "Allow all access for authenticated users" on public.sms_onboarding_submissions;
create policy "Allow all access for authenticated users" on public.sms_onboarding_submissions for all to authenticated using (true);
-- Repeat for other 3 form tables (first_call_submissions, call_list_submissions, client_onboarding_submissions)

-- 4. Profiles Table (Updated)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text,
  full_name text,
  role text default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint profiles_role_check check (role in ('grand_admin', 'admin', 'user'))
);
-- Ensure full_name column exists if table was created previously
alter table public.profiles add column if not exists full_name text;

alter table public.profiles enable row level security;
drop policy if exists "Allow all access for authenticated users" on public.profiles;
create policy "Allow all access for authenticated users" on public.profiles for all to authenticated using (true);

-- 5. Dead Drops Table
create table if not exists public.dead_drops (
  id uuid default gen_random_uuid() primary key,
  encrypted_content text not null,
  iv text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.dead_drops enable row level security;
drop policy if exists "Allow authenticated access" on public.dead_drops;
create policy "Allow authenticated access" on public.dead_drops for all to authenticated using (true);

-- 6. Messages Table (Real-time Chat)
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.messages enable row level security;
drop policy if exists "Allow all access for authenticated users" on public.messages;
create policy "Allow all access for authenticated users" on public.messages for all to authenticated using (true);

-- 7. Triggers
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, username, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$ language plpgsql security definer;
-- Trigger hookup assumed
`;

interface DashboardPageProps {
  user: User | null;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user }) => {
  const navigate = useNavigate();
  // Navigation State
  const [activeMainTab, setActiveMainTab] = useState<'credentials' | 'submissions'>('credentials');
  const [activeFormTab, setActiveFormTab] = useState<string>(FORM_TYPES[0]);

  // Data State
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [formCounts, setFormCounts] = useState<Record<string, number>>({}); 
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [demoMode, setDemoMode] = useState(false);
  
  // Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Delete Modal State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; id: string | null, type: 'credential' | 'folder' | 'bulk' }>({ isOpen: false, id: null, type: 'credential' });

  // Loading State
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);
  const [isSavingCredential, setIsSavingCredential] = useState(false);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  
  // Modal State
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  
  // Search & Pagination & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrmFilter, setSelectedCrmFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  // Status Dropdown State
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  // CRM Dropdown State
  const [isCrmDropdownOpen, setIsCrmDropdownOpen] = useState(false);
  const crmFilterRef = useRef<HTMLDivElement>(null);

  // Editing Submission State
  const [editingSubmission, setEditingSubmission] = useState<FormSubmission | null>(null);
  const [isEditSubmissionModalOpen, setIsEditSubmissionModalOpen] = useState(false);
  
  // Form State for Credentials
  const [newCred, setNewCred] = useState<Omit<StoredCredential, 'id' | 'lastUpdated'>>({ 
    clientName: '',
    serviceName: '', 
    crmLink: '',
    username: '', 
    password: '',
    folderId: null
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCrmSuggestions, setShowCrmSuggestions] = useState(false);
  const crmInputWrapperRef = useRef<HTMLDivElement>(null);
  
  // Folder Creation State
  const [newFolderName, setNewFolderName] = useState('');
  
  // Move Credential State
  const [moveCredentialId, setMoveCredentialId] = useState<string | null>(null); // Kept for single move
  const [selectedMoveFolderId, setSelectedMoveFolderId] = useState<string | null>(null);

  // Email Suggestions State
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const emailInputWrapperRef = useRef<HTMLDivElement>(null);

  // Refs for Realtime
  const activeFormTabRef = useRef(activeFormTab);

  // Constants
  const ITEMS_PER_PAGE_CREDENTIALS = 8; // 8 items per page as requested
  const ITEMS_PER_PAGE_SUBMISSIONS = 10;

  useEffect(() => {
    activeFormTabRef.current = activeFormTab;
  }, [activeFormTab]);

  // Click outside listener for status dropdown, CRM suggestions, Email suggestions, and CRM Filter
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setOpenStatusId(null);
      
      if (crmInputWrapperRef.current && !crmInputWrapperRef.current.contains(event.target as Node)) {
        setShowCrmSuggestions(false);
      }

      if (emailInputWrapperRef.current && !emailInputWrapperRef.current.contains(event.target as Node)) {
        setShowEmailSuggestions(false);
      }
      
      if (crmFilterRef.current && !crmFilterRef.current.contains(event.target as Node)) {
        setIsCrmDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // --- HELPER FUNCTIONS ---
  const formatLabel = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const getCrmStyle = (crmName: string) => {
    if (!crmName) return CRM_COLORS[0];
    
    // Check for specific brands first
    const lowerName = crmName.toLowerCase();
    const brandMatch = Object.keys(CRM_BRAND_DEFAULTS).find(brand => lowerName.includes(brand));
    
    if (brandMatch) {
        return CRM_BRAND_DEFAULTS[brandMatch];
    }

    // Default hash function for others
    let hash = 0;
    for (let i = 0; i < crmName.length; i++) {
      hash = crmName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % CRM_COLORS.length;
    return CRM_COLORS[index];
  };

  // Get unique CRMs from credentials, case-insensitive logic for uniqueness
  const uniqueCrms = useMemo(() => {
    const map = new Map<string, string>();
    credentials.forEach(c => {
        if(c.serviceName) {
            const lowerKey = c.serviceName.toLowerCase();
            if(!map.has(lowerKey)) {
                map.set(lowerKey, c.serviceName);
            } else {
                const currentStored = map.get(lowerKey);
                if (c.serviceName === c.serviceName.toUpperCase() && currentStored !== c.serviceName) {
                    map.set(lowerKey, c.serviceName);
                }
            }
        }
    });
    return Array.from(map.values()).sort();
  }, [credentials]);

  // Get unique Emails from credentials
  const uniqueEmails = useMemo(() => {
    const emails = new Set(credentials.map(c => c.username).filter(val => val && val.trim() !== ''));
    return Array.from(emails).sort();
  }, [credentials]);

  // Breadcrumb Path Generator
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

  const clearSelection = () => setSelectedItems(new Set());

  const handleSelectAll = (allIds: string[]) => {
      setSelectedItems(new Set(allIds));
  };

  // --- SUPABASE DATA FETCHING ---
  const fetchSingleCount = async (formType: string, tableName: string) => {
    try {
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      setFormCounts(prev => ({ ...prev, [formType]: count || 0 }));
    } catch (err) {
      console.warn(`Failed to fetch count for ${formType}`, err);
    }
  };

  const updateAllCounts = async () => {
    const formPromises = Object.entries(TABLE_MAP).map(async ([type, tableName]) => {
      const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        return { type, count: 0, missing: true };
      }
      return { type, count: count || 0, missing: false };
    });

    const profilePromise = supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1).then(({ error }) => {
       return { missing: error && (error.code === '42P01' || error.message?.includes('does not exist')) };
    });

    const [formResults, profileResult] = await Promise.all([Promise.all(formPromises), profilePromise]);
    
    const newCounts: Record<string, number> = {};
    let missingTableDetected = profileResult.missing || false;

    formResults.forEach(r => {
      newCounts[r.type] = r.count;
      if (r.missing) missingTableDetected = true;
    });

    setFormCounts(newCounts);
    if (missingTableDetected) setDemoMode(true);
  };

  const fetchCredentialsAndFolders = async () => {
    try {
      setIsLoadingCredentials(true);
      
      // Fetch Credentials
      const { data: credsData, error: credsError } = await supabase
        .from('credentials')
        .select('*')
        .order('last_updated', { ascending: false });

      if (credsError) throw credsError;

      if (credsData) {
        const mappedCredentials: StoredCredential[] = credsData.map((item: any) => ({
          id: item.id,
          clientName: item.client_name,
          serviceName: item.service_name,
          crmLink: item.crm_link || '',
          username: item.username || '',
          password: item.password || '',
          lastUpdated: new Date(item.last_updated),
          folderId: item.folder_id || null
        }));
        setCredentials(mappedCredentials);
      }

      // Fetch Folders
      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .order('name', { ascending: true });
        
      if (foldersError && foldersError.code !== '42P01') throw foldersError; // Ignore missing table error for demo

      if (foldersData) {
        const mappedFolders: FolderType[] = foldersData.map((item: any) => ({
          id: item.id,
          name: item.name,
          parentId: item.parent_id,
          createdAt: item.created_at
        }));
        setFolders(mappedFolders);
      }

    } catch (error: any) {
      if (!error.message?.includes('Could not find the table') && error.code !== '42P01') {
        console.warn('Error fetching data:', error.message || error);
      }
    } finally {
      setIsLoadingCredentials(false);
    }
  };

  const fetchSubmissionsData = async (targetTab: string) => {
    try {
      setIsLoadingSubmissions(true);
      const tableName = TABLE_MAP[targetTab];
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedSubmissions: FormSubmission[] = data.map((item: any) => ({
          id: item.id,
          source: item.source || targetTab,
          status: item.status,
          payload: item.payload || {},
          ipAddress: item.ip_address || 'Unknown',
          timestamp: item.created_at
        }));
        setSubmissions(mappedSubmissions);
        setDemoMode(false);
      }
    } catch (error: any) {
      if (error.message?.includes('Could not find the table') || error.code === '42P01') {
        console.warn(`Table ${TABLE_MAP[targetTab]} missing. Enabling Demo Mode.`);
        setSubmissions(FALLBACK_SUBMISSIONS.filter(s => s.source === targetTab));
        setDemoMode(true);
      } else {
        console.error('Error fetching submissions:', error.message || error);
        setSubmissions([]);
      }
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'user') {
      fetchCredentialsAndFolders();
      updateAllCounts();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'user' && activeMainTab === 'submissions') {
      fetchSubmissionsData(activeFormTab);
    }
  }, [activeFormTab, activeMainTab, user]);

  useEffect(() => {
    if (user?.role === 'user') return;

    const channels: RealtimeChannel[] = [];
    
    const credChannel = supabase
      .channel('public:credentials')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credentials' }, () => fetchCredentialsAndFolders())
      .subscribe();
    channels.push(credChannel);
    
    // Optional: Add folder realtime listener if needed, but fetchCredentialsAndFolders handles it via manual refetch usually

    Object.entries(TABLE_MAP).forEach(([formType, tableName]) => {
      const formChannel = supabase
        .channel(`public:${tableName}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
          fetchSingleCount(formType, tableName);
          if (activeFormTabRef.current === formType) {
             fetchSubmissionsData(formType);
          }
        })
        .subscribe();
      channels.push(formChannel);
    });

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [user]);

  // --- ACCESS RESTRICTION VIEW ---
  if (user && user.role === 'user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in p-6">
        <div className="bg-amber-50 p-4 rounded-full mb-6 ring-8 ring-amber-50/50 shadow-inner">
           <Shield className="h-12 w-12 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Access Restricted</h2>
        <p className="text-gray-500 max-w-md mb-8 leading-relaxed">
          Your operative clearance is currently <strong>Level 1 (Pending)</strong>.
          <br/>
          ODL Vault modules are classified <span className="text-amber-600 font-medium">Level 3</span> and above.
        </p>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 max-w-sm w-full text-left flex items-start space-x-4 shadow-sm">
           <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              <Lock className="h-5 w-5 text-gray-400" />
           </div>
           <div>
              <p className="text-sm font-bold text-gray-900">Authorization Required</p>
              <p className="text-xs text-gray-500 mt-1.5 leading-5">Access to encrypted vaults and form intelligence requires administrative approval. Please contact a Grand Administrator to upgrade your security profile.</p>
           </div>
        </div>
        
        <div className="mt-8 flex gap-4 w-full max-w-sm">
             <Button onClick={() => window.location.reload()} variant="secondary" className="w-full justify-center">
                <RefreshCcw className="h-4 w-4 mr-2" /> Verify Access
             </Button>
        </div>
      </div>
    );
  }

  // --- HANDLERS (Same as before) ---
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const { error } = await supabase.from('folders').insert({
            name: newFolderName,
            parent_id: currentFolderId
        });
        if (error) throw error;
        setToast({ message: "Folder created", type: 'success' });
        await fetchCredentialsAndFolders();
        setIsCreateFolderModalOpen(false);
        setNewFolderName('');
    } catch (error: any) {
        if (error.code === '42P01' || error.message?.includes('Could not find the table') || error.message?.includes('schema cache')) {
             setIsSqlModalOpen(true);
        } else {
            setToast({ message: `Error: ${error.message}`, type: 'error' });
        }
    }
  };

  const handleDeleteFolder = async (id: string) => {
      const hasSubfolders = folders.some(f => f.parentId === id);
      const hasCreds = credentials.some(c => c.folderId === id);

      if (hasSubfolders || hasCreds) {
          if (!window.confirm("This folder contains items. Deleting it will delete all contents. Continue?")) return;
      }

      setDeleteConfirmation({ isOpen: false, id: null, type: 'credential' });
      setFolders(prev => prev.filter(f => f.id !== id));
      
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) {
          fetchCredentialsAndFolders(); 
          setToast({ message: "Failed to delete folder", type: 'error' });
      } else {
          setToast({ message: "Folder deleted", type: 'success' });
      }
  };

  // ... (Other handlers identical to previous, ensuring no AI imports/calls remain)

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCredential(true);
    try {
      if (editingId) {
        await supabase.from('credentials').update({
            client_name: newCred.clientName,
            service_name: newCred.serviceName,
            crm_link: newCred.crmLink,
            username: newCred.username,
            password: newCred.password,
            folder_id: newCred.folderId,
            last_updated: new Date().toISOString()
          }).eq('id', editingId);
          setToast({ message: "Credential updated successfully", type: 'success' });
      } else {
        await supabase.from('credentials').insert({
            client_name: newCred.clientName,
            service_name: newCred.serviceName,
            crm_link: newCred.crmLink,
            username: newCred.username,
            password: newCred.password,
            folder_id: currentFolderId, 
            last_updated: new Date().toISOString()
          });
          setToast({ message: "New credential secured in vault", type: 'success' });
      }
      await fetchCredentialsAndFolders(); 
      setIsAddModalOpen(false);
      setNewCred({ clientName: '', serviceName: '', crmLink: '', username: '', password: '', folderId: null });
      setEditingId(null);
      setShowCrmSuggestions(false);
      setShowEmailSuggestions(false);
    } catch (error: any) {
       if (error.code === '42P01') {
        alert("Setup Required: The 'credentials' table is missing.");
        setIsSqlModalOpen(true);
      } else {
        setToast({ message: `Error: ${error.message}`, type: 'error' });
      }
    } finally {
      setIsSavingCredential(false);
    }
  };

  const handleMoveItems = async () => {
      const itemsToMove = selectedItems.size > 0 
          ? Array.from(selectedItems) 
          : (moveCredentialId ? [moveCredentialId] : []);
      
      if (itemsToMove.length === 0) return;

      try {
          const folderUpdates = [];
          const credentialUpdates = [];

          for (const id of itemsToMove) {
              const isFolder = folders.some(f => f.id === id);
              if (isFolder) {
                  if (id === selectedMoveFolderId) continue;
                   folderUpdates.push(id);
              } else {
                   credentialUpdates.push(id);
              }
          }

          if (folderUpdates.length > 0) {
              const { error } = await supabase.from('folders')
                  .update({ parent_id: selectedMoveFolderId })
                  .in('id', folderUpdates);
              if (error) throw error;
          }

          if (credentialUpdates.length > 0) {
              const { error } = await supabase.from('credentials')
                  .update({ folder_id: selectedMoveFolderId })
                  .in('id', credentialUpdates);
              if (error) throw error;
          }
          
          setToast({ message: "Items moved successfully", type: 'success' });
          await fetchCredentialsAndFolders();
          setIsMoveModalOpen(false);
          setMoveCredentialId(null);
          setSelectedMoveFolderId(null);
          clearSelection();
      } catch (error: any) {
          setToast({ message: "Failed to move items", type: 'error' });
      }
  };

  const handleDuplicateCredential = async (cred: StoredCredential, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
          const { error } = await supabase.from('credentials').insert({
              client_name: `${cred.clientName} (Copy)`,
              service_name: cred.serviceName,
              crm_link: cred.crmLink,
              username: cred.username,
              password: cred.password,
              folder_id: cred.folderId,
              last_updated: new Date().toISOString()
          });
          if (error) throw error;
          setToast({ message: "Credential duplicated", type: 'success' });
          fetchCredentialsAndFolders();
      } catch (error) {
          setToast({ message: "Failed to duplicate", type: 'error' });
      }
  };

  const openAddModal = () => {
    setEditingId(null);
    setNewCred({ clientName: '', serviceName: '', crmLink: '', username: '', password: '', folderId: currentFolderId });
    setShowCrmSuggestions(false);
    setShowEmailSuggestions(false);
    setIsAddModalOpen(true);
  };

  const openEditModal = (cred: StoredCredential) => {
    setEditingId(cred.id);
    setNewCred({ clientName: cred.clientName, serviceName: cred.serviceName, crmLink: cred.crmLink, username: cred.username, password: cred.password, folderId: cred.folderId });
    setShowCrmSuggestions(false);
    setShowEmailSuggestions(false);
    setIsAddModalOpen(true);
  };

  const openDeleteModal = (id: string, type: 'credential' | 'folder' | 'bulk', e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmation({ isOpen: true, id, type });
  };

  const openMoveModal = (id: string | null, currentFolder: string | null, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setMoveCredentialId(id);
      setSelectedMoveFolderId(currentFolder);
      setIsMoveModalOpen(true);
  };

  const confirmDelete = async () => {
    const { id, type } = deleteConfirmation;
    if (type === 'bulk') {
        const idsToDelete = Array.from(selectedItems);
        const folderIds = idsToDelete.filter(id => folders.some(f => f.id === id));
        const credIds = idsToDelete.filter(id => credentials.some(c => c.id === id));
        setFolders(prev => prev.filter(f => !folderIds.includes(f.id)));
        setCredentials(prev => prev.filter(c => !credIds.includes(c.id)));
        if (folderIds.length > 0) await supabase.from('folders').delete().in('id', folderIds);
        if (credIds.length > 0) await supabase.from('credentials').delete().in('id', credIds);
        setToast({ message: `Deleted ${idsToDelete.length} items`, type: 'success' });
        clearSelection();
        setDeleteConfirmation({ isOpen: false, id: null, type: 'credential' });
        fetchCredentialsAndFolders();
        return;
    }
    if (!id) return;
    if (type === 'credential') {
        setCredentials(prev => prev.filter(c => c.id !== id));
        setDeleteConfirmation({ isOpen: false, id: null, type: 'credential' });
        const { error } = await supabase.from('credentials').delete().eq('id', id);
        if(error) {
            fetchCredentialsAndFolders();
            setToast({ message: "Failed to delete credential", type: 'error' });
        } else {
            setToast({ message: "Credential removed from vault", type: 'success' });
        }
    } else {
        await handleDeleteFolder(id);
    }
  };

  const togglePassword = (id: string) => setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  const handleCopy = (text: string) => { if (!text) return; navigator.clipboard.writeText(text); setToast({ message: "Copied to clipboard", type: 'success' }); };
  
  const handleStatusChange = async (id: string, newStatus: 'pending' | 'processed' | 'flagged', e: React.MouseEvent) => {
      e.stopPropagation();
      setOpenStatusId(null);
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
      const tableName = TABLE_MAP[activeFormTab];
      await supabase.from(tableName).update({ status: newStatus }).eq('id', id);
  };

  const toggleStatusDropdown = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setOpenStatusId(openStatusId === id ? null : id); };
  const handleEditSubmissionClick = (submission: FormSubmission, e: React.MouseEvent) => { e.stopPropagation(); setEditingSubmission(JSON.parse(JSON.stringify(submission))); setIsEditSubmissionModalOpen(true); };
  const handleSaveSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSubmission) {
      const tableName = TABLE_MAP[activeFormTab];
      await supabase.from(tableName).update({ payload: editingSubmission.payload }).eq('id', editingSubmission.id);
      setIsEditSubmissionModalOpen(false);
      setEditingSubmission(null);
      setToast({ message: "Submission data updated", type: 'success' });
    }
  };
  const handlePayloadChange = (key: string, value: string) => {
    if (editingSubmission) {
      setEditingSubmission({ ...editingSubmission, payload: { ...editingSubmission.payload, [key]: value } });
    }
  };

  // --- RENDERING ---
  const filteredCredentials = credentials.filter(cred => {
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (cred.clientName.toLowerCase().includes(q) || cred.serviceName.toLowerCase().includes(q)) &&
               (selectedCrmFilter ? cred.serviceName.toLowerCase() === selectedCrmFilter.toLowerCase() : true);
    }
    return cred.folderId === currentFolderId && (selectedCrmFilter ? cred.serviceName.toLowerCase() === selectedCrmFilter.toLowerCase() : true);
  });
  const currentFolders = searchQuery ? [] : folders.filter(f => f.parentId === currentFolderId);
  const filteredSubmissions = submissions.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const payloadValues = s.payload ? Object.values(s.payload) : [];
    return s.id.toLowerCase().includes(q) || s.status.toLowerCase().includes(q) || s.ipAddress.includes(q) || payloadValues.some(val => String(val).toLowerCase().includes(q));
  });

  const totalSubmissionsCount = (Object.values(formCounts) as number[]).reduce((a, b) => a + b, 0);
  const itemsPerPage = activeMainTab === 'credentials' ? ITEMS_PER_PAGE_CREDENTIALS : ITEMS_PER_PAGE_SUBMISSIONS;
  const totalItems = activeMainTab === 'credentials' ? filteredCredentials.length + (searchQuery ? 0 : currentFolders.length) : filteredSubmissions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startStartIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startStartIndex + itemsPerPage;
  
  let displayFolders: FolderType[] = [];
  let displayCredentials: StoredCredential[] = [];

  if (activeMainTab === 'credentials') {
      if (searchQuery) {
          displayCredentials = filteredCredentials.slice(startStartIndex, endIndex);
      } else {
          const folderCount = currentFolders.length;
          if (startStartIndex < folderCount) displayFolders = currentFolders.slice(startStartIndex, Math.min(endIndex, folderCount));
          const slotsUsedByFolders = Math.max(0, Math.min(endIndex, folderCount) - startStartIndex);
          const remainingSlots = itemsPerPage - slotsUsedByFolders;
          if (remainingSlots > 0) {
              let credStart = 0;
              if (startStartIndex >= folderCount) credStart = startStartIndex - folderCount;
              displayCredentials = filteredCredentials.slice(credStart, credStart + remainingSlots);
          }
      }
  }
  const currentSubmissions = filteredSubmissions.slice(startStartIndex, endIndex);

  const goToPage = (page: number) => { if (page >= 1 && page <= totalPages) { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const PaginationControls = ({ variant = 'default' }: { variant?: 'default' | 'minimal' } = {}) => {
    if (totalItems === 0 && searchQuery) return null;
    if (totalPages <= 1) return null;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
    const pageNumbers = []; for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
    const content = (
        <div className="flex items-center space-x-2">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className={`rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${variant === 'minimal' ? 'p-1.5' : 'p-2'}`}><ChevronLeft className={variant === 'minimal' ? "h-4 w-4" : "h-5 w-5"} /></button>
            <div className="hidden sm:flex items-center space-x-1">
                {pageNumbers.map(page => (<button key={page} onClick={() => goToPage(page)} className={`rounded-lg font-medium transition-all duration-200 ${currentPage === page ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'} ${variant === 'minimal' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm scale-105'}`}>{page}</button>))}
            </div>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className={`rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${variant === 'minimal' ? 'p-1.5' : 'p-2'}`}><ChevronRight className={variant === 'minimal' ? "h-4 w-4" : "h-5 w-5"} /></button>
        </div>
    );
    if (variant === 'minimal') return content;
    return <div className="flex items-center justify-center border-t border-gray-200 px-4 py-4 sm:px-6 bg-white rounded-b-2xl mt-20 transition-all">{content}</div>;
  };

  const StatusDropdown = ({ status, id }: { status: string, id: string }) => {
    const isOpen = openStatusId === id;
    let buttonClass = status === 'processed' ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100" : status === 'flagged' ? "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100" : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100";
    return (
        <div className="relative">
            <button onClick={(e) => toggleStatusDropdown(id, e)} className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border mb-1 transition-colors ${buttonClass} outline-none focus:outline-none`}>{status}<ChevronDown className="h-3 w-3 ml-1" /></button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20 animate-fade-in">
                    <button onClick={(e) => handleStatusChange(id, 'pending', e)} className="w-full text-left px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 flex items-center justify-between">Pending {status === 'pending' && <Check className="h-3 w-3" />}</button>
                    <button onClick={(e) => handleStatusChange(id, 'processed', e)} className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 flex items-center justify-between">Processed {status === 'processed' && <Check className="h-3 w-3" />}</button>
                    <button onClick={(e) => handleStatusChange(id, 'flagged', e)} className="w-full text-left px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center justify-between">Flagged {status === 'flagged' && <Check className="h-3 w-3" />}</button>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="space-y-6 pb-24"> 
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div className="flex-shrink-0">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <CipherText text="ODL Vault" />
          </h1>
          <p className="mt-1 text-gray-500">Secured Operation Data Layer for authorized personnel.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center relative z-50">
            {activeMainTab === 'credentials' && (
                <div className="relative min-w-[180px] hidden md:block animate-fade-in" ref={crmFilterRef}>
                    <button onClick={() => setIsCrmDropdownOpen(!isCrmDropdownOpen)} className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-xl text-sm font-medium transition-all shadow-sm ${selectedCrmFilter ? 'border-indigo-300 ring-2 ring-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700 hover:border-indigo-300'}`}><span className="truncate mr-2">{selectedCrmFilter || "All CRMs"}</span><ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isCrmDropdownOpen ? 'rotate-180' : ''}`} /></button>
                    {isCrmDropdownOpen && (
                        <div className="absolute top-full mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto overflow-x-hidden animate-fade-in">
                            <button onClick={() => { setSelectedCrmFilter(null); setIsCrmDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between ${!selectedCrmFilter ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}>All CRMs{!selectedCrmFilter && <Check className="h-3.5 w-3.5" />}</button>
                            {uniqueCrms.map((crm) => (<button key={crm} onClick={() => { setSelectedCrmFilter(crm); setIsCrmDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between ${selectedCrmFilter?.toLowerCase() === crm.toLowerCase() ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}><span className="truncate">{crm}</span>{selectedCrmFilter?.toLowerCase() === crm.toLowerCase() && <Check className="h-3.5 w-3.5" />}</button>))}
                        </div>
                    )}
                </div>
            )}

            <div className="relative group w-full md:w-64 lg:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                <input type="text" className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 sm:text-sm transition-all shadow-sm" placeholder={activeMainTab === 'credentials' ? (currentFolderId ? "Search current folder..." : "Search credentials...") : "Search submissions..."} value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
            </div>
           <div className="flex-shrink-0 flex space-x-2">
               {activeMainTab === 'credentials' && (
                 <>
                   {user?.role === 'grand_admin' && (<Button onClick={() => setIsSqlModalOpen(true)} variant="secondary" className="px-3" title="Database Setup"><Terminal className="h-5 w-5 text-gray-500" /></Button>)}
                   <Button onClick={() => setIsCreateFolderModalOpen(true)} variant="secondary" className="w-full sm:w-auto px-4"><FolderPlus className="h-5 w-5" /></Button>
                   <Button onClick={openAddModal} className="w-full sm:w-auto"><Plus className="h-5 w-5 mr-2" />Add Credential</Button>
                 </>
               )}
           </div>
        </div>
      </div>

      <div className="border-b border-gray-200 flex items-center justify-between pr-4">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button onClick={() => { setActiveMainTab('credentials'); setSearchQuery(''); setCurrentPage(1); setExpandedSubmissionId(null); setSelectedCrmFilter(null); clearSelection(); }} className={`${activeMainTab === 'credentials' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all outline-none focus:outline-none focus:ring-0 focus-visible:outline-none`}>
            <Lock className={`-ml-0.5 mr-2 h-5 w-5 ${activeMainTab === 'credentials' ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
            <span>Credentials Vault</span>
            <span className={`ml-3 py-0.5 px-2.5 rounded-full text-xs font-medium inline-block ${activeMainTab === 'credentials' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>{credentials.length}</span>
          </button>
          <button onClick={() => { setActiveMainTab('submissions'); setSearchQuery(''); setCurrentPage(1); setExpandedSubmissionId(null); setSelectedCrmFilter(null); clearSelection(); }} className={`${activeMainTab === 'submissions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all outline-none focus:outline-none focus:ring-0 focus-visible:outline-none`}>
            <Inbox className={`-ml-0.5 mr-2 h-5 w-5 ${activeMainTab === 'submissions' ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
            <span>Form Intelligence</span>
             <span className={`ml-3 py-0.5 px-2.5 rounded-full text-xs font-medium inline-block ${activeMainTab === 'submissions' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>{totalSubmissionsCount}</span>
          </button>
        </nav>
        <div><PaginationControls variant="minimal" /></div>
      </div>

      {activeMainTab === 'credentials' && (
        <section key="credentials-section" className="animate-fade-in relative">
          {isLoadingCredentials ? (
             <div className="flex flex-col items-center justify-center h-64 mt-8"><Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" /><p className="text-gray-500 font-medium">Decrypting Vault...</p></div>
          ) : (
            <div className="mt-6">
                {!searchQuery && (
                  <div className="flex items-center mb-6 text-sm text-gray-500">
                      <button onClick={() => { setCurrentFolderId(null); setCurrentPage(1); clearSelection(); }} className={`flex items-center hover:text-indigo-600 transition-colors ${!currentFolderId ? 'font-bold text-gray-800' : ''}`}><Home className="h-4 w-4 mr-1" />Vault Root</button>
                      {breadcrumbPath.map((folder, index) => (<div key={folder.id} className="flex items-center"><ChevronRight className="h-4 w-4 mx-1 text-gray-300" /><button onClick={() => { setCurrentFolderId(folder.id); setCurrentPage(1); clearSelection(); }} className={`hover:text-indigo-600 transition-colors ${index === breadcrumbPath.length - 1 ? 'font-bold text-gray-800' : ''}`}>{folder.name}</button></div>))}
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {displayFolders.map(folder => {
                      const isSelected = selectedItems.has(folder.id);
                      return (
                          <div key={folder.id} onClick={() => { setCurrentFolderId(folder.id); setCurrentPage(1); clearSelection(); }} className={`group bg-white rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-[180px] relative overflow-hidden ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:shadow-md hover:border-indigo-300'}`}>
                             <div className="absolute top-3 left-3 z-20"><button onClick={(e) => toggleSelection(folder.id, e)} className={`p-1 rounded transition-colors ${isSelected ? 'text-indigo-600 bg-indigo-50' : 'text-gray-300 hover:text-gray-500'}`}>{isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}</button></div>
                             <div className="absolute bottom-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => openDeleteModal(folder.id, 'folder', e)} className="p-1.5 text-gray-400 hover:text-rose-500 bg-white hover:bg-rose-50 rounded-full transition-colors border border-gray-100 hover:border-rose-200 shadow-sm" title="Delete Folder"><Trash2 className="h-4 w-4" /></button></div>
                             <div className="flex items-start justify-between p-5 pb-0"><div className="ml-auto"></div><Folder className={`h-10 w-10 transition-colors ${isSelected ? 'text-indigo-500' : 'text-indigo-200 group-hover:text-indigo-500'}`} /></div>
                             <div className="p-5"><h3 className={`font-bold truncate text-lg transition-colors ${isSelected ? 'text-indigo-700' : 'text-gray-900 group-hover:text-indigo-600'}`}>{folder.name}</h3><p className="text-xs text-gray-400 mt-1">{folders.filter(f => f.parentId === folder.id).length} folders, {credentials.filter(c => c.folderId === folder.id).length} items</p></div>
                          </div>
                      );
                  })}
                  {displayCredentials.map((cred) => {
                    const crmStyle = getCrmStyle(cred.serviceName);
                    const isSelected = selectedItems.has(cred.id);
                    return (
                      <div key={cred.id} className={`group relative bg-white rounded-xl border transition-all flex flex-col h-full animate-fade-in min-h-[220px] ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-sm' : 'border-gray-200 hover:shadow-md hover:border-indigo-200'}`}>
                        <div className="absolute top-3 left-3 z-20"><button onClick={(e) => toggleSelection(cred.id, e)} className={`p-1 rounded transition-colors ${isSelected ? 'text-indigo-600 bg-indigo-50' : 'text-gray-300 hover:text-gray-500'}`}>{isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}</button></div>
                        <div className="p-5 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4 pl-6">
                              <div className="flex items-center space-x-3 max-w-[70%]">
                                <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors border border-gray-100 flex-shrink-0"><Building className="h-5 w-5 text-indigo-500" /></div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-gray-900 truncate text-sm" title={cred.clientName}>{cred.clientName}</h3>
                                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 mt-1">
                                     <button onClick={() => openEditModal(cred)} className="p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors outline-none focus:outline-none" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                                     <button onClick={(e) => handleDuplicateCredential(cred, e)} className="p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors outline-none focus:outline-none" title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
                                     <button onClick={(e) => openMoveModal(cred.id, cred.folderId, e)} className="p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors outline-none focus:outline-none" title="Move to Folder"><Move className="h-3.5 w-3.5" /></button>
                                     <button onClick={(e) => openDeleteModal(cred.id, 'credential', e)} className="p-1 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors outline-none focus:outline-none" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                                  </div>
                                </div>
                              </div>
                              <button onClick={() => setSelectedCrmFilter(prev => prev && prev.toLowerCase() === cred.serviceName.toLowerCase() ? null : cred.serviceName)} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${crmStyle.bg} ${crmStyle.text} ${crmStyle.border} ${crmStyle.hover}`} title="Filter by this CRM">{cred.serviceName}</button>
                            </div>
                            <div className="space-y-3 flex-1 mt-2">
                              {cred.crmLink && (
                                <div><label className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">CRM Link</label><div className="flex items-center justify-between"><a href={cred.crmLink} target="_blank" rel="noopener noreferrer" className="flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline truncate mr-2"><LinkIcon className="h-3 w-3 mr-1.5 flex-shrink-0" /><span className="truncate">{cred.crmLink}</span></a><button onClick={() => handleCopy(cred.crmLink)} className="text-gray-400 hover:text-indigo-600 focus:outline-none outline-none p-1 rounded hover:bg-gray-100 transition-colors" title="Copy Link"><Copy className="h-3 w-3" /></button></div></div>
                              )}
                              <div><label className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">Login Email</label><div className="flex items-center justify-between text-xs font-medium text-gray-700 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100"><span className="truncate mr-2">{cred.username}</span><button onClick={() => handleCopy(cred.username)} className="text-gray-400 hover:text-indigo-600 focus:outline-none outline-none flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors" title="Copy Email"><Copy className="h-3 w-3" /></button></div></div>
                              <div><label className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold block mb-1">Password</label><div className="flex items-center justify-between text-xs font-medium text-gray-700 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100 font-mono"><span className="truncate mr-2">{visiblePasswords[cred.id] ? <CipherText text={cred.password} speed={10} revealDelay={0} /> : '••••••••••••'}</span><div className="flex items-center space-x-1 flex-shrink-0"><button onClick={() => handleCopy(cred.password)} className="text-gray-400 hover:text-indigo-600 focus:outline-none outline-none p-1 rounded hover:bg-gray-200 transition-colors" title="Copy Password"><Copy className="h-3 w-3" /></button><button onClick={() => togglePassword(cred.id)} className="text-gray-400 hover:text-indigo-600 focus:outline-none outline-none p-1 rounded hover:bg-gray-200 transition-colors" title={visiblePasswords[cred.id] ? "Hide Password" : "Show Password"}>{visiblePasswords[cred.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button></div></div></div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-400"><span>Updated: {new Date(cred.lastUpdated).toLocaleDateString()}</span><Shield className="h-3 w-3 text-emerald-500" /></div>
                        </div>
                      </div>
                    );
                  })}
                  {(currentPage === totalPages || totalItems === 0) && !searchQuery && !selectedCrmFilter && (
                    <button onClick={openAddModal} className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/10 transition-all text-gray-400 hover:text-indigo-500 h-full min-h-[220px] outline-none focus:outline-none group"><div className="p-3 rounded-full bg-gray-50 mb-3 group-hover:bg-white group-hover:scale-110 transition-transform"><Plus className="h-6 w-6" /></div><span className="font-medium">Add New Key</span></button>
                  )}
                </div>
            </div>
          )}
          {createPortal(<AnimatePresence>{selectedItems.size > 0 && (<motion.div initial={{ opacity: 0, y: 30, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 30, x: "-50%" }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }} className="fixed bottom-12 left-1/2 md:left-[calc(50%+9rem)] bg-zinc-900/90 backdrop-blur-md text-white shadow-2xl shadow-zinc-900/30 rounded-full px-6 py-3 flex items-center gap-6 z-[100] border border-zinc-800/50"><div className="flex items-center gap-3 border-r border-zinc-700/50 pr-6"><div className="bg-white text-zinc-950 text-xs font-bold px-2 py-0.5 rounded-md min-w-[24px] text-center">{selectedItems.size}</div><span className="text-sm font-medium">Selected</span></div><div className="flex items-center gap-2"><button onClick={() => handleSelectAll([...filteredCredentials.map(c => c.id), ...currentFolders.map(f => f.id)])} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white" title="Select All Matching Items"><ListChecks className="h-5 w-5" /></button><button onClick={() => openMoveModal(null, currentFolderId)} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm font-medium transition-all"><Move className="h-4 w-4" /><span>Move</span></button><button onClick={(e) => openDeleteModal('bulk', 'bulk', e)} className="flex items-center gap-2 px-4 py-2 bg-rose-900/30 text-rose-400 hover:bg-rose-900/50 hover:text-rose-300 rounded-full text-sm font-medium transition-all border border-rose-900/50"><Trash2 className="h-4 w-4" /><span>Delete</span></button></div><div className="border-l border-zinc-700/50 pl-6"><button onClick={clearSelection} className="text-zinc-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button></div></motion.div>)}</AnimatePresence>, document.body)}
        </section>
      )}

      {/* SQL SETUP MODAL */}
      <Modal isOpen={isSqlModalOpen} onClose={() => setIsSqlModalOpen(false)} title="Database Setup SQL" maxWidth="4xl">
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
            <p><strong>Missing Tables Detected:</strong> The application requires tables for Folders, Credentials, and Real-time Chat.</p>
            <p className="mt-1">Copy the SQL code below and run it in your Supabase SQL Editor.</p>
          </div>
          <div className="relative">
            <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed h-96 border border-slate-700 shadow-inner">
              {SETUP_SQL}
            </pre>
            <div className="absolute top-2 right-2">
              <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white flex items-center transition-colors" onClick={() => navigator.clipboard.writeText(SETUP_SQL)} title="Copy SQL"><Copy className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-gray-100"><Button variant="secondary" onClick={() => setIsSqlModalOpen(false)}>Close</Button></div>
        </div>
      </Modal>

      {/* ... Other Modals ... */}
      <Modal isOpen={isCreateFolderModalOpen} onClose={() => setIsCreateFolderModalOpen(false)} title="Create New Folder" maxWidth="sm">
         <form onSubmit={handleCreateFolder} className="space-y-4">
             <Input label="Folder Name" placeholder="e.g. Marketing Clients" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} required autoFocus />
             <div className="flex justify-end space-x-3 pt-2"><Button type="button" variant="secondary" onClick={() => setIsCreateFolderModalOpen(false)}>Cancel</Button><Button type="submit">Create Folder</Button></div>
         </form>
      </Modal>

      <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} title="Move Items" maxWidth="sm">
          <div className="space-y-4">
              <p className="text-sm text-gray-600">Select destination folder:</p>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  <button onClick={() => setSelectedMoveFolderId(null)} className={`w-full text-left px-4 py-3 text-sm flex items-center border-b border-gray-100 hover:bg-gray-50 ${selectedMoveFolderId === null ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}><Home className="h-4 w-4 mr-2" />Vault Root{selectedMoveFolderId === null && <Check className="ml-auto h-4 w-4" />}</button>
                  {folders.map(folder => { if (selectedItems.has(folder.id)) return null; return (<button key={folder.id} onClick={() => setSelectedMoveFolderId(folder.id)} className={`w-full text-left px-4 py-3 text-sm flex items-center border-b border-gray-100 hover:bg-gray-50 ${selectedMoveFolderId === folder.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}><Folder className="h-4 w-4 mr-2 text-gray-400" />{folder.name}{selectedMoveFolderId === folder.id && <Check className="ml-auto h-4 w-4" />}</button>); })}
              </div>
              <div className="flex justify-end space-x-3 pt-2"><Button variant="secondary" onClick={() => setIsMoveModalOpen(false)}>Cancel</Button><Button onClick={handleMoveItems}>Move {selectedItems.size > 0 ? `${selectedItems.size} Items` : 'Item'}</Button></div>
          </div>
      </Modal>

      <Modal isOpen={deleteConfirmation.isOpen} onClose={() => setDeleteConfirmation({ isOpen: false, id: null, type: 'credential' })} title={deleteConfirmation.type === 'bulk' ? "Bulk Delete" : (deleteConfirmation.type === 'folder' ? "Delete Folder" : "Confirm Deletion")} maxWidth="sm">
        <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center"><Trash2 className="h-6 w-6 text-rose-600" /></div>
            <div><h4 className="text-lg font-medium text-gray-900">{deleteConfirmation.type === 'bulk' ? `Delete ${selectedItems.size} Items?` : (deleteConfirmation.type === 'folder' ? "Delete Folder?" : "Delete Credential?")}</h4><p className="text-sm text-gray-500 mt-1">{deleteConfirmation.type === 'bulk' ? "This will permanently remove the selected folders (and their contents) and credentials." : (deleteConfirmation.type === 'folder' ? "This will permanently remove the folder and ALL items inside it." : "This action cannot be undone. The credential will be permanently removed.")}</p></div>
            <div className="flex w-full space-x-3 mt-4"><Button variant="secondary" onClick={() => setDeleteConfirmation({ isOpen: false, id: null, type: 'credential' })} className="flex-1">Cancel</Button><Button variant="danger" onClick={confirmDelete} className="flex-1">Delete</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={editingId ? "Edit Credential" : "Store New Credential"}>
        <form onSubmit={handleSaveCredential} className="space-y-4">
          <Input label="Client Name" placeholder="e.g. Acme Corp" value={newCred.clientName} onChange={(e) => setNewCred({...newCred, clientName: e.target.value})} required autoFocus />
          <div className="relative" ref={crmInputWrapperRef}><Input label="CRM Name" placeholder="e.g. HubSpot CRM" value={newCred.serviceName} onChange={(e) => { setNewCred({...newCred, serviceName: e.target.value}); setShowCrmSuggestions(true); }} onFocus={() => setShowCrmSuggestions(true)} required autoComplete="off" />{showCrmSuggestions && (<div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto animate-fade-in">{(() => { const input = newCred.serviceName.toLowerCase(); const existing = Array.from(new Set(credentials.map(c => c.serviceName))).filter(Boolean); const all = Array.from(new Set([...existing, ...COMMON_CRMS])); const filtered = input ? all.filter(c => String(c).toLowerCase().includes(input)) : all; const finalSuggestions = filtered.sort(); if (finalSuggestions.length === 0) return <div className="px-4 py-3 text-sm text-gray-400 italic">Type to create new...</div>; return finalSuggestions.map((crm) => (<button key={crm} type="button" onClick={() => { setNewCred({ ...newCred, serviceName: crm }); setShowCrmSuggestions(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-gray-50 last:border-0 block truncate">{crm}</button>)); })()}</div>)}</div>
          <Input label="CRM Link" placeholder="https://..." value={newCred.crmLink} onChange={(e) => setNewCred({...newCred, crmLink: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <div className="relative" ref={emailInputWrapperRef}><Input label="Login Email" placeholder="user@example.com" value={newCred.username} onChange={(e) => { setNewCred({...newCred, username: e.target.value}); setShowEmailSuggestions(true); }} onFocus={() => setShowEmailSuggestions(true)} required autoComplete="off" />{showEmailSuggestions && (<div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto animate-fade-in">{(() => { const input = newCred.username.toLowerCase(); const filtered = input ? uniqueEmails.filter(e => e.toLowerCase().includes(input)) : uniqueEmails; if (filtered.length === 0) return null; return filtered.map((email) => (<button key={email} type="button" onClick={() => { setNewCred({ ...newCred, username: email }); setShowEmailSuggestions(false); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-gray-50 last:border-0 block truncate">{email}</button>)); })()}</div>)}</div>
            <Input label="Password" type="password" placeholder="••••••••" value={newCred.password} onChange={(e) => setNewCred({...newCred, password: e.target.value})} required />
          </div>
          <div className="pt-4 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</Button><Button type="submit" isLoading={isSavingCredential}>{editingId ? "Save Changes" : "Securely Save"}</Button></div>
        </form>
      </Modal>
      
      {/* Same submission modal as before... */}
      <Modal isOpen={isEditSubmissionModalOpen} onClose={() => setIsEditSubmissionModalOpen(false)} title="Edit Submission Data" maxWidth="2xl">
        {editingSubmission && (
          <form onSubmit={handleSaveSubmission} className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start"><AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" /><div className="ml-3"><h4 className="text-sm font-semibold text-amber-800">Data Integrity Warning</h4><p className="text-xs text-amber-700 mt-0.5">Editing raw submission payloads directly updates the database record. Ensure data format consistency for downstream integrations.</p></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Object.entries(editingSubmission.payload).map(([key, value]) => { const stringValue = String(value); const isLongText = stringValue.length > 60; return (<div key={key} className={isLongText ? "md:col-span-2" : ""}><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{formatLabel(key)}</label>{isLongText ? (<textarea rows={3} className="appearance-none block w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors" value={stringValue} onChange={(e) => handlePayloadChange(key, e.target.value)} />) : (<input type="text" className="appearance-none block w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-colors" value={stringValue} onChange={(e) => handlePayloadChange(key, e.target.value)} />)}</div>); })}</div>
            <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100"><Button type="button" variant="secondary" onClick={() => setIsEditSubmissionModalOpen(false)}>Cancel</Button><Button type="submit">Save Changes</Button></div>
          </form>
        )}
      </Modal>

    </div>
  );
};

export default DashboardPage;