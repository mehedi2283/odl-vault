import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, Shield, Users, Loader2, Mail, Calendar, UserCheck, Lock, Crown, Search, X, Pencil, Key, Trash2 } from 'lucide-react';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { supabase } from '../services/supabase';
import { RoutePath, User } from '../types';

interface Profile {
  id: string;
  username: string;
  full_name?: string;
  role: 'grand_admin' | 'admin' | 'user';
  created_at: string;
}

const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Edit State
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  
  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchProfiles();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
       setCurrentUserEmail(user.email);
       setCurrentUserId(user.id);
       // Fetch role to know rights
       const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
       if (data) setCurrentUserRole(data.role);
    }
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*'); 
      if (error) throw error;
      if (data) {
        const mappedProfiles: Profile[] = data.map((p: any) => ({
          ...p,
          role: (p.role === 'grand_admin' || p.role === 'admin') ? p.role : 'user'
        }));
        // Sort: Grand Admin > Admin > User, then Newest
        mappedProfiles.sort((a, b) => {
          const rolePriority = { 'grand_admin': 0, 'admin': 1, 'user': 2 };
          const priorityDiff = rolePriority[a.role] - rolePriority[b.role];
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setProfiles(mappedProfiles);
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setToast({ message: "Failed to load personnel records", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUserRedirect = async () => {
    localStorage.setItem('jackryan_auth_intent', 'signup');
    await supabase.auth.signOut();
  };

  const handleRoleChange = async (profile: Profile, newRole: 'admin' | 'user') => {
    if (profile.role === newRole) return;
    if (profile.role === 'grand_admin') { setToast({ message: "Grand Administrator privileges are immutable.", type: 'error' }); return; }
    if (profile.username === currentUserEmail && newRole === 'user') {
       if (!window.confirm("Warning: You are revoking your own admin rights. You will lose access immediately.")) return;
    }

    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: newRole } : p));
    
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id);
      if (error) throw error;
      setToast({ message: `Access level updated for ${profile.username}`, type: 'success' });
      if (profile.username === currentUserEmail && newRole === 'user') navigate(RoutePath.DASHBOARD);
    } catch (err) {
       fetchProfiles(); 
       setToast({ message: "Update failed.", type: 'error' });
    }
  };

  const openEditModal = (profile: Profile) => {
      setEditingProfile(profile);
      setEditName(profile.full_name || '');
      setIsEditProfileModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProfile) return;

      try {
          // Explicitly update full_name
          const { error } = await supabase
            .from('profiles')
            .update({ full_name: editName })
            .eq('id', editingProfile.id);
          
          if (error) throw error;
          
          setProfiles(prev => prev.map(p => p.id === editingProfile.id ? { ...p, full_name: editName } : p));
          setIsEditProfileModalOpen(false);
          setToast({ message: "Operative profile updated.", type: 'success' });
      } catch (error: any) {
          console.error("Profile update error:", error);
          if (error.message?.includes("does not exist") || error.code === '42703') {
             setToast({ message: "Database Schema Outdated: Run Setup SQL in Dashboard to add 'full_name' column.", type: 'error' });
          } else {
             setToast({ message: `Failed to update profile: ${error.message || "Unknown error"}`, type: 'error' });
          }
      }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
          setToast({ message: "Passwords do not match.", type: 'error' });
          return;
      }
      if (newPassword.length < 6) {
        setToast({ message: "Password must be at least 6 characters.", type: 'error' });
        return;
      }

      try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          setIsPasswordModalOpen(false);
          setToast({ message: "Security credentials updated.", type: 'success' });
          setNewPassword(''); setConfirmPassword('');
      } catch (error: any) {
          setToast({ message: error.message || "Update failed.", type: 'error' });
      }
  };

  const handleRemoveUser = async (profile: Profile) => {
    // Only grand_admin can remove users
    if (currentUserRole !== 'grand_admin') {
       setToast({ message: "Insufficient clearance to remove operatives.", type: 'error' });
       return;
    }
    if (profile.id === currentUserId) {
        setToast({ message: "Cannot remove self.", type: 'error' });
        return;
    }

    if (!window.confirm(`CONFIRM TERMINATION: Are you sure you want to remove ${profile.username}? This will revoke all access immediately.`)) return;

    try {
        // Delete from profiles. Trigger handles auth user? No, we can't delete auth user from client.
        // We delete profile, effectively banning them from the app logic (which checks profile).
        const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
        if (error) throw error;
        
        setProfiles(prev => prev.filter(p => p.id !== profile.id));
        setToast({ message: "Operative removed from registry.", type: 'success' });
    } catch (error) {
        setToast({ message: "Failed to remove operative.", type: 'error' });
    }
  };

  const filteredProfiles = profiles.filter(profile => {
    const query = searchQuery.toLowerCase();
    return (
      profile.username.toLowerCase().includes(query) ||
      (profile.full_name && profile.full_name.toLowerCase().includes(query)) ||
      profile.role.replace('_', ' ').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Access Control</h1>
          <p className="mt-1 text-gray-500">Manage operative clearance and credentials.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
             <input type="text" placeholder="Search operatives..." className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 w-full sm:w-64 transition-all shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
             {searchQuery && (<button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>)}
          </div>
          <Button onClick={() => setIsCreateUserModalOpen(true)} className="whitespace-nowrap"><UserPlus className="h-5 w-5 mr-2" />Register Operative</Button>
          <Button variant="secondary" onClick={() => setIsPasswordModalOpen(true)} className="whitespace-nowrap"><Key className="h-5 w-5 mr-2" />My Password</Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64"><Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-3" /><p className="text-gray-500 text-sm">Retrieving personnel records...</p></div>
        ) : filteredProfiles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Identity</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Clearance</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProfiles.map((profile) => {
                  const isGrandAdmin = profile.role === 'grand_admin';
                  const isCurrentUser = profile.username === currentUserEmail;
                  const isAdmin = profile.role === 'admin';
                  const displayName = profile.full_name || profile.username.split('@')[0];

                  return (
                    <tr key={profile.id} className={`hover:bg-gray-50/50 transition-colors group ${isCurrentUser ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm transition-colors ${isGrandAdmin ? 'bg-gradient-to-br from-amber-400 to-orange-600' : isAdmin ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-400'}`}>
                              {isGrandAdmin ? <Crown className="h-5 w-5 text-white" /> : displayName.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 flex items-center group-hover:text-indigo-600 transition-colors">
                              {displayName}
                              {isCurrentUser && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold border border-indigo-200">YOU</span>}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center mt-0.5"><Mail className="h-3 w-3 mr-1" />{profile.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isGrandAdmin ? (
                           <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-sm"><Crown className="h-3 w-3 mr-1" />Grand Administrator</span>
                        ) : (
                           <div className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm ${isAdmin ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200'}`} style={{ width: isAdmin ? '128px' : '105px' }}>
                             {isAdmin ? <Shield className="h-3 w-3 mr-1.5 flex-shrink-0" /> : <UserCheck className="h-3 w-3 mr-1.5 flex-shrink-0" />}
                             <span className="relative top-[0.5px]">{isAdmin ? 'Administrator' : 'Operative'}</span>
                           </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center text-sm text-gray-500"><Calendar className="h-4 w-4 mr-1.5 text-gray-400" />{new Date(profile.created_at).toLocaleDateString()}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                         <div className="flex items-center justify-end gap-2">
                             {(currentUserRole === 'grand_admin' || isCurrentUser) && (
                                <button onClick={() => openEditModal(profile)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Name"><Pencil className="h-4 w-4" /></button>
                             )}
                             
                             {isGrandAdmin ? (
                                <div className="mx-2" title="Protected">
                                  <Lock className="h-4 w-4 text-amber-200/50" />
                                </div>
                             ) : (
                               <>
                                 <div 
                                    onClick={() => handleRoleChange(profile, isAdmin ? 'user' : 'admin')}
                                    className="relative flex items-center w-24 h-8 p-[2px] rounded-lg cursor-pointer bg-zinc-100 border border-zinc-200 select-none mx-2 overflow-hidden"
                                    title="Toggle Clearance"
                                  >
                                    <div className={`absolute top-[2px] bottom-[2px] w-[50%] bg-white rounded shadow-sm border border-zinc-200 transition-all duration-300 ${isAdmin ? 'left-[48%]' : 'left-[2px]'}`}></div>
                                    <div className={`relative z-10 w-full flex text-[9px] font-bold uppercase tracking-wider ${isAdmin ? 'justify-end pr-2 text-indigo-700' : 'justify-start pl-2 text-zinc-500'}`}>{isAdmin ? 'Admin' : 'User'}</div>
                                  </div>

                                  {currentUserRole === 'grand_admin' && !isCurrentUser && (
                                      <button onClick={() => handleRemoveUser(profile)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Remove User"><Trash2 className="h-4 w-4" /></button>
                                  )}
                               </>
                             )}
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="bg-gray-50 p-4 rounded-full mb-4"><Users className="h-8 w-8 text-gray-400" /></div>
            <h3 className="text-lg font-medium text-gray-900">No Operatives Found</h3>
            {searchQuery && (<Button variant="secondary" onClick={() => setSearchQuery('')} className="mt-4">Clear Search</Button>)}
          </div>
        )}
      </div>

      <Modal isOpen={isCreateUserModalOpen} onClose={() => setIsCreateUserModalOpen(false)} title="Register New Operative">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start"><AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" /><div className="ml-3 text-sm text-amber-800"><p className="font-semibold mb-1">Session Termination Required</p><p>To ensure cryptographic integrity, creating a new identity requires the current active session to be terminated.</p></div></div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100 mt-2"><Button variant="secondary" onClick={() => setIsCreateUserModalOpen(false)}>Cancel</Button><Button onClick={handleCreateUserRedirect}>Proceed to Registration</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isEditProfileModalOpen} onClose={() => setIsEditProfileModalOpen(false)} title="Update Operative Profile">
         <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input label="Full Name / Codename" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Agent Name" autoFocus />
            <div className="pt-4 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => setIsEditProfileModalOpen(false)}>Cancel</Button><Button type="submit">Save Changes</Button></div>
         </form>
      </Modal>

      <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Change My Password">
         <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            <div className="pt-4 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => setIsPasswordModalOpen(false)}>Cancel</Button><Button type="submit">Update Password</Button></div>
         </form>
      </Modal>
    </div>
  );
};

export default UsersPage;