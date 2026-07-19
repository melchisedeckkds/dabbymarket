import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // On ne bloque pas le build, mais on avertit clairement en développement :
  // sans ces deux variables, aucune donnée réelle ne peut être lue/écrite.
  console.warn(
    "[DabbyMarket] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
      "Copie .env.example vers .env et renseigne les valeurs de ton projet Supabase.",
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Database = unknown; // à remplacer par `supabase gen types typescript` une fois le projet créé
