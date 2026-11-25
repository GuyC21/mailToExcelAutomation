/**
 * Authentication Context Provider.
 *
 * Manages Supabase GoTrue identity state and syncs account approval status
 * (PENDING, APPROVED, REJECTED, SUSPENDED) with the BillingStream FastAPI backend.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { isSupabaseConfigured, supabase } from '../api/supabase';
import { setAuthToken } from '../api/client';
import { AuthContext } from './contexts';
import { assertSupabaseConfigured, fetchCurrentUserProfile, syncRegisteredProfile, translateAuthError } from '../utils/authHelpers';

/**
 * Provides global authentication state, profile synchronization, and auth actions.
 * @component
 * @param {{ children: React.ReactNode }} props - Child tree to wrap with auth context.
 * @returns {JSX.Element}
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState(null);

  const fetchUserProfile = useCallback(async (token) => {
    const data = await fetchCurrentUserProfile(token);
    setProfile(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch { /* Ignore signout errors */ }
    setSession(null);
    setUser(null);
    setProfile(null);
    setAuthToken(null);
    setAuthError(null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let isMounted = true;
    let bootHandled = false;

    async function initializeAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        bootHandled = true;
        if (isMounted && initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchUserProfile(initialSession.access_token);
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted || (event === 'INITIAL_SESSION' && bootHandled)) return;
      setSession(newSession);
      setUser(newSession?.user || null);
      if (newSession?.access_token) {
        await fetchUserProfile(newSession.access_token);
      } else {
        setAuthToken(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    const handleExpired = () => logout();
    window.addEventListener('billingstream:auth_expired', handleExpired);
    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      window.removeEventListener('billingstream:auth_expired', handleExpired);
    };
  }, [fetchUserProfile, logout]);

  const login = useCallback(async (email, password) => {
    setAuthError(null);
    try {
      assertSupabaseConfigured(isSupabaseConfigured);
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(translateAuthError(error, 'שגיאה בהתחברות למערכת'));
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        return { user: data.user, profile: await fetchUserProfile(data.session.access_token) };
      }
      return { user: data.user, profile: null };
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, [fetchUserProfile]);

  const register = useCallback(async (email, password, fullName) => {
    setAuthError(null);
    try {
      assertSupabaseConfigured(isSupabaseConfigured);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password, options: { data: { full_name: fullName.trim() } },
      });
      if (error) throw new Error(translateAuthError(error, 'שגיאה ביצירת החשבון'));
      if (data.session) {
        const synced = await syncRegisteredProfile(data.session.access_token, fullName);
        if (synced) setProfile(synced);
        return { user: data.user, profile: synced };
      }
      return { user: data.user, profile: null };
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, []);

  const refreshProfile = useCallback(async () => (
    session?.access_token ? fetchUserProfile(session.access_token) : null
  ), [session, fetchUserProfile]);

  const value = useMemo(() => ({
    session, user, profile, isLoading, authError,
    isAuthenticated: Boolean(user && session),
    isApproved: profile?.status === 'APPROVED',
    isAdmin: profile?.role === 'ADMIN',
    login, register, logout, refreshProfile,
  }), [session, user, profile, isLoading, authError, login, register, logout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
