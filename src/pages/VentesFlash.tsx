import { Link } from "react-router-dom";
import { ArrowLeft, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FlashCard } from "@/components/flash-card";
import { useFlashListings } from "@/lib/queries";
import { useApp } from "@/lib/app-store";

export default function VentesFlashPage() {
  const { t } = useApp();
  const { data: listings = [], isLoading } = useFlashListings();
  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-card" aria-label="Retour"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-lg font-bold">⚡ {t("flash_pageTitle")}</h1>
          <p className="text-[11px] text-muted-foreground">{t("flash_pageSubtitle")}</p>
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-card" />)}</div>
        ) : listings.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("flash_pageEmpty")}</p>
            <Link to="/vendre-rapidement" className="inline-flex items-center gap-1.5 rounded-xl gold-gradient px-4 py-2.5 text-sm font-bold"><Zap size={14} /> {t("flash_publishCta")}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">{listings.map((f: any) => <FlashCard key={f.id} listing={f} />)}</div>
        )}
      </div>
    </AppShell>
  );
}
