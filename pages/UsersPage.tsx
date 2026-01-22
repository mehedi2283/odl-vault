import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Users as UsersIcon, Search, Shield, ShieldAlert, 
  Loader2, Crown, Mail, Calendar, User as UserIcon, Lock, 
  CheckCircle2, UserCog, Pencil, Key, X, Save,
  Terminal, Database, Copy, Code,
  ShieldCheck, Clock, Trash2, AlertTriangle, KeyRound, RefreshCcw,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { User, ToastContextType, PasswordResetRequest } from '../types';
import Modal from '../components/Modal';
import Input from '../components/Input';
import Button from '../components/Button';
import { useOnlineUsers } from '../components/PresenceProvider';

// Function to handle Password Resets without Email (Requires Service Role)
const RESET_PWD_FUNCTION_TEMPLATE = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check Env Vars
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
        throw new Error("Server Misconfiguration: Missing Environment Variables");
    }

    // 1. Initialize Client with user's Auth Header (to verify who is calling)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization Header");

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    // 2. Verify Requestor is authenticated
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 3. Verify Requestor is Grand Admin
    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single()
    
    if (profile?.role !== 'grand_admin') {
        return new Response(JSON.stringify({ error: 'Insufficient Clearance' }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
    }

    // 4. Initialize Admin Client (Service Role)
    const supabaseAdmin = createClient(
      supabaseUrl, 
      supabaseServiceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { userId, newPassword, requestId } = await req.json()
    
    if (!userId || !newPassword) throw new Error("Missing parameters")

    // 5. Update user password
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (error) throw error

    // 6. If this was a request from the DB, mark it resolved
    if (requestId) {
        await supabaseAdmin.from('password_resets').update({ status: 'resolved' }).eq('id', requestId)
    }

    return new Response(JSON.stringify({ success: true, user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    // Return 200 to ensure client sees the error message
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  }
})`;

// Function to handle Form Submissions (Provided by User)
const EDGE_FUNCTION_TEMPLATE = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
 if (req.method === 'HEAD') {
    return new Response(null, { status: 200 })
  }

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
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS seen_by jsonb default '[]'::jsonb;

-- NEW: Password Reset Requests Table
create table if not exists public.password_resets (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.password_resets enable row level security;

-- Allow anyone to insert (public request)
create policy "Public requests" on public.password_resets for insert to anon, authenticated with check (true);

-- Allow Grand Admins to see and update
create policy "Admin Manage" on public.password_resets for all to authenticated using (auth.uid() in (select id from public.profiles where role = 'grand_admin'));

-- PREVENT DUPLICATES: Unique Index on pending requests per email
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_reset ON public.password_resets (email) WHERE status = 'pending';
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
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Pagination for Requests
  const [requestPage, setRequestPage] = useState(1);
  const REQUESTS_PER_PAGE = 3;
  
  const isGrandAdmin = currentUser?.role === 'grand_admin';

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

  // Password Reset Modal (Admin Action)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [resetTargetId, setResetTargetId] = useState<string | null>(null); 
  const [resetRequestId, setResetRequestId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // System Access Modals
  const [isEdgeCodeModalOpen, setIsEdgeCodeModalOpen] = useState(false);
  const [isResetCodeModalOpen, setIsResetCodeModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  const fetchProfiles = async (showLoading = true) => {
    if (!isGrandAdmin) return; // Don't fetch full list if not Grand Admin
    try {
      if (showLoading) setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*');
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
      if (showLoading) showToast("Failed to load operative list.", "error");
    } finally {
      if (showLoading) setLoading(false);
    }
  };
  
  const fetchResetRequests = async () => {
      if (!isGrandAdmin) return;
      try {
          // Fetch ALL pending requests to allow client-side pagination
          const { data } = await supabase
            .from('password_resets')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
            
          if (data) setResetRequests(data);
      } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (isGrandAdmin) {
        fetchProfiles(true);
        fetchResetRequests();
        const interval = setInterval(() => { fetchProfiles(false); fetchResetRequests(); }, 60000); 
        return () => clearInterval(interval);
    } else {
        setLoading(false);
    }
  }, [isGrandAdmin]);

  const toggleTerminal = () => {
      window.dispatchEvent(new Event('odl-terminal-toggle'));
  };

  const handleRoleUpdate = async (userId: string, newRole: 'admin' | 'user' | 'master_admin') => {
    if (!currentUser) return;
    const myRole = currentUser.role;
    if (myRole !== 'grand_admin' && myRole !== 'master_admin') {
        showToast("Unauthorized action.", "error");
        return;
    }
    setUpdatingId(userId);
    try {
        const { error } = await supabase.rpc('update_user_role', { target_user_id: userId, new_role: newRole });
        if (error) throw error;
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
        showToast(`Clearance updated to ${newRole.replace('_', ' ').toUpperCase()}.`, "success");
    } catch (error: any) {
        let msg = error.message || "Failed to update clearance.";
        if (msg.includes('function not found')) msg = "System Error: SQL function missing.";
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
          const { error: profileError } = await supabase.from('profiles').update(updates).eq('id', editingUser.id);
          if (profileError) throw profileError;

          if (formData.password) {
              if (currentUser?.id === editingUser.id) {
                  // Direct update for own password (works for Grand Admin too)
                  const { error: authError } = await supabase.auth.updateUser({ password: formData.password });
                  if (authError) throw authError;
              } else {
                  showToast("Password change skipped. Use 'Reset Password' for others.", "info");
              }
          }
          showToast(`Profile updated.`, "success");
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
        await Promise.all([
            supabase.from('credentials').update({ created_by: null }).eq('created_by', uid),
            supabase.from('folders').update({ created_by: null }).eq('created_by', uid),
            supabase.from('forms').update({ created_by: null }).eq('created_by', uid),
        ]);
        await supabase.from('messages').delete().eq('user_id', uid);
        const { error } = await supabase.from('profiles').delete().eq('id', uid);
        if (error) throw error;
        setProfiles(prev => prev.filter(p => p.id !== uid));
        showToast(`Operative ${userToDelete.username} deleted.`, "success");
        setUserToDelete(null);
    } catch (err: any) {
         showToast(err.message || "Failed to delete user.", "error");
    } finally {
        setIsDeleting(false);
    }
  };
  
  const handleAdminPasswordReset = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPassword || !resetTargetId) return;
      setIsSaving(true);
      
      try {
          // Attempt to call the Edge Function 'admin-set-password'
          const { data, error } = await supabase.functions.invoke('admin-set-password', {
              body: { 
                  userId: resetTargetId, 
                  newPassword: newPassword,
                  requestId: resetRequestId 
              }
          });

          if (error) {
              console.error("Function Error:", error);
              throw new Error(error.message || "Edge Function invocation failed");
          }
          
          if (data?.error) {
              throw new Error(data.error);
          }

          showToast(`Credentials updated for ${resetTargetEmail}.`, "success");
          
          // Cleanup local state
          if (resetRequestId) {
              setResetRequests(prev => prev.filter(r => r.id !== resetRequestId));
              // Reset page if needed
              if ((resetRequests.length - 1) % REQUESTS_PER_PAGE === 0 && requestPage > 1) {
                  setRequestPage(prev => prev - 1);
              }
          }
          
          setIsResetModalOpen(false);
          setNewPassword('');
          setResetTargetEmail('');
          setResetTargetId(null);
          setResetRequestId(null);
          
          // Log to terminal
          window.dispatchEvent(new CustomEvent('odl-log', { detail: { message: `AUTH_OVERRIDE: Password reset for ${resetTargetEmail}`, type: 'success' } }));

      } catch (err: any) {
          console.error("Reset Flow Error:", err);
          let userMsg = err.message;
          
          if (userMsg.includes('unreachable') || userMsg.includes('Failed to fetch')) {
             userMsg = "Connection failed. Is the function deployed?";
          } else if (userMsg.includes('non-2xx')) {
             userMsg = "Server Rejected Request (Check Logs/Permissions)";
          }

          showToast(userMsg, "error");
          
          // Open the helper modal if function fails significantly
          if (userMsg.includes('deployed') || userMsg.includes('Server Rejected')) {
              setIsResetCodeModalOpen(true);
          }
      } finally {
          setIsSaving(false);
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

  // Pagination Logic for Reset Requests
  const totalRequestPages = Math.ceil(resetRequests.length / REQUESTS_PER_PAGE);
  const displayedRequests = resetRequests.slice(
      (requestPage - 1) * REQUESTS_PER_PAGE,
      requestPage * REQUESTS_PER_PAGE
  );

  // Date Format for Request Cards: DD/MM/YYYY, h:mm a
  const formatRequestDate = (iso: string) => {
      const d = new Date(iso);
      const datePart = d.toLocaleDateString('en-GB'); // DD/MM/YYYY
      const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${datePart}, ${timePart}`;
  };

  // --- RESTRICTED VIEW FOR NON-GRAND-ADMINS ---
  if (!isGrandAdmin) {
      return (
          <div className="max-w-3xl mx-auto pt-10 px-4">
              {/* ... Same as before ... */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden relative">
                  <div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
                  <div className="px-8 pb-8">
                      <div className="relative -mt-12 mb-6 flex justify-between items-end">
                          <div className="w-24 h-24 rounded-full bg-white p-1.5 shadow-lg">
                              <div className="w-full h-full rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-3xl">
                                  {(currentUser?.full_name?.[0] || currentUser?.username?.[0] || 'U').toUpperCase()}
                              </div>
                          </div>
                          {currentUser && (
                             <button onClick={() => openEditModal({ ...currentUser, role: currentUser.role } as Profile)} className="mb-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors">
                                 Edit Profile
                             </button>
                          )}
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900">{currentUser?.full_name || currentUser?.username}</h1>
                      <p className="text-sm text-gray-500 mb-6">{currentUser?.username}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Clearance Level</div>
                              <div className="font-semibold text-gray-800 flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-indigo-500" />
                                  {currentUser?.role === 'master_admin' ? 'Master Admin' : currentUser?.role === 'admin' ? 'Administrator' : 'Operative'}
                              </div>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status</div>
                              <div className="font-semibold text-emerald-600 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Active
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
              
              <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit My Profile">
                <form onSubmit={handleSaveProfile} className="space-y-5">
                    <Input label="Full Name" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="Agent Name" className="bg-white" />
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700 ml-1">Change Password</label>
                        <div className="relative">
                            <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="block w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all sm:text-sm" placeholder="New password (optional)" />
                            <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button><Button type="submit" isLoading={isSaving}><Save className="w-4 h-4 mr-2" />Save Changes</Button></div>
                </form>
              </Modal>
          </div>
      );
  }

  // --- GRAND ADMIN VIEW ---
  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      {/* Password Reset Requests Section */}
      {resetRequests.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                      <KeyRound className="w-5 h-5" /> Pending Recovery Requests
                  </h2>
                  {totalRequestPages > 1 && (
                      <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-amber-100 p-1">
                          <button 
                              onClick={() => setRequestPage(p => Math.max(1, p - 1))}
                              disabled={requestPage === 1}
                              className="p-1 hover:bg-amber-50 rounded text-amber-700 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                              <ChevronLeft size={16} />
                          </button>
                          <span className="text-xs font-bold text-amber-800 px-2 min-w-[3rem] text-center">
                              {requestPage} / {totalRequestPages}
                          </span>
                          <button 
                              onClick={() => setRequestPage(p => Math.min(totalRequestPages, p + 1))}
                              disabled={requestPage === totalRequestPages}
                              className="p-1 hover:bg-amber-50 rounded text-amber-700 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                              <ChevronRight size={16} />
                          </button>
                      </div>
                  )}
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence mode="wait">
                      {displayedRequests.map(req => {
                          // Find profile ID for this email if possible
                          const profile = profiles.find(p => p.username === req.email);
                          return (
                              <motion.div 
                                key={req.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex flex-col justify-between h-32"
                              >
                                  <div>
                                      <p className="font-bold text-gray-800 truncate" title={req.email}>{req.email}</p>
                                      <p className="text-xs text-gray-500 mt-1">
                                          {formatRequestDate(req.created_at)}
                                      </p>
                                  </div>
                                  <button 
                                    onClick={() => { 
                                        setResetTargetEmail(req.email); 
                                        setResetTargetId(profile?.id || null); 
                                        setResetRequestId(req.id);
                                        if(profile?.id) setIsResetModalOpen(true);
                                        else showToast("User profile not found for this email.", "error");
                                    }}
                                    className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold uppercase rounded-lg transition-colors mt-2"
                                  >
                                      Reset Password
                                  </button>
                              </motion.div>
                          );
                      })}
                  </AnimatePresence>
              </div>
          </div>
      )}

      {/* ... Rest of the component (Search, Grid, Modals) ... */}
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
            
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                   <button onClick={toggleTerminal} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg border border-transparent hover:border-green-100 transition-all" title="Toggle System Terminal"><Terminal className="h-5 w-5" /></button>
                   <div className="w-px h-6 bg-gray-100"></div>
                   <button onClick={() => setIsEdgeCodeModalOpen(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all" title="View Form Edge Function"><Code className="h-5 w-5" /></button>
                   <button onClick={() => setIsResetCodeModalOpen(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all" title="View Password Reset Function"><Key className="h-5 w-5" /></button>
                   <button onClick={() => setIsSqlModalOpen(true)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all" title="View SQL Schema"><Database className="h-5 w-5" /></button>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
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
                                 // Check if target is Grand Admin - if so, lock controls
                                 const isTargetGrandAdmin = profile.role === 'grand_admin';
                                 
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
                                                         <button onClick={() => openEditModal(profile)} className="ml-2 p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100" title="Edit Profile"><Pencil className="w-3.5 h-3.5" /></button>
                                                     </div>
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
                                                 {/* Role Switcher - HIDDEN FOR GRAND ADMINS */}
                                                 {!isTargetGrandAdmin && (
                                                     <div className="relative inline-flex bg-gray-100 p-1.5 rounded-lg border border-gray-200 select-none shadow-inner">
                                                         {updatingId === profile.id && (<div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] rounded-lg flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-indigo-600" /></div>)}
                                                         <button onClick={() => handleRoleUpdate(profile.id, 'master_admin')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${profile.role === 'master_admin' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'}`} title="Master Admin"><ShieldCheck className="w-4 h-4" /></button>
                                                         <button onClick={() => handleRoleUpdate(profile.id, 'admin')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${profile.role === 'admin' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'}`} title="Admin"><ShieldAlert className="w-4 h-4" /></button>
                                                         <button onClick={() => handleRoleUpdate(profile.id, 'user')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${profile.role === 'user' ? 'bg-white text-gray-800 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'}`} title="Operative"><UserIcon className="w-4 h-4" /></button>
                                                     </div>
                                                 )}
                                             
                                                 {!isMe && !isTargetGrandAdmin && (
                                                    <button 
                                                        onClick={() => setUserToDelete(profile)} 
                                                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100" 
                                                        title="Delete Operative"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                 )}
                                                 
                                                 {/* Allow resetting password even for self if G-Admin wants to test flow, or other users */}
                                                 <button
                                                    onClick={() => { setResetTargetEmail(profile.username); setResetTargetId(profile.id); setIsResetModalOpen(true); }}
                                                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
                                                    title="Reset Password"
                                                 >
                                                    <RefreshCcw className="w-4 h-4" />
                                                 </button>
                                            </div>
                                         </td>
                                     </motion.tr>
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
      </div>

      {/* Edit User Modal */}
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
                    <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="block w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all sm:text-sm disabled:bg-gray-50 disabled:text-gray-400" placeholder={currentUser?.id === editingUser?.id ? "New password (optional)" : "Restricted: Use Reset Password Action"} disabled={currentUser?.id !== editingUser?.id} />
                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
            </div>
            <div className="pt-4 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button><Button type="submit" isLoading={isSaving}><Save className="w-4 h-4 mr-2" />Save Changes</Button></div>
        </form>
      </Modal>
      
      {/* Password Reset Modal - Updated for Manual Input */}
      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="Set New Password">
          <form onSubmit={handleAdminPasswordReset} className="space-y-4">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                  <KeyRound className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                      <h4 className="text-sm font-bold text-amber-900">Overriding credentials for:</h4>
                      <p className="font-mono text-sm text-amber-800 break-all">{resetTargetEmail}</p>
                  </div>
              </div>
              <p className="text-xs text-gray-500">This action requires the <b>admin-set-password</b> edge function. It will directly update the user's password without email confirmation.</p>
              
              <Input 
                  label="New Password" 
                  type="text" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  placeholder="Enter new secure password"
                  autoFocus 
                  required
              />
              
              <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setIsResetModalOpen(false)}>Cancel</Button>
                  <Button type="submit" isLoading={isSaving}>Set Password</Button>
              </div>
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

      <Modal isOpen={isResetCodeModalOpen} onClose={() => setIsResetCodeModalOpen(false)} title="Password Reset Edge Function">
          <div className="relative">
             <p className="text-sm text-gray-600 mb-2">Deploy this as <b>admin-set-password</b> in Supabase Edge Functions.</p>
             <div className="absolute top-8 right-2 z-10"><button onClick={() => copyToClipboard(RESET_PWD_FUNCTION_TEMPLATE)} className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"><Copy className="h-4 w-4" /></button></div>
             <pre className="bg-gray-900 text-indigo-300 p-4 rounded-xl overflow-x-auto text-xs font-mono max-h-[400px]">{RESET_PWD_FUNCTION_TEMPLATE}</pre>
             <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => setIsResetCodeModalOpen(false)}>Close</Button></div>
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