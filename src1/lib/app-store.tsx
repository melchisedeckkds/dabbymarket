import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useUnreadCount } from "./queries";
import { translations, type Lang, type TranslationKey } from "./i18n";

// Petites préférences transverses (thème, langue) — stockées localement par
// appareil, ce ne sont pas des données partagées entre utilisateurs donc
// pas besoin de Supabase ici.
type AppContextValue = {
  theme: "dark" | "light";
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
  unreadCount: number;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("dm-theme") as "dark" | "light") || "dark");
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("dm-lang") as Lang) || "fr");
  const { data: unreadCount = 0 } = useUnreadCount();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("dm-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("dm-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // Le décompte précis (messages réellement non lus) vient désormais de
  // useUnreadCount(), basé sur la fonction SQL unread_messages_count().

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }
  function setLang(l: Lang) {
    setLangState(l);
  }

  const t = useCallback((key: TranslationKey) => translations[lang][key] ?? translations.fr[key] ?? key, [lang]);

  return (
    <AppContext.Provider value={{ theme, toggleTheme, lang, setLang, t, unreadCount }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp doit être utilisé à l'intérieur de <AppProvider>");
  return ctx;
}
