import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Users as UsersIcon, Search, Shield, ShieldAlert, 
  Loader2, Crown, Mail, Calendar, User as UserIcon, Lock, 
  CheckCircle2, UserCog, Pencil, Key, X, Save,
  Terminal, Database, Copy,
  ShieldCheck, Clock, Trash2, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { User, ToastContextType } from '../types';
import Modal from '../components/Modal';
import Input from '../components/Input';
import Button from '../components/Button';
import { useOnlineUsers } from '../components/PresenceProvider';

const EDGE_FUNCTION_TEMPLATE = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const url = new URL(req.url)
  const webhook_key = url.searchParams.get('key')
  const legacy_fid = url.searchParams.get('fid')
  let form_id = legacy_fid;

  try {
    if (req.method !== 'POST') {
       return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { "Content-Type": "application/json" } })
    }

    const json = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (webhook_key) {
        const { data: form, error: lookupError } = await supabase
            .from('forms')
            .select('id, status')
            .eq('webhook_key', webhook_key)
            .single()

        if (lookupError || !form) {
            return new Response(JSON.stringify({ error: 'Invalid or inactive webhook key' }), { status: 403, headers: { "Content-Type": "application/json" } })
        }
        
        if (form.status !== 'active') {
             return new Response(JSON.stringify({ error: 'Form is inactive (Draft Mode)' }), { status: 423, headers: { "Content-Type": "application/json" } })
        }

        form_id = form.id;
    } 
    
    if (!form_id) {
         return new Response(JSON.stringify({ error: 'Missing webhook identification (key)' }), { status: 400, headers: { "Content-Type": "application/json" } })
    }

    const { error } = await supabase
      .from('form_submissions')
      .insert({
        form_id: form_id,
        payload: json,
        source: req.headers.get('referer') || 'Direct API',
        ip_address: req.headers.get('x-forwarded-for') || 'Hidden',
        status: 'pending'
      })

    if (error) throw error

    return new Response(JSON.stringify({ success: true, id: form_id }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    })
  }
})`;

const SQL_TEMPLATE = `-- ⚠️ CRITICAL UPDATE: Run this to add metadata columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
-- NEW: Seen Status Column
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS seen_by jsonb default '[]'::jsonb;

ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- COMPLETE ODL VAULT SCHEMA SETUP
-- 1. Profiles & Roles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  full_name text,
  role text default 'user',
  last_seen timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check 
  check (role in ('grand_admin', 'master_admin', 'admin', 'user'));

-- 2. Folders
create table if not exists public.folders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  parent_id uuid references public.folders(id),
  type text default 'credential',
  created_by uuid references public.profiles(id)
);

-- 3. Credentials
create table if not exists public.credentials (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  client_name text not null,
  service_name text,
  crm_link text,
  username text,
  password text,
  folder_id uuid references public.folders(id),
  last_updated timestamp with time zone default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id)
);

-- 4. Forms & Submissions
create table if not exists public.forms (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  folder_id uuid references public.folders(id) on delete set null,
  webhook_key uuid default gen_random_uuid(),
  webhook_url text,
  status text default 'draft',
  fields jsonb default '[]'::jsonb,
  created_by uuid references public.profiles(id)
);

create table if not exists public.form_submissions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  form_id text not null,
  payload jsonb default '{}'::jsonb,
  mapped_data jsonb default '{}'::jsonb,
  status text default 'pending',
  source text,
  ip_address text
);

-- 5. Chat Messages
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  content text not null,
  user_id uuid references public.profiles(id)
);

-- Ensure updated_at exists (Migration)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
-- Ensure seen_by exists (Migration)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS seen_by jsonb default '[]'::jsonb;

-- 6. Dead Drops (ENHANCED SCHEMA)
create table if not exists public.dead_drops (
  id uuid default gen_random_uuid() primary key,
  encrypted_content text not null,
  iv text not null,
  burn_after_read boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- FIX: Migration helper for existing tables
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'dead_drops' and column_name = 'encrypted_content') then
    alter table public.dead_drops add column encrypted_content text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'dead_drops' and column_name = 'iv') then
    alter table public.dead_drops add column iv text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'dead_drops' and column_name = 'burn_after_read') then
    alter table public.dead_drops add column burn_after_read boolean default true;
  end if;
