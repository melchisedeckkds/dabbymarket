import { Link } from "react-router-dom";
import { MapPin, BadgeCheck } from "lucide-react";
import { AvailabilityBadge, FreshnessText } from "@/components/availability-badge";
import { SponsoredBadge } from "@/components/sponsored-badge";
import { useV2 } from "@/lib/v2-i18n";
import { formatXAF } from "@/lib/availability";
import type { CatalogRow } from "@/lib/v2-queries";

/** Carte de résultat de recherche : montre toujours l'état réel de disponibilité, jamais un article « caché ». */
export function CatalogResultCard({ row }: { row: CatalogRow }) {
  const v = useV2();
  const photo = row.images?.[0];
  return (
    <Link to={`/produit/${row.product_id}`} className="flex gap-3 rounded-2xl border border-border bg-card p-2.5">
      <span className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-accent">
        {photo ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-xl">📦</span>}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-semibold">{row.name}</span>
          {row.sponsored && <SponsoredBadge />}
        </span>
        <span className="block text-sm font-bold text-primary">{row.price_xaf != null ? formatXAF(row.price_xaf) : <span className="text-xs font-medium text-muted-foreground">{v("sr_price_in_shop")}</span>}</span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="truncate">{row.shop_name}</span>
          {row.shop_verified && <BadgeCheck size={12} className="shrink-0 text-primary" />}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <AvailabilityBadge status={row.effective_status} compact />
          {(row.neighborhood || row.distance_km != null) && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <MapPin size={10} /> {row.neighborhood}
              {row.distance_km != null && ` · ${v("sr_distance", { km: row.distance_km.toFixed(1) })}`}
            </span>
          )}
        </span>
        <FreshnessText confirmedAt={row.confirmed_at} status={row.effective_status} />
      </span>
    </Link>
  );
}
