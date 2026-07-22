import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { translations, Lang, TranslationKey } from "./i18n";

type AppContextType = {
  theme: "dark" | "light";
  toggleTheme: () => void;
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  dataSaver: boolean;
  toggleDataSaver: () => void;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // === THÈME : mode JOUR par défaut ===
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("dm-theme") as "dark" | "light";
    return saved || "light"; // ← Changé de "dark" à "light"
  });

  // === LANGUE ===
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem("dm-lang") as Lang) || "fr";
  });

  // === MODE ÉCONOMIE DE DONNÉES ===
  const [dataSaver, setDataSaver] = useState(() => {
    return localStorage.getItem("dm-data-saver") === "true";
  });

  // === COMPTEUR DE MESSAGES NON LUS ===
  const [unreadCount, setUnreadCount] = useState(0);

  // === FONCTIONS ===
  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("dm-theme", newTheme);
    // Applique la classe "dark" sur l'élément <html>
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  }, [theme]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("dm-lang", newLang);
  }, []);

  const toggleDataSaver = useCallback(() => {
    const newValue = !dataSaver;
    setDataSaver(newValue);
    localStorage.setItem("dm-data-saver", String(newValue));
  }, [dataSaver]);

  const t = useCallback((key: TranslationKey) => {
    return translations[lang]?.[key] ?? translations.fr[key] ?? key;
  }, [lang]);

  // === APPLICATION DU THÈME AU CHARGEMENT ===
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    lang,
    setLang,
    t,
    dataSaver,
    toggleDataSaver,
    unreadCount,
    setUnreadCount,
  }), [theme, lang, dataSaver, unreadCount, toggleTheme, setLang, toggleDataSaver, t]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}