end $$;

-- 7. ENABLE ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.credentials enable row level security;
alter table public.forms enable row level security;
alter table public.form_submissions enable row level security;
alter table public.messages enable row level security;
alter table public.dead_drops enable row level security;

-- 8. POLICIES
-- ... (Existing policies assumed) ...
create policy "Public insert dead_drops" on public.dead_drops for insert to authenticated with check (true);
create policy "Public read dead_drops" on public.dead_drops for select to anon, authenticated using (true);
create policy "Public delete dead_drops" on public.dead_drops for delete to anon, authenticated using (true);
-- IMPORTANT: Allow profile updates for Last Seen
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
-- Allow updating messages (for edits and seen status)
create policy "Authenticated users can update messages" on public.messages for update to authenticated using (true) with check (true);

-- 9. Role Update Function (Standard)
create or replace function public.update_user_role(
  target_user_id uuid, 
  new_role text
)
returns void
language plpgsql
security definer
as $$
declare
  executor_role text;
begin
  select role into executor_role from public.profiles where id = auth.uid();

  if executor_role not in ('grand_admin', 'master_admin') then
    raise exception 'Access Denied: You do not have permission to manage roles.';
  end if;

  if executor_role = 'master_admin' then
    if new_role in ('grand_admin', 'master_admin') then
      raise exception 'Access Denied: Master Admins can only assign Admin or Operative roles.';
    end if;
  end if;

  update public.profiles set role = new_role where id = target_user_id;
end;
$$;

grant execute on function public.update_user_role(uuid, text) to authenticated;
grant execute on function public.update_user_role(uuid, text) to service_role;

-- 10. Bootstrap Admin
update public.profiles set role = 'grand_admin' where username = 'babu.octopidigital@gmail.com';

