import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import DeadDropPage from './pages/DeadDropPage';
import UsersPage from './pages/UsersPage';
import ProtectedRoute from './components/ProtectedRoute';
import { RoutePath, User } from './types';
import { supabase } from './services/supabase';

// Wrapper to handle redirect logic cleanly
const LoginRoute = ({ user }: { user: User | null }) => {
  const location = useLocation();
  
  if (user) {
    // If we have a 'from' location in state, redirect there
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
      const { data: exactProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      
      if (!exactProfile && email) {
           const isOwner = email === 'babu.octopidigital@gmail.com';
           await supabase.from('profiles').insert({
              id: uid,
              username: email,
              role: isOwner ? 'grand_admin' : 'user',
              full_name: isOwner ? 'Grand Administrator' : undefined
           });
           return fetchUserProfile(uid, email);
      }

      if (exactProfile) {
         if (email === 'babu.octopidigital@gmail.com' && exactProfile.role !== 'grand_admin') {
             await supabase.from('profiles').update({ role: 'grand_admin' }).eq('id', uid);
             exactProfile.role = 'grand_admin';
         }

         setUser(prev => prev ? { 
           ...prev, 
           username: exactProfile.username || prev.username, 
           full_name: exactProfile.full_name,
           role: (exactProfile.role as User['role']) || 'user' 
         } : null);
      }
    } catch (error) {
      console.warn("Profile fetch error", error);
    }
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.email || 'Operative',
          role: 'user' // Default until profile fetch
        });
        fetchUserProfile(session.user.id, session.user.email);
      }
    }).catch(err => {
      console.error("Session check failed", err);
    }).finally(() => {
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Only update if ID changes to avoid redundant updates during profile fetch
        setUser(prev => {
          if (prev?.id === session.user.id) return prev;
          return {
            id: session.user.id,
            email: session.user.email,
            username: session.user.email || 'Operative',
            role: 'user'
          };
        });
        if (session.user.id !== user?.id) {
           fetchUserProfile(session.user.id, session.user.email);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear persistent lock state on logout
    localStorage.removeItem('odl_is_locked');
    localStorage.removeItem('odl_last_active');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

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
              <Layout onLogout={handleLogout} user={user}>
                <UsersPage user={user} />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        {/* Catch-all redirects to Dashboard (which handles auth check) */}
        <Route path="*" element={<Navigate to={RoutePath.DASHBOARD} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;