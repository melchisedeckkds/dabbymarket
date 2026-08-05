import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogIn, Store, ImagePlus, Package, MessageCircle, Map as MapIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import type { TranslationKey } from "@/lib/i18n";

const DURATION_MS = 30_000;
const FIRST_DELAY_MS = 8_000;
const GAP_BETWEEN_MS = 45_000;
const DISMISS_KEY = "dm-engage-dismissed"; // "1" = l'utilisateur a demandé à ne plus les voir (session)

type Prompt = {
  id: string;
  icon: React.ComponentType<{ size?: number }>;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  ctaKey: TranslationKey;
  to: string;
  requiresGuest?: boolean; // ne s'affiche que si non connecté
  requiresAuth?: boolean; // ne s'affiche que si connecté
};

const PROMPTS: Prompt[] = [
  { id: "login", icon: LogIn, titleKey: "engage_loginTitle", descKey: "engage_loginDesc", ctaKey: "engage_loginCta", to: "/auth", requiresGuest: true },
  { id: "shop", icon: Store, titleKey: "engage_shopTitle", descKey: "engage_shopDesc", ctaKey: "engage_shopCta", to: "/creer-boutique", requiresAuth: true },
  { id: "post", icon: ImagePlus, titleKey: "engage_postTitle", descKey: "engage_postDesc", ctaKey: "engage_postCta", to: "/publier?type=post", requiresAuth: true },
  { id: "article", icon: Package, titleKey: "engage_articleTitle", descKey: "engage_articleDesc", ctaKey: "engage_articleCta", to: "/publier", requiresAuth: true },
  { id: "messages", icon: MessageCircle, titleKey: "engage_messagesTitle", descKey: "engage_messagesDesc", ctaKey: "engage_messagesCta", to: "/messages", requiresAuth: true },
  { id: "map", icon: MapIcon, titleKey: "engage_mapTitle", descKey: "engage_mapDesc", ctaKey: "engage_mapCta", to: "/carte" },
];

/**
 * Rotation de petites fenêtres incitatives, façon Dabby Secret's : discrètes,
 * jamais bloquantes, disparaissent seules après 30s ou peuvent être fermées
 * à tout moment, et pointent vers l'endroit exact de la fonctionnalité
 * (ancrées en bas de l'écran, au-dessus de la barre de navigation).
 */
export function EngagementPopups() {
  const { t } = useApp();
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [current, setCurrent] = useState<Prompt | null>(null);
  const [cursor, setCursor] = useState(0);
  const [mutedForSession, setMutedForSession] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  const eligible = PROMPTS.filter((p) => (p.requiresGuest ? !session : true) && (p.requiresAuth ? !!session : true));

  useEffect(() => {
    if (mutedForSession || eligible.length === 0) return;
    if (location.pathname === "/auth") return;

    let hideTimer: ReturnType<typeof setTimeout>;
    let nextTimer: ReturnType<typeof setTimeout>;

    function show() {
      const prompt = eligible[cursor % eligible.length];
      setCurrent(prompt);
      hideTimer = setTimeout(() => {
        setCurrent(null);
        nextTimer = setTimeout(() => setCursor((c) => c + 1), GAP_BETWEEN_MS);
      }, DURATION_MS);
    }

    const firstTimer = setTimeout(show, cursor === 0 ? FIRST_DELAY_MS : 0);
    return () => {
      clearTimeout(firstTimer);
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, mutedForSession, session, location.pathname]);

  function dismiss() {
    setCurrent(null);
  }

  function muteForSession() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setMutedForSession(true);
    setCurrent(null);
  }

  function act() {
    if (!current) return;
    navigate(current.to);
    setCurrent(null);
  }

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.92, transition: { duration: 0.2 } }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="fixed inset-x-3 bottom-20 z-[500] mx-auto max-w-sm rounded-2xl border border-primary/30 bg-card/95 p-3.5 shadow-2xl shadow-primary/10 backdrop-blur lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0"
        >
          <div className="flex items-start gap-3">
            <motion.div
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2 }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gold-gradient shine"
            >
              <current.icon size={18} />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{t(current.titleKey)}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t(current.descKey)}</p>
            </div>
            <button onClick={dismiss} aria-label={t("common_close")} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground">
              <X size={13} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={act} className="flex-1 rounded-xl gold-gradient py-2 text-xs font-bold">
              {t(current.ctaKey)}
            </button>
            <button onClick={muteForSession} className="rounded-xl border border-border px-2.5 py-2 text-[10px] font-semibold text-muted-foreground">
              {t("engage_dismiss")}
            </button>
          </div>
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: DURATION_MS / 1000, ease: "linear" }}
            style={{ transformOrigin: "left" }}
            className="mt-3 h-0.5 rounded-full bg-primary/40"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
