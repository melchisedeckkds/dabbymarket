import { useEffect, useState } from "react";
import { Store, Map as MapIcon, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/app-store";
import { Pepite } from "./pepite";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import type { TranslationKey } from "@/lib/i18n";

const STORAGE_KEY = "dm-onboarding-seen";

type Step = { icon: React.ComponentType<{ size?: number }>; titleKey: TranslationKey; descKey: TranslationKey };

const STEPS: Step[] = [
  { icon: Store, titleKey: "onboarding_marcheTitle", descKey: "onboarding_marcheDesc" },
  { icon: MapIcon, titleKey: "onboarding_carteTitle", descKey: "onboarding_carteDesc" },
  { icon: ShieldCheck, titleKey: "onboarding_guardTitle", descKey: "onboarding_guardDesc" },
  { icon: Pepite as unknown as React.ComponentType<{ size?: number }>, titleKey: "onboarding_pepitesTitle", descKey: "onboarding_pepitesDesc" },
];

export function OnboardingTour() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Petit délai pour laisser l'écran principal s'afficher avant la visite guidée
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  useEscapeToClose(open, finish);

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm" onClick={finish}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-primary/30 bg-card p-6 shadow-2xl"
      >
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="mt-5 text-center"
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gold-gradient shine shadow-lg shadow-primary/30">
              <Icon size={28} />
            </div>
            <h2 className="mt-4 text-lg font-bold">{t(current.titleKey)}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(current.descKey)}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              aria-label={t("common_back")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background text-foreground"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <button onClick={finish} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-muted-foreground">
            {t("onboarding_skip")}
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl gold-gradient py-2.5 text-sm font-bold shine"
          >
            {isLast ? t("onboarding_finish") : t("onboarding_next")}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
