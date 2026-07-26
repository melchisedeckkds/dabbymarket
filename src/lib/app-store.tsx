import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useUnreadCount } from "./queries";
import { translations, type Lang, type TranslationKey } from "./i18n";

// Petites préférences transverses (thème, langue, mode données réduites) —
// stockées localement par appareil, ce ne sont pas des données partagées
// entre utilisateurs donc pas besoin de Supabase ici.
type AppContextValue = {
  theme: "dark" | "light";
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
  unreadCount: number;
  dataSaver: boolean;
  toggleDataSaver: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("dm-theme") as "dark" | "light") || "dark");
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("dm-lang") as Lang) || "fr");
  const [dataSaver, setDataSaver] = useState<boolean>(() => localStorage.getItem("dm-data-saver") !== "0");
  const { data: unreadCount = 0 } = useUnreadCount();

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
    localStorage.setItem("dm-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("dm-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    // Lu directement par compressImage() (src/lib/image.ts) via localStorage,
    // pas besoin de faire circuler cette préférence par props partout.
    localStorage.setItem("dm-data-saver", dataSaver ? "1" : "0");
  }, [dataSaver]);

  // Le décompte précis (messages réellement non lus) vient désormais de
  // useUnreadCount(), basé sur la fonction SQL unread_messages_count().

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }
  function setLang(l: Lang) {
    setLangState(l);
  }
  function toggleDataSaver() {
    setDataSaver((d) => !d);
  }

  const t = useCallback((key: TranslationKey) => translations[lang][key] ?? translations.fr[key] ?? key, [lang]);

  return (
    <AppContext.Provider value={{ theme, toggleTheme, lang, setLang, t, unreadCount, dataSaver, toggleDataSaver }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp doit être utilisé à l'intérieur de <AppProvider>");
  return ctx;
}