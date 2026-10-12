import { useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useDt } from "@/lib/availability-i18n";
import { useCreateAlert, useDeleteAlert, useMyAlerts } from "@/lib/availability-queries";
import { GuestPrompt } from "./guest-prompt";
import { cn } from "@/lib/utils";

/** « M'avertir au retour en stock » pour un article précis (bascule alerte active / inactive). */
export function ProductAlertButton({ productId, className }: { productId: string; className?: string }) {
  const dt = useDt();
  const { session } = useAuth();
  const { data: alerts = [] } = useMyAlerts();
  const create = useCreateAlert();
  const del = useDeleteAlert();
  const [guest, setGuest] = useState(false);
  const existing = alerts.find((a) => a.kind === "product" && a.product_id === productId);
  const busy = create.isPending || del.isPending;

  async function toggle() {
    if (!session) return setGuest(true);
    try {
      if (existing) await del.mutateAsync(existing.id);
      else {
        await create.mutateAsync({ kind: "product", productId });
        toast.success(dt("map_alertCreated"), { description: dt("map_alertCreatedDesc") });
      }
    } catch (e: any) {
      toast.error(dt("c_error"), { description: e.message });
    }
  }

  return (
    <>
      <button
        onClick={toggle}
        disabled={busy}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
          existing ? "border-primary bg-primary/10 text-primary" : "border-border bg-background",
          className,
        )}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : existing ? <BellRing size={13} /> : <Bell size={13} />}
        {existing ? dt("shop_alertOn") : dt("shop_notifyMe")}
      </button>
      <GuestPrompt open={guest} onClose={() => setGuest(false)} />
    </>
  );
}

/** Alerte sur une recherche (produit de référence si reconnu, sinon texte), avec prix max et quartier facultatifs. */
export function SearchAlertButton({
  query, catalogItemId, maxPrice, neighborhood, city, className,
}: { query: string; catalogItemId?: string | null; maxPrice?: number | null; neighborhood?: string | null; city?: string | null; className?: string }) {
  const dt = useDt();
  const { session } = useAuth();
  const create = useCreateAlert();
  const [guest, setGuest] = useState(false);

  async function go() {
    if (!session) return setGuest(true);
    try {
      await create.mutateAsync(
        catalogItemId
          ? { kind: "catalog_item", catalogItemId, maxPrice, neighborhood, city }
          : { kind: "search", query: query.trim(), maxPrice, neighborhood, city },
      );
      toast.success(dt("map_alertCreated"), { description: dt("map_alertCreatedDesc") });
    } catch (e: any) {
      toast.error(dt("c_error"), { description: e.message });
    }
  }

  return (
    <>
      <button
        onClick={go}
        disabled={create.isPending || query.trim().length < 2}
        className={cn("inline-flex items-center justify-center gap-1.5 rounded-xl gold-gradient px-4 py-2.5 text-xs font-bold disabled:opacity-40", className)}
      >
        {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />} {dt("map_alertMe")}
      </button>
      <GuestPrompt open={guest} onClose={() => setGuest(false)} />
    </>
  );
}
