import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";

export function GuestPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useApp();
  useEscapeToClose(open, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[800] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-primary/30 bg-card p-6 text-center shadow-2xl"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gold-gradient shine shadow-lg shadow-primary/30">
          <LogIn size={24} />
        </div>
        <h2 className="mt-4 text-lg font-bold">{t("guest_title")}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("guest_desc")}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold">
            {t("common_cancel")}
          </button>
          <Link to="/auth" className="flex flex-1 items-center justify-center rounded-xl gold-gradient py-2.5 text-sm font-bold shine">
            {t("guest_cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Petit utilitaire : renvoie true si l'action peut continuer, sinon ouvre le rappel et renvoie false. */
export function useGuestGate(session: unknown, setShowPrompt: (v: boolean) => void) {
  return () => {
    if (!session) {
      setShowPrompt(true);
      return false;
    }
    return true;
  };
}
