import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './src/components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import ChatPage from './pages/ChatPage';
import DeadDropPage from './pages/DeadDropPage';
import ProtectedRoute from './src/components/ProtectedRoute';
import { RoutePath, User } from './types';
import { supabase } from './services/supabase';

// Wrapper to handle redirect logic cleanly
const LoginRoute = ({ user }: { user: User | null }) => {
  const location = useLocation();
  
  if (user) {
    // If we have a 'from' location in state, redirect there
    // The state object is preserved by ProtectedRoute's <Navigate state={{ from: location }} />
    const from = location.state?.from?.pathname 
      ? location.state.from.pathname + (location.state.from.search || '') + (location.state.from.hash || '')
      : RoutePath.DASHBOARD;
      
    return <Navigate to={from} replace />;
  }
  return <LoginPage />;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch profile role/name in background
  const fetchUserProfile = async (uid: string, email?: string) => {
    try {
      // 1. Try to get the EXACT profile match (Auth ID === Profile ID)
      const { data: exactProfile, error: exactError } = await supabase
        .from('profiles')
        .select('*') // Wildcard select is safer for varying schemas
        .eq('id', uid)
        .maybeSingle();
      
      // 2. Handle "Manual Entry" Mismatch (Orphaned Profile)
      // Scenario: User manually added row in Supabase with random ID but correct Email.
      // We must migrate this permission to the correct Auth ID.
      if (!exactProfile && email) {
          const { data: orphanedProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', email)
            .maybeSingle();
            
          if (orphanedProfile) {
              console.log("Found manual profile entry with mismatching ID. Migrating permissions...");
              
              // A. Delete the manual entry (Wrong ID)
              await supabase.from('profiles').delete().eq('id', orphanedProfile.id);
              
              // B. Create new entry with CORRECT Auth ID and preserve the manual Role
              const { error: migrationError } = await supabase.from('profiles').insert({
                  id: uid,
                  username: email,
                  role: orphanedProfile.role, // KEEP THE MANUAL ROLE
                  full_name: orphanedProfile.full_name
              });
              
              if (!migrationError) {
                  // Retry fetch to get the correct user object
                  return fetchUserProfile(uid, email);
              } else {
                  console.error("Migration failed", migrationError);
              }
          }
      }

      // 3. Self-Healing (No profile found at all)
      if (!exactProfile) {
          console.log("Profile missing. Creating default...");
           const isOwner = email === 'babu.octopidigital@gmail.com';
           const { error: insertError } = await supabase.from('profiles').insert({
              id: uid,
              username: email,
              role: isOwner ? 'grand_admin' : 'user',
              full_name: isOwner ? 'Grand Administrator' : undefined
           });
           
           if (!insertError) {
              // Retry fetch
              return fetchUserProfile(uid, email);
           }
      }

      // 4. Update State if we have a profile (either found initially or after migration/creation)
      // We fetch again or use the exactProfile if it existed
      const { data: finalProfile } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();

      if (finalProfile) {
         // Force Override for Specific Email (Fail-safe for owner)
         if (email === 'babu.octopidigital@gmail.com' && finalProfile.role !== 'grand_admin') {
             await supabase.from('profiles').update({ role: 'grand_admin' }).eq('id', uid);
             finalProfile.role = 'grand_admin';
         }

         setUser(prev => prev ? { 
           ...prev, 
           username: finalProfile.username || prev.username, 
           full_name: finalProfile.full_name,
           role: (finalProfile.role as User['role']) || 'user' 
         } : null);
      }
    } catch (error) {
      console.warn("Profile fetch error", error);
    }
  };

  useEffect(() => {
    // 1. Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          username: session.user.email || 'Operative',
          role: 'user' // Default to user, upgrade later
        });
        fetchUserProfile(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    // 2. Listen for auth changes (Login, Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          username: session.user.email || 'Operative',
          role: 'user'
        });
        fetchUserProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const isAuthorizedAdmin = user?.role === 'admin' || user?.role === 'grand_admin';

  return (
    <HashRouter>
      <Routes>
        <Route 
          path={RoutePath.LOGIN} 
          element={<LoginRoute user={user} />} 
        />
        
        <Route
          path={RoutePath.DASHBOARD}
          element={
            <ProtectedRoute isAuthenticated={!!user}>
              <Layout onLogout={handleLogout} user={user}>
                <DashboardPage user={user} />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path={RoutePath.CHAT}
          element={
            <ProtectedRoute isAuthenticated={!!user}>
              <Layout onLogout={handleLogout} user={user}>
                <ChatPage user={user} />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path={RoutePath.DEAD_DROP + "/*"}
          element={
            <ProtectedRoute isAuthenticated={!!user}>
              <Layout onLogout={handleLogout} user={user}>
                <DeadDropPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path={RoutePath.USERS}
          element={
            <ProtectedRoute isAuthenticated={!!user}>
              {isAuthorizedAdmin ? (
                <Layout onLogout={handleLogout} user={user}>
                  <UsersPage />
                </Layout>
              ) : (
                <Navigate to={RoutePath.DASHBOARD} replace />
              )}
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={RoutePath.DASHBOARD} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;