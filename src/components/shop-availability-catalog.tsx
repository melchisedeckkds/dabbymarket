import { useState } from "react";
import { Link } from "react-router-dom";
import { Star, Flag, Settings2 } from "lucide-react";
import { useDt } from "@/lib/availability-i18n";
import { useProductRatingsMap, useShopReliability, type ShopProduct } from "@/lib/availability-queries";
import { formatXAF, type EffectiveStatus } from "@/lib/availability";
import { AvailabilityBadge, AvailabilityHint, FreshnessText, ReliabilityChip } from "./availability-badge";
import { AvailabilityReportSheet } from "./availability-report-sheet";
import { ProductAlertButton } from "./alert-button";

const GROUPS: { key: "shop_availableNow" | "shop_limited" | "shop_toReconfirm" | "shop_outNow"; match: EffectiveStatus[] }[] = [
  { key: "shop_availableNow", match: ["available"] },
  { key: "shop_limited", match: ["limited"] },
  { key: "shop_toReconfirm", match: ["to_reconfirm", "contested"] },
  { key: "shop_outNow", match: ["out"] },
];

/** Articles dont la disponibilité a été renseignée, regroupés par état réel (jamais affirmatif si périmé/contesté). */
export function ShopAvailabilityCatalog({ shopId, items, isOwner }: { shopId: string; items: ShopProduct[]; isOwner: boolean }) {
  const dt = useDt();
  const { data: rel } = useShopReliability(shopId);
  const { data: ratings } = useProductRatingsMap(items.map((i) => i.id));
  const [reportFor, setReportFor] = useState<string | null>(null);

  if (items.length === 0) {
    return isOwner ? (
      <Link to="/disponibilite" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-xs font-semibold text-primary">
        <Settings2 size={14} /> {dt("shop_manage")}
      </Link>
    ) : null;
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ReliabilityChip level={rel?.level} />
        {isOwner && (
          <Link to="/disponibilite" className="ml-auto flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
            <Settings2 size={12} /> {dt("shop_manage")}
          </Link>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">{dt("st_not_a_reservation")}</p>

      {GROUPS.map((g) => {
        const list = items.filter((i) => g.match.includes((i.effective_status ?? "unknown") as EffectiveStatus));
        if (list.length === 0) return null;
        return (
          <section key={g.key} className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{dt(g.key)} ({list.length})</h3>
            {list.map((p) => {
              const status = (p.effective_status ?? "unknown") as EffectiveStatus;
              const r = ratings?.get(p.id);
              return (
                <article key={p.id} className="space-y-2 rounded-2xl border border-border bg-card p-3">
                  <Link to={`/produit/${p.id}`} className="flex items-center gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-xl">
                      {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" /> : "🛍️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
                      <p className="text-sm font-bold text-primary">{formatXAF(p.price_xaf)}{p.sale_unit ? <span className="text-[10px] font-normal text-muted-foreground"> / {p.sale_unit}</span> : null}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <AvailabilityBadge status={status} />
                        {r && <span className="flex items-center gap-0.5 text-[11px]"><Star size={11} className="fill-primary text-primary" /> {r.avg.toFixed(1)} ({r.count})</span>}
                      </div>
                    </div>
                  </Link>
                  <FreshnessText confirmedAt={p.confirmed_at ?? p.availability_confirmed_at} status={status} className="block" />
                  {p.sale_conditions && <p className="text-[11px] text-muted-foreground">{p.sale_conditions}</p>}
                  {(p.found_reports ?? 0) > 0 && status !== "out" && <p className="text-[10px] text-[color:var(--verified)]">{dt("st_community_found")}</p>}
                  <AvailabilityHint status={status} />
                  {!isOwner && (
                    <div className="flex gap-2">
                      {(status === "out" || status === "to_reconfirm" || status === "contested") && <ProductAlertButton productId={p.id} className="flex-1" />}
                      <button onClick={() => setReportFor(p.id)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold">
                        <Flag size={12} /> {dt("shop_report")}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
      {reportFor && <AvailabilityReportSheet open onClose={() => setReportFor(null)} productId={reportFor} shopId={shopId} />}
    </div>
  );
}
