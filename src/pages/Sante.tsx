import { useState } from "react";
import { Link } from "react-router-dom";
import { HeartPulse, ShieldCheck, Navigation, Siren, Clock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CatalogResultCard } from "@/components/catalog-result-card";
import { Stars } from "@/components/trust-badges";
import { useV2, type V2Key } from "@/lib/v2-i18n";
import { useHealthFacilities, useCatalogSearch, recordInteraction, useShopTrust } from "@/lib/v2-queries";
import { cn } from "@/lib/utils";

const TYPES = ["pharmacie", "hopital", "centre_sante", "laboratoire", "imagerie", "cabinet", "autre"] as const;

function FacilityCard({ f }: { f: any }) {
  const v = useV2();
  const { data: trust } = useShopTrust(f.shop_id);
  const dest = f.lat != null && f.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}` : null;
  return (
    <article className="space-y-1.5 rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/boutique/${f.shop_id}`} className="min-w-0">
          <h3 className="truncate text-sm font-bold">{f.name}</h3>
          <p className="text-[11px] text-muted-foreground">{v(`hl_type_${f.facility_type}` as V2Key)} · {[f.neighborhood, f.city].filter(Boolean).join(", ")}</p>
        </Link>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
          <ShieldCheck size={11} /> {v("hl_verified")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {f.on_duty_now && <span className="inline-flex items-center gap-1 rounded-full gold-gradient px-2 py-0.5 text-[10px] font-bold"><Clock size={10} /> {v("hl_on_duty")}</span>}
        {trust?.avg != null && <span className="inline-flex items-center gap-1 text-[11px] font-semibold"><Stars value={trust.avg} size={12} /> {trust.avg.toFixed(1)}</span>}
      </div>
      {f.landmark && <p className="text-[11px] text-muted-foreground">{f.landmark}</p>}
      {dest && (
        <a href={dest} target="_blank" rel="noreferrer" onClick={() => recordInteraction(f.shop_id, null, "route")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold">
          <Navigation size={13} /> {v("hl_route")}
        </a>
      )}
    </article>
  );
}

export default function SantePage() {
  const v = useV2();
  const [tab, setTab] = useState<"places" | "offers">("places");
  const [type, setType] = useState<string | null>(null);
  const [dutyOnly, setDutyOnly] = useState(false);
  const { data: facilities = [], isLoading } = useHealthFacilities();
  const offers = useCatalogSearch({ category: "sante" }, tab === "offers");
  const list = facilities.filter((f) => (!type || f.facility_type === type) && (!dutyOnly || f.on_duty_now));
  const rows = offers.data?.pages.flat() ?? [];

  return (
    <AppShell>
      <div className="space-y-3 px-4 pt-3">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl gold-gradient"><HeartPulse size={19} /></span>
          <div>
            <h1 className="text-base font-bold leading-tight">{v("hl_title")}</h1>
            <p className="text-[11px] text-muted-foreground">{v("hl_intro")}</p>
          </div>
        </div>
        <div role="note" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-[12px] font-medium text-destructive">
          <Siren size={16} className="mt-0.5 shrink-0" /> <p>{v("hl_emergency")}</p>
        </div>
        <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs font-semibold">
          {(["places", "offers"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={cn("rounded-full px-3 py-1.5", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {k === "places" ? v("hl_verified") : v("hl_offers")}
            </button>
          ))}
        </div>
      </div>

      {tab === "places" ? (
        <div className="mt-3 space-y-3 px-4">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button onClick={() => setDutyOnly(!dutyOnly)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold", dutyOnly ? "border-primary bg-primary/10 text-primary" : "border-border")}>{v("hl_on_duty")}</button>
            {TYPES.map((t) => (
              <button key={t} onClick={() => setType(type === t ? null : t)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold", type === t ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                {v(`hl_type_${t}` as V2Key)}
              </button>
            ))}
          </div>
          {isLoading ? <div className="h-32 animate-pulse rounded-2xl bg-card" /> : list.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{v("hl_none")}</p> : list.map((f) => <FacilityCard key={f.shop_id} f={f} />)}
        </div>
      ) : (
        <div className="mt-3 space-y-2.5 px-4">
          {rows.length === 0 && !offers.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">{v("hl_no_offers")}</p>}
          {rows.map((r) => <CatalogResultCard key={r.product_id} row={r} />)}
          {offers.hasNextPage && <button onClick={() => offers.fetchNextPage()} className="w-full rounded-xl border border-border py-2 text-xs font-semibold">{v("sr_load_more")}</button>}
        </div>
      )}
    </AppShell>
  );
}
