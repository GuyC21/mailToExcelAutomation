/**
 * Authentication Context Provider.
 * 
 * Manages identity state via Supabase GoTrue and syncs lifecycle approval status
 * (PENDING, APPROVED, REJECTED) with the BillingStream FastAPI backend.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../api/supabase';
import { apiRequest, setAuthToken } from '../api/client';

const AuthContext = createContext(null);

/**
 * AuthProvider Component
 * 
 * Provides global authentication context to the application, maintaining:
 * - Active Supabase session and user identity.
 * - Local database UserProfile with role ('ADMIN'/'USER') and status ('PENDING'/'APPROVED'/'REJECTED').
 * - Methods for signIn, signUp, signOut, and profile refresh.
 * 
 * @component
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Fetches the local user profile from the backend to verify the latest approval status.
   * @param {string} token - Valid Supabase JWT access token.
   */
  const fetchUserProfile = useCallback(async (token) => {
    if (!token) {
      setProfile(null);
      return null;
    }
    setAuthToken(token);
    try {
      const data = await apiRequest('/api/auth/me');
      setProfile(data);
      return data;
    } catch (err) {
      console.warn('Failed to fetch user profile:', err.message);
      return null;
    }
  }, []);

  // Initialize session on boot and subscribe to auth state changes
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (isMounted && initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          setAuthToken(initialSession.access_token);
          await fetchUserProfile(initialSession.access_token);
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user || null);

      if (newSession?.access_token) {
        setAuthToken(newSession.access_token);
        await fetchUserProfile(newSession.access_token);
      } else {
        setAuthToken(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    // Listen for global auth expired events triggered by 401 API responses
    const handleExpired = () => {
      logout();
    };
    window.addEventListener('billingstream:auth_expired', handleExpired);

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      window.removeEventListener('billingstream:auth_expired', handleExpired);
    };
  }, [fetchUserProfile]);

  /**
   * Signs in an existing user with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ user: any, profile: any }>}
   */
  const login = async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      const msg = error.message.includes('Invalid login credentials')
        ? 'שם משתמש או סיסמה שגויים'
        : error.message;
      setAuthError(msg);
      throw new Error(msg);
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      setAuthToken(data.session.access_token);
      const userProfile = await fetchUserProfile(data.session.access_token);
      return { user: data.user, profile: userProfile };
    }
  };

  /**
   * Registers a new user account.
   * Automatically synchronizes the user profile in the local database in PENDING status.
   * @param {string} email
   * @param {string} password
   * @param {string} fullName
   * @returns {Promise<{ user: any, profile: any }>}
   */
  const register = async (email, password, fullName) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      throw new Error(error.message);
    }

    if (data.session) {
      setAuthToken(data.session.access_token);
      try {
        const synced = await apiRequest('/api/auth/sync-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: fullName }),
        });
        setProfile(synced);
        return { user: data.user, profile: synced };
      } catch (syncErr) {
        console.warn('Profile sync warning:', syncErr);
      }
    }

    return { user: data.user, profile: null };
  };

  /**
   * Logs out the active user session.
   */
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors on signout
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setAuthToken(null);
      setAuthError(null);
    }
  };

  /**
   * Re-queries the local database to update approval state.
   */
  const refreshProfile = async () => {
    if (session?.access_token) {
      return await fetchUserProfile(session.access_token);
    }
    return null;
  };

  const value = {
    session,
    user,
    profile,
    isLoading,
    authError,
    isAuthenticated: !!user && !!session,
    isApproved: profile?.status === 'APPROVED',
    isAdmin: profile?.role === 'ADMIN',
    login,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access authentication context.
 * @returns {ReturnType<typeof AuthProvider>}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
