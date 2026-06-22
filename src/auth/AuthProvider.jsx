import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Session + profile context. A signed-in auth user is matched to an `agents`
// row by email; `is_vendor()` (RPC) reports cross-hotel access.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [agent, setAgent] = useState(null);
  const [isVendor, setIsVendor] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (sess) => {
    if (!sess?.user) {
      setAgent(null);
      setIsVendor(false);
      return;
    }
    try {
      const [agentRes, vendorRes] = await Promise.all([
        supabase
          .from('agents')
          .select('id, hotel_id, name, email, agent_code')
          .eq('email', sess.user.email)
          .maybeSingle(),
        supabase.rpc('is_vendor'),
      ]);
      setAgent(agentRes.data ?? null);
      setIsVendor(Boolean(vendorRes.data));
    } catch (e) {
      setAgent(null);
      setIsVendor(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (!active) return;
      setSession(sess);
      await loadProfile(sess);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    (email, password) => supabase.auth.signInWithPassword({ email, password }),
    [],
  );
  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const value = {
    session,
    user: session?.user ?? null,
    agent,
    isVendor,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
