import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// NOTE IMPORTANTE — choix d'authentification :
// Une vraie vérification par SMS (OTP) a un coût par message chez tous les
// fournisseurs (Twilio, Vonage...) et nécessite de configurer un provider
// dans Supabase Auth. Pour rester 100% gratuit au démarrage, on utilise le
// numéro de téléphone comme identifiant mais on l'enregistre techniquement
// comme un compte email/mot de passe (email fictif dérivé du numéro).
// L'utilisateur ne voit jamais cette astuce : il tape juste son numéro et
// un mot de passe. Le jour où tu configures un fournisseur SMS payant dans
// Supabase, on pourra basculer vers un vrai OTP sans changer l'écran de
// connexion.
function phoneToInternalEmail(phone: string) {
  const clean = phone.replace(/[^0-9+]/g, "");
  return `${clean.replace("+", "")}@dabbymarket.app`;
}

export type Profile = {
  id: string;
  phone: string;
  name: string;
  avatar_url: string | null;
  pepites_balance: number;
  is_admin: boolean;
  created_at: string;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (phone: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!error) setProfile(data as Profile);
  }

  async function refreshProfile() {
    if (session?.user?.id) await loadProfile(session.user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user?.id) loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) loadProfile(newSession.user.id);
      else setProfile(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Recharge en temps réel le profil (solde de Pépites) dès qu'il change côté serveur
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`profile-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${session.user.id}` },
        (payload) => setProfile(payload.new as Profile),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  async function signUp(phone: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email: phoneToInternalEmail(phone),
      password,
      options: { data: { name, phone } },
    });
    if (error) return { error: error.message };
    if (data.session){
      setSession(data.session);
      if(data.session.user?.id) await loadProfile(data.session.user.id);
    }
    // Le profil est créé automatiquement par le trigger SQL handle_new_user()
    return { error: null };
  }

  async function signIn(phone: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: phoneToInternalEmail(phone),
      password,
    });
    if (error) return { error: error.message };
    if (data.session){
      setSession(data.session);
      if(data.session.user?.id) await loadProfile(data.session.user.id);
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>");
  return ctx;
}
