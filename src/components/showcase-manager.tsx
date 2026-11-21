import { Sparkles, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { useV2 } from "@/lib/v2-i18n";
import { useProducts, useAppConfig } from "@/lib/queries";
import { useShowcaseUsage, useSetShowcase, useBuyShowcaseSlot } from "@/lib/v2-queries";
import { useAuth } from "@/lib/auth";

/** « Ma vitrine » : choisir quels articles s'affichent sur le Marché ; les autres restent dans le catalogue (trouvables par la recherche). */
export function ShowcaseManager({ shopId, isHealth }: { shopId: string; isHealth?: boolean }) {
  const v = useV2();
  const { refreshProfile } = useAuth();
  const { data: usage } = useShowcaseUsage(shopId);
  const { data: products = [] } = useProducts(shopId);
  const { data: cfg } = useAppConfig();
  const setShowcase = useSetShowcase(shopId);
  const buy = useBuyShowcaseSlot(shopId);

  if (isHealth) return <p className="rounded-xl bg-accent px-3 py-2 text-xs text-muted-foreground">{v("vit_health_na")}</p>;

  const items = (products as any[]).filter((p) => p.is_active && p.listing_kind !== "stock");
  const full = !!usage && usage.showcased >= usage.showcase_limit;
  const price = Number((cfg as any)?.showcase_slot_price_pepites ?? 30);
  const days = Number((cfg as any)?.showcase_slot_days ?? 30);

  async function toggle(id: string, on: boolean) {
    try { await setShowcase.mutateAsync({ productId: id, on }); } catch (e: any) { toast.error(e.message ?? v("common_error")); }
  }
  async function purchase() {
    try { await buy.mutateAsync(); await refreshProfile(); toast.success(v("vit_buy_ok")); } catch (e: any) { toast.error(e.message ?? v("common_error")); }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <h3 className="text-sm font-bold">{v("vit_title")}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">{v("vit_intro")}</p>
      {usage && (
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{v("vit_usage", { a: usage.showcased, b: usage.showcase_limit })}</span>
          <span className="rounded-full bg-accent px-2.5 py-1">{v("vit_catalog", { a: usage.catalog_items, b: usage.catalog_cap })}</span>
          {usage.next_slot_expiry && <span className="rounded-full bg-accent px-2.5 py-1">{v("vit_expires", { d: new Date(usage.next_slot_expiry).toLocaleDateString() })}</span>}
        </div>
      )}
      {full && <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700">{v("vit_full")}</p>}
      <ul className="divide-y divide-border">
        {items.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-2">
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-accent">{p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{p.name}</span>
              <span className="text-[10px] text-muted-foreground">{p.is_showcased ? v("vit_on") : v("vit_off")}</span>
            </span>
            <button
              onClick={() => toggle(p.id, !p.is_showcased)}
              disabled={setShowcase.isPending || (!p.is_showcased && full)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40"
            >
              {p.is_showcased ? <><Minus size={12} /> {v("vit_take_off")}</> : <><Plus size={12} /> {v("vit_put_on")}</>}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={purchase} disabled={buy.isPending} className="w-full rounded-xl gold-gradient py-2.5 text-xs font-bold disabled:opacity-50">
        {v("vit_buy")} — {v("vit_buy_price", { p: price, d: days })}
      </button>
    </section>
  );
}
