import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string, userEmail?: string, userMetadata?: any) => {
    // try to fetch the profile with retry
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) {
        console.error(`getProfile attempt ${attempt} error:`, error);
      }
      if (data) {
        setProfile(data as Profile);
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    // fallback to insert if trigger didn't run or was delayed
    try {
      const username = userMetadata?.username || userMetadata?.full_name?.split(' ')[0]?.toLowerCase() || userEmail?.split('@')[0] || 'user';
      const fullName = userMetadata?.full_name || '';
      const avatarUrl = userMetadata?.avatar_url || '';
      
      const { data, error } = await supabase.from('profiles').insert({
        id: userId,
        username,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: 'user'
      }).select().maybeSingle();
      
      if (error) {
        console.error('Fallback profile creation error:', error);
      }
      if (data) {
        setProfile(data as Profile);
        return;
      }
    } catch (err) {
      console.error('Failed to create fallback profile:', err);
    }
    
    // Ultimate mock profile fallback so the user is NEVER locked out of the app!
    console.warn('Both Supabase profile fetch and client fallback creation failed. Using local mock profile.');
    const mockProfile: Profile = {
      id: userId,
      username: userMetadata?.username || userEmail?.split('@')[0] || 'guest',
      full_name: userMetadata?.full_name || 'Guest User',
      avatar_url: userMetadata?.avatar_url || '',
      bio: '',
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setProfile(mockProfile);
  }, []);

  useEffect(() => {
    let active = true;

    // Detect if we are currently in an OAuth callback redirect
    const isOAuthCallback = window.location.hash.includes('access_token=') || window.location.hash.includes('error=');
    if (isOAuthCallback) {
      setLoading(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id, data.session.user.email, data.session.user.user_metadata)
          .finally(() => {
            if (active) setLoading(false);
          });
      } else if (!isOAuthCallback) {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!active) return;
      setSession(sess);
      if (sess?.user) {
        setLoading(true);
        loadProfile(sess.user.id, sess.user.email, sess.user.user_metadata)
          .finally(() => {
            if (active) setLoading(false);
          });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refresh = useCallback(async () => {
    if (session?.user) {
      await loadProfile(session.user.id, session.user.email, session.user.user_metadata);
    }
  }, [session?.user, loadProfile]);

  return { session, user: session?.user ?? null, profile, loading, signOut, refresh };
}
