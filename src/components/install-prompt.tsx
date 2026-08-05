import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { Logo } from "./logo";

const INSTALLED_KEY = "dm-installed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * S'affiche à CHAQUE chargement du site (visiteur ou connecté) tant que
 * l'application n'est pas réellement installée. La fermeture (X ou "Plus
 * tard") ne masque la fenêtre que pour la session en cours — elle
 * réapparaîtra au prochain chargement, comme demandé.
 */
export function InstallPrompt() {
  const { t } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1") return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      localStorage.setItem(INSTALLED_KEY, "1");
      setOpen(false);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const timer = setTimeout(() => setOpen(true), 1200);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(timer);
    };
  }, []);

  if (isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1") return null;
  if (!open || dismissedThisSession) return null;

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") localStorage.setItem(INSTALLED_KEY, "1");
      setDeferredPrompt(null);
      setOpen(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[950] flex items-end justify-center bg-background/80 p-3 pb-20 backdrop-blur-sm sm:items-center sm:pb-3"
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-primary/30 bg-card p-5 text-center shadow-2xl"
        >
          <button
            onClick={() => setDismissedThisSession(true)}
            aria-label={t("common_close")}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-accent text-muted-foreground"
          >
            <X size={14} />
          </button>

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gold-gradient shine shadow-lg shadow-primary/30"
          >
            <Logo size={36} />
          </motion.div>

          <h2 className="mt-4 text-lg font-bold">{t("install_title")}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("install_desc")}</p>

          {isIOS() && !deferredPrompt ? (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
              <Share size={15} className="shrink-0 text-primary" />
              {t("install_iosHint")}
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl gold-gradient shine py-3 text-sm font-bold"
            >
              <Download size={16} /> {t("install_installBtn")}
            </button>
          )}

          <button onClick={() => setDismissedThisSession(true)} className="mt-3 text-xs font-semibold text-muted-foreground">
            {t("install_later")}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
