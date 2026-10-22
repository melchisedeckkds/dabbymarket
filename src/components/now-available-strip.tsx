import { Link } from "react-router-dom";
import { Camera, Store } from "lucide-react";
import { useNowAvailable } from "@/lib/availability-queries";
import { useDt } from "@/lib/availability-i18n";
import { AvailabilityBadge, FreshnessText } from "./availability-badge";
import { STATUS_COLOR, formatXAF, type EffectiveStatus } from "@/lib/availability";

/**
 * « Disponible maintenant » — articles EN STOCK avec photo réelle, confirmés
 * par leur boutique. Mise en forme dédiée (visuel plein cadre, bandeau de
 * statut coloré, prix en bandeau) pour les distinguer des annonces classiques.
 * Un statut périmé ou contesté n'apparaît jamais ici (filtré à la source).
 */
export function NowAvailableStrip({ q = "" }: { q?: string }) {
  const dt = useDt();
  const { data: items = [] } = useNowAvailable();
  const needle = q.trim().toLowerCase();
  const list = needle ? items.filter((i) => `${i.name} ${i.shop_name}`.toLowerCase().includes(needle)) : items;
  if (list.length === 0) return null;

  return (
    <section>
      <div className="mb-1 flex items-center gap-1.5">
        <Camera size={15} className="text-primary" />
        <h2 className="text-sm font-bold">{dt("mk_nowTitle")}</h2>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">{dt("mk_nowSub")}</p>
      <div className="flex snap-x-rail gap-3 overflow-x-auto pb-1 no-scrollbar">
        {list.map((it) => {
          const color = STATUS_COLOR[it.effective_status as EffectiveStatus] ?? STATUS_COLOR.unknown;
          return (
            <article key={it.product_id} className="w-44 shrink-0 snap-start overflow-hidden rounded-2xl border-2 bg-card" style={{ borderColor: color }}>
              <Link to={`/boutique/${it.shop_id}`} className="relative block aspect-square bg-accent">
                <img src={it.image} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute left-2 top-2"><AvailabilityBadge status={it.effective_status} compact /></span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-8">
                  <span className="block truncate text-xs font-bold text-white">{it.name}</span>
                  <span className="block text-sm font-extrabold text-[#f2d675]">{formatXAF(it.price_xaf)}{it.sale_unit ? ` / ${it.sale_unit}` : ""}</span>
                </span>
              </Link>
              <div className="space-y-1 p-2.5">
                <p className="flex items-center gap-1 text-[11px] font-semibold"><Store size={11} className="shrink-0 text-primary" /><span className="truncate">{it.shop_name}</span></p>
                <FreshnessText confirmedAt={it.confirmed_at} status={it.effective_status} />
                <Link to={`/boutique/${it.shop_id}`} className="block rounded-lg border border-border py-1.5 text-center text-[11px] font-semibold">{dt("mk_viewShop")}</Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
