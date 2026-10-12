import { Link } from "react-router-dom";
import { Gem, Star, MapPin } from "lucide-react";
import { useTrouvailles } from "@/lib/availability-queries";
import { useCategoryLabel } from "@/lib/availability-queries";
import { useDt } from "@/lib/availability-i18n";
import { useApp } from "@/lib/app-store";
import { AvailabilityBadge, FreshnessText } from "./availability-badge";
import { formatXAF } from "@/lib/availability";

/**
 * « Les Trouvailles » — articles appréciés, classés par note bayésienne
 * (un seul avis parfait ne passe pas devant 150 avis à 4,8), avec leur
 * disponibilité RÉELLE affichée. (Nommé « Trouvailles » et non « Pépites »
 * car « Pépites » désigne déjà la monnaie virtuelle de l'application.)
 */
export function TrouvaillesStrip() {
  const dt = useDt();
  useApp();
  const { data: items = [] } = useTrouvailles();
  const catLabel = useCategoryLabel();
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-1 flex items-center gap-1.5">
        <Gem size={15} className="text-primary" />
        <h2 className="text-sm font-bold">{dt("tv_title")}</h2>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">{dt("tv_sub")}</p>
      <div className="flex snap-x-rail gap-3 overflow-x-auto pb-1 no-scrollbar">
        {items.map((it) => (
          <article key={it.product_id} className="w-60 shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card">
            <Link to={`/produit/${it.product_id}`} className="relative block aspect-[4/3] bg-accent">
              {it.image ? <img src={it.image} alt={it.product_name} className="h-full w-full object-cover" loading="lazy" /> : <span className="absolute inset-0 grid place-items-center text-3xl">🛍️</span>}
              <span className="absolute left-2 top-2"><AvailabilityBadge status={it.effective_status} /></span>
            </Link>
            <div className="space-y-1 p-3">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/produit/${it.product_id}`} className="line-clamp-1 text-sm font-semibold">{it.product_name}</Link>
                <span className="shrink-0 text-sm font-bold text-primary">{formatXAF(it.price_xaf)}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star size={11} className="fill-primary text-primary" /> <span className="font-semibold text-foreground">{Number(it.rating_avg).toFixed(1)}</span> ({it.rating_count}) · {catLabel(it.category)}
              </div>
              {it.sample_comment && <p className="line-clamp-2 text-[11px] italic text-muted-foreground">« {it.sample_comment} »{it.sample_author ? ` — ${it.sample_author}` : ""}</p>}
              <p className="flex items-center gap-1 text-[11px]"><MapPin size={11} className="shrink-0 text-primary" /><span className="truncate">{it.shop_name}{it.neighborhood ? ` · ${it.neighborhood}` : ""}</span></p>
              <FreshnessText confirmedAt={it.confirmed_at} status={it.effective_status} />
              <div className="flex gap-2 pt-1">
                <Link to={`/boutique/${it.shop_id}`} className="flex-1 rounded-lg border border-border py-1.5 text-center text-[11px] font-semibold">{dt("tv_viewShop")}</Link>
                {it.lat != null && it.lng != null && (
                  <Link to={`/carte?lat=${it.lat}&lng=${it.lng}`} className="flex-1 rounded-lg border border-border py-1.5 text-center text-[11px] font-semibold">{dt("tv_viewMap")}</Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
