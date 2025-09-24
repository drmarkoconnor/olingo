import { create } from 'zustand';
import { supabase, hasSupabase } from '@/lib/supabase';

type AuthState = {
  userId: string; // supabase uid or local fallback
  email?: string | null;
  loading: boolean;
  error?: string | null;
  ready: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const LOCAL_UID_KEY = 'olingo.localUid';

function getOrCreateLocalUid() {
  let v = localStorage.getItem(LOCAL_UID_KEY);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(LOCAL_UID_KEY, v);
  }
  return v;
}

export const useAuth = create<AuthState>((set) => ({
  userId: getOrCreateLocalUid(),
  email: null,
  loading: false,
  error: null,
  ready: true,
  signInWithGoogle: async () => {
    if (!hasSupabase() || !supabase) return set({ error: 'Supabase not configured' });
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) set({ error: error.message });
    set({ loading: false });
  },
  signOut: async () => {
    if (hasSupabase() && supabase) {
      await supabase.auth.signOut();
    }
    // keep local uid for offline usage
    set({ userId: getOrCreateLocalUid(), email: null });
  },
  refreshSession: async () => {
    if (!hasSupabase() || !supabase) return;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user) {
      set({ userId: session.user.id, email: session.user.email });
    }
  },
}));

// Initialize from current session if available (non-blocking)
if (hasSupabase() && supabase) {
  supabase.auth.getSession().then(({ data }) => {
    const u = data.session?.user;
    if (u) {
      useAuth.setState({ userId: u.id, email: u.email });
    }
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    if (u) useAuth.setState({ userId: u.id, email: u.email });
    else useAuth.setState({ userId: getOrCreateLocalUid(), email: null });
  });
}