-- 11. POLICY UPDATES FOR GRAND ADMIN DELETION (Run if deletion fails)
-- create policy "Grand Admin Manage Credentials" on public.credentials for all using (auth.uid() in (select id from public.profiles where role = 'grand_admin'));
-- create policy "Grand Admin Manage Folders" on public.folders for all using (auth.uid() in (select id from public.profiles where role = 'grand_admin'));
-- create policy "Grand Admin Manage Forms" on public.forms for all using (auth.uid() in (select id from public.profiles where role = 'grand_admin'));
`;

interface UsersPageProps {
  user: User | null;
}

interface Profile {
  id: string;
  username: string;
  role: 'grand_admin' | 'master_admin' | 'admin' | 'user';
  full_name?: string;
  created_at?: string;
  last_seen?: string;
}

const UsersPage: React.FC<UsersPageProps> = ({ user: currentUser }) => {
  const { showToast } = useOutletContext<ToastContextType>();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Presence from Context
  const onlineUsers = useOnlineUsers();

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({ fullName: '', password: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Deletion State
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // System Access Modals
  const [isEdgeCodeModalOpen, setIsEdgeCodeModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Updated to accept silent mode
  const fetchProfiles = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) throw error;

      const rolePriority: Record<string, number> = { 'grand_admin': 0, 'master_admin': 1, 'admin': 2, 'user': 3 };
      
      const sortedData = (data || []).sort((a: Profile, b: Profile) => {
          const scoreA = rolePriority[a.role] ?? 99;
          const scoreB = rolePriority[b.role] ?? 99;
          
          if (scoreA !== scoreB) return scoreA - scoreB;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });

      setProfiles(sortedData);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      if (showLoading) showToast("Failed to load operative list.", "error");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles(true); // Initial load with spinner
    
    // Periodically refresh list SILENTLY to update Last Seen times
    const interval = setInterval(() => fetchProfiles(false), 60000); 
    return () => clearInterval(interval);
  }, []);

  const handleRoleUpdate = async (userId: string, newRole: 'admin' | 'user' | 'master_admin') => {
    if (!currentUser) return;
    
    // Frontend Check: Double check permissions before sending request
    const myRole = currentUser.role;
    if (myRole !== 'grand_admin' && myRole !== 'master_admin') {
        showToast("Unauthorized action.", "error");
        return;
    }
    
    // Master Admin cannot promote to Master Admin
    if (myRole === 'master_admin' && newRole === 'master_admin') {
        showToast("Master Admins cannot grant Master Admin access.", "error");
        return;
    }

    setUpdatingId(userId);
    try {
        // Use RPC function to bypass RLS for role updates safely
        const { error } = await supabase.rpc('update_user_role', {
            target_user_id: userId,
            new_role: newRole
        });
        
        if (error) throw error;
        
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
        showToast(`Clearance updated to ${newRole.replace('_', ' ').toUpperCase()}.`, "success");
    } catch (error: any) {
        console.error("Role update error details:", error);
        
        // Robust Error Extraction
        let msg = "Failed to update clearance.";
        if (typeof error === 'string') {
            msg = error;
        } else if (error?.message) {
            msg = error.message;
        } else if (error?.error_description) {
            msg = error.error_description;
        } else {
            // Check specifically for the object object case by JSON stringifying if possible
            try { msg = JSON.stringify(error); } catch (e) { msg = "Unknown error occurred."; }
        }

        // User friendly override for common SQL/RPC errors
        if (msg.includes('function not found') || error.code === '42883') {
           msg = "System Error: SQL function missing. Run the setup script.";
        } else if (msg.includes('Access Denied')) {
           // Capture custom exceptions from the SQL function
           msg = msg.replace('P0001:', '').replace('{"message":"', '').replace('"}', '').trim();
        } else if (msg.includes('profiles_role_check') || (error?.message && error.message.includes('profiles_role_check'))) {
           msg = "Database Error: Role definitions are outdated. Please run the SQL setup script to update constraints.";
        }
        
        showToast(msg, "error");
    } finally {
        setUpdatingId(null);
    }
  };

  const openEditModal = (profile: Profile) => {
      setEditingUser(profile);
      setFormData({ fullName: profile.full_name || '', password: '' });
      setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;
      setIsSaving(true);

      try {
          const updates: any = { full_name: formData.fullName };
          const { error: profileError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', editingUser.id);

          if (profileError) throw profileError;

          let passMsg = '';
          if (formData.password) {
              if (currentUser?.id === editingUser.id) {
                  const { error: authError } = await supabase.auth.updateUser({ password: formData.password });
                  if (authError) throw authError;
                  passMsg = ' and password';
              } else {
                  showToast("Name updated. Only the user can reset their own password.", "success");
                  fetchProfiles(false);
                  setIsEditModalOpen(false);
                  return;
              }
          }

          showToast(`Operative profile${passMsg} updated.`, "success");
          fetchProfiles(false);
          setIsEditModalOpen(false);
      } catch (err: any) {
          showToast(err.message || "Update failed.", "error");
      } finally {
          setIsSaving(false);
      }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
        const uid = userToDelete.id;

        // 1. Unlink resources (Set created_by to NULL to preserve data but remove ownership constraint)
        // This is crucial because "ON DELETE CASCADE" is often not set for created_by
        await Promise.all([
            supabase.from('credentials').update({ created_by: null }).eq('created_by', uid),
            supabase.from('folders').update({ created_by: null }).eq('created_by', uid),
            supabase.from('forms').update({ created_by: null }).eq('created_by', uid),
        ]);

        // 2. Delete messages (Messages are strictly tied to user_id)
        // We delete them to ensure clean removal and avoid constraints if any.
        await supabase.from('messages').delete().eq('user_id', uid);

        // 3. Delete the profile
        const { error } = await supabase.from('profiles').delete().eq('id', uid);
        if (error) throw error;
        
        setProfiles(prev => prev.filter(p => p.id !== uid));
        showToast(`Operative ${userToDelete.username} deleted. Resources unlinked.`, "success");
        setUserToDelete(null);
    } catch (err: any) {
         console.error("Delete Error:", err);
         if (err.code === '23503') {
             showToast("Critical Error: Database constraints prevent deletion. Manual cleanup required.", "error");
         } else {
             showToast(err.message || "Failed to delete user.", "error");
         }
    } finally {
        setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard", "success");
  };

  const filteredProfiles = profiles.filter(p => 
    p.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return new Date().toLocaleDateString('en-GB');
    return new Date(dateString).toLocaleDateString('en-GB'); 
  };

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

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <UsersIcon className="h-8 w-8 text-indigo-600" />
              Operative Database
          </h1>
          <p className="mt-1 text-gray-500">Manage Access and Authorized Personnel.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
                <input 
                    type="text" 
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all" 
                    placeholder="Find operative..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                />
            </div>
            
            {/* System Buttons - Only visible to Grand Admin */}
            {currentUser?.role === 'grand_admin' && (
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                   <button onClick={() => setIsEdgeCodeModalOpen(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all" title="View Edge Function Code"><Terminal className="h-5 w-5" /></button>
                   <div className="w-px h-6 bg-gray-100"></div>
                   <button onClick={() => setIsSqlModalOpen(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all" title="View SQL Schema"><Database className="h-5 w-5" /></button>
              </div>
            )}
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
      >
         {/* ... Table logic ... */}
         {loading ? (
             <div className="p-12 flex flex-col items-center justify-center text-gray-400">
                 <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-500" />
                 <span className="text-sm font-medium">Retrieving Personnel Data...</span>
             </div>
         ) : (
             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm text-gray-600">
                     <thead className="bg-white border-b border-gray-100 text-[10px] uppercase tracking-wider font-bold text-gray-400">
                         <tr>
                             <th className="px-6 py-4">Identity</th>
                             <th className="px-6 py-4">Role & Access</th>
                             <th className="px-6 py-4">Registered</th>
                             <th className="px-6 py-4 text-right">Action</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                         <AnimatePresence mode="popLayout">
                         {filteredProfiles.length > 0 ? (
                             filteredProfiles.map((profile, index) => {
                                 const isMe = currentUser?.id === profile.id;
                                 const isOnline = onlineUsers.has(profile.id);
                                 const myRole = currentUser?.role;
                                 const targetRole = profile.role;
                                 const amIGrandAdmin = myRole === 'grand_admin';
                                 const amIMasterAdmin = myRole === 'master_admin';
                                 const isLocked = targetRole === 'grand_admin';
                                 let canEditRole = false;
                                 if (amIGrandAdmin && !isLocked) canEditRole = true;
                                 else if (amIMasterAdmin && !isLocked && targetRole !== 'master_admin') canEditRole = true;
                                 
                                 // STRICT REQUIREMENT: Only the user can edit their own profile details (Name/Pass)
                                 const canEditProfile = isMe;

                                 return (
                                     <motion.tr 
                                        key={profile.id} 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2, delay: index * 0.05 }}
                                        className="hover:bg-gray-50/50 transition-colors group"
                                     >
                                         <td className="px-6 py-4">
                                             <div className="flex items-center gap-4">
                                                 <div className="relative">
                                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-white flex-shrink-0 ${profile.role === 'grand_admin' ? 'bg-orange-500' : profile.role === 'master_admin' ? 'bg-blue-600' : profile.role === 'admin' ? 'bg-purple-600' : 'bg-slate-500'}`}>
                                                         {profile.role === 'grand_admin' ? <Crown className="w-5 h-5" /> : (profile.full_name?.[0] || profile.username?.[0] || 'U').toUpperCase()}
                                                     </div>
                                                     {isOnline && (
                                                         <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full">
                                                             <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></span>
                                                         </span>
                                                     )}
                                                 </div>
                                                 <div className="min-w-0">
                                                     <div className="flex items-center gap-2">
                                                         <span className="font-semibold text-gray-900 truncate">
                                                             {profile.full_name || profile.username}
                                                         </span>
                                                         {isMe && <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wide border border-indigo-100 flex-shrink-0">You</span>}
                                                         {canEditProfile && (<button onClick={() => openEditModal(profile)} className="ml-2 p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100" title="Edit Profile"><Pencil className="w-3.5 h-3.5" /></button>)}
                                                     </div>
                                                     
                                                     {/* Show email (username) if full name is present and different from name */}
                                                     {profile.full_name && (
                                                         <div className="text-xs text-gray-500 truncate leading-tight mt-0.5">
                                                             {profile.username}
                                                         </div>
                                                     )}

                                                     <div className="flex items-center mt-1 text-xs text-gray-400">
                                                        {isOnline ? (
                                                            <div className="flex items-center text-emerald-600 font-medium">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                                                                Online Now
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center text-gray-400" title={profile.last_seen ? new Date(profile.last_seen).toLocaleString() : ''}>
                                                                <Clock className="w-3 h-3 mr-1" />
                                                                Last seen {formatLastSeen(profile.last_seen)}
                                                            </div>
                                                        )}
                                                     </div>
                                                 </div>
                                             </div>
                                         </td>
                                         <td className="px-6 py-4">
                                             {/* ... Role Badges ... */}
                                             {profile.role === 'grand_admin' && (<div className="inline-flex items-center px-3 py-1 rounded-full border border-orange-200 bg-orange-50 text-orange-700 text-xs font-semibold shadow-sm"><Crown className="w-3.5 h-3.5 mr-1.5" />Grand Administrator</div>)}
                                             {profile.role === 'master_admin' && (<div className="inline-flex items-center px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold shadow-sm"><ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Master Administrator</div>)}
                                             {profile.role === 'admin' && (<div className="inline-flex items-center px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold shadow-sm"><ShieldAlert className="w-3.5 h-3.5 mr-1.5" />Administrator</div>)}
                                             {profile.role === 'user' && (<div className="inline-flex items-center px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-xs font-semibold shadow-sm"><UserIcon className="w-3.5 h-3.5 mr-1.5" />Operative</div>)}
                                         </td>
                                         <td className="px-6 py-4">
                                             <div className="flex items-center text-gray-500 text-xs font-medium"><Calendar className="w-4 h-4 mr-2 text-gray-400" />{formatDate(profile.created_at)}</div>
                                         </td>
                                         <td className="px-6 py-4">
                                            <div className="flex justify-end items-center gap-3">
                                             {!canEditRole ? (
                                                 <div className="h-8 flex items-center justify-center text-gray-300 px-4" title="Modification Restricted"><Lock className="w-4 h-4" /></div>
                                             ) : (
                                                 <div className="relative inline-flex bg-gray-100 p-1.5 rounded-lg border border-gray-200 select-none shadow-inner">
                                                     {updatingId === profile.id && (<div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] rounded-lg flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-indigo-600" /></div>)}
                                                     {amIGrandAdmin && (
                                                         <button onClick={() => handleRoleUpdate(profile.id, 'master_admin')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${profile.role === 'master_admin' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'}`} title="Master Admin"><ShieldCheck className="w-4 h-4" /></button>
                                                     )}
                                                     <button onClick={() => handleRoleUpdate(profile.id, 'admin')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${profile.role === 'admin' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'}`} title="Admin"><ShieldAlert className="w-4 h-4" /></button>
                                                     <button onClick={() => handleRoleUpdate(profile.id, 'user')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${profile.role === 'user' ? 'bg-white text-gray-800 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'}`} title="Operative"><UserIcon className="w-4 h-4" /></button>
                                                 </div>
                                             )}
                                             
                                             {amIGrandAdmin && !isMe && (
                                                <button 
                                                    onClick={() => setUserToDelete(profile)} 
                                                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100" 
                                                    title="Delete Operative"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                             )}
                                            </div>
                                         </td>
                                     </tr>
                                 );
                             })
                         ) : (
                             <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400"><UserCog className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No operatives found.</p></td></tr>
                         )}
                         </AnimatePresence>
                     </tbody>
                 </table>
             </div>
         )}
      </motion.div>

      {/* ... Modals (Edit User, Edge Code, SQL) same as previous ... */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={editingUser ? `Edit: ${editingUser.username}` : 'Edit Profile'}>
        <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${editingUser?.role === 'grand_admin' ? 'bg-orange-500' : editingUser?.role === 'master_admin' ? 'bg-blue-600' : editingUser?.role === 'admin' ? 'bg-purple-600' : 'bg-slate-500'}`}>{(editingUser?.full_name?.[0] || editingUser?.username?.[0] || 'U').toUpperCase()}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{editingUser?.username}</p><p className="text-xs text-gray-500 flex items-center"><span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${editingUser?.role === 'grand_admin' ? 'bg-orange-500' : editingUser?.role === 'master_admin' ? 'bg-blue-500' : editingUser?.role === 'admin' ? 'bg-purple-500' : 'bg-slate-500'}`}></span>{editingUser?.role === 'grand_admin' ? 'Grand Admin' : editingUser?.role === 'master_admin' ? 'Master Admin' : editingUser?.role === 'admin' ? 'Administrator' : 'Operative'}</p></div>
            </div>
            <Input label="Full Name" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="Agent Name" className="bg-white" />
            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 ml-1">Change Password</label>
                <div className="relative">
                    <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="block w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all sm:text-sm disabled:bg-gray-50 disabled:text-gray-400" placeholder={currentUser?.id === editingUser?.id ? "New password (optional)" : "Restricted: User must reset own password"} disabled={currentUser?.id !== editingUser?.id} />
                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                {currentUser?.id !== editingUser?.id && (<p className="text-[10px] text-gray-400 ml-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Security Protocol: Password changes must be performed by the operative.</p>)}
            </div>
            <div className="pt-4 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button><Button type="submit" isLoading={isSaving}><Save className="w-4 h-4 mr-2" />Save Changes</Button></div>
        </form>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} title="Confirm Deletion">
        <div className="text-center p-4">
             <div className="bg-rose-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                 <AlertTriangle className="h-8 w-8 text-rose-600" />
             </div>
             <h3 className="text-lg font-bold text-gray-900">Delete Operative?</h3>
             <p className="text-sm text-gray-500 mt-2 mb-6">
                 Are you sure you want to remove <span className="font-bold text-gray-800">{userToDelete?.username}</span>? 
                 <br/><span className="text-xs">This action removes their profile metadata.</span>
             </p>
             <div className="flex justify-center gap-3">
                 <Button variant="secondary" onClick={() => setUserToDelete(null)}>Cancel</Button>
                 <Button variant="danger" onClick={handleDeleteUser} isLoading={isDeleting}>Confirm Deletion</Button>
             </div>
        </div>
      </Modal>

      <Modal isOpen={isEdgeCodeModalOpen} onClose={() => setIsEdgeCodeModalOpen(false)} title="Edge Function Index Code">
          <div className="relative">
             <div className="absolute top-2 right-2 z-10"><button onClick={() => copyToClipboard(EDGE_FUNCTION_TEMPLATE)} className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"><Copy className="h-4 w-4" /></button></div>
             <pre className="bg-gray-900 text-emerald-400 p-4 rounded-xl overflow-x-auto text-xs font-mono max-h-[400px]">{EDGE_FUNCTION_TEMPLATE}</pre>
             <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => setIsEdgeCodeModalOpen(false)}>Close</Button></div>
          </div>
      </Modal>

      <Modal isOpen={isSqlModalOpen} onClose={() => setIsSqlModalOpen(false)} title="SQL Schema Setup">
          <div className="relative">
             <div className="absolute top-2 right-2 z-10"><button onClick={() => copyToClipboard(SQL_TEMPLATE)} className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"><Copy className="h-4 w-4" /></button></div>
             <pre className="bg-gray-900 text-blue-300 p-4 rounded-xl overflow-x-auto text-xs font-mono max-h-[400px]">{SQL_TEMPLATE}</pre>
             <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => setIsSqlModalOpen(false)}>Close</Button></div>
          </div>
      </Modal>

    </div>
  );
};

export default UsersPage;