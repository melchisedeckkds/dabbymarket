import { useState } from "react";
import { Link } from "react-router-dom";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { useMt, type MtKey } from "@/lib/dabbymap-i18n";
import { CATEGORY_CODES, CATEGORY_EMOJI, useContribute } from "@/lib/dabbymap";

type Pt = { lat: number; lng: number };

export function LandmarkAddSheet({ userLocation, mapCenter, onClose }: {
  userLocation: Pt | null;
  mapCenter: Pt | null;
  onClose: () => void;
}) {
  const mt = useMt();
  const { session } = useAuth();
  const contribute = useContribute();
  const [source, setSource] = useState<"me" | "center">(userLocation ? "me" : "center");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("autre");
  const [hint, setHint] = useState("");
  useEscapeToClose(true, onClose);

  const pt = source === "me" ? userLocation : mapCenter;

  async function submit() {
    if (!pt) return;
    try {
      const changes: Record<string, unknown> = { name: name.trim(), category_code: category, lat: Number(pt.lat.toFixed(6)), lng: Number(pt.lng.toFixed(6)) };
      if (hint.trim()) changes.access_hint = hint.trim();
      const outcome = await contribute.mutateAsync({ type: "create", changes });
      toast.success(outcome === "approved" ? mt("lm_publishedNow") : mt("lm_pendingReview"));
      onClose();
    } catch (e: any) { toast.error(mt("lm_error"), { description: e?.message }); }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-[520] max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">{mt("lm_add")}</h2>
        <button onClick={onClose} aria-label={mt("lm_close")} className="grid h-8 w-8 place-items-center rounded-full bg-accent"><X size={16} /></button>
      </div>
      {!session ? (
        <p className="rounded-xl bg-accent p-3 text-sm text-muted-foreground">
          {mt("lm_loginNeeded")} <Link to="/auth" className="font-bold text-primary underline">{mt("lm_login")}</Link>
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold">{mt("lm_position")}</p>
            <div className="grid grid-cols-2 gap-2">
              {([["me", "lm_myPosition", !!userLocation], ["center", "lm_mapCenter", !!mapCenter]] as const).map(([k, label, ok]) => (
                <button key={k} disabled={!ok} onClick={() => setSource(k)}
                  className={cn("rounded-xl border py-2 text-xs font-bold disabled:opacity-40", source === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
                  {mt(label)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold">{mt("lm_name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold">{mt("lm_category")}</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_CODES.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", category === c ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
                  {CATEGORY_EMOJI[c]} {mt(`cat_${c}` as MtKey)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold">{mt("lm_hint")}</label>
            <textarea value={hint} onChange={(e) => setHint(e.target.value)} maxLength={300} rows={2} placeholder={mt("lm_hintPlaceholder")}
              className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onClose} className="rounded-xl border border-border py-2.5 text-sm font-semibold">{mt("lm_cancel")}</button>
            <button onClick={submit} disabled={contribute.isPending || name.trim().length < 2 || !pt}
              className="flex items-center justify-center gap-2 rounded-xl gold-gradient py-2.5 text-sm font-bold disabled:opacity-50">
              {contribute.isPending && <Loader2 size={14} className="animate-spin" />} {mt("lm_send")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
