import { Star, ShieldCheck, ShieldAlert, Award } from "lucide-react";
import { useV2 } from "@/lib/v2-i18n";
import { useShopTrust, useContributorBadge, type ShopTrust } from "@/lib/v2-queries";
import { cn } from "@/lib/utils";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/40"} />
      ))}
    </span>
  );
}

const REL_STYLE: Record<ShopTrust["reliability"], string> = {
  normal: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  watch: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  unreliable: "border-destructive/40 bg-destructive/10 text-destructive",
  boost_suspended: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function ReliabilityBadge({ status }: { status: ShopTrust["reliability"] }) {
  const v = useV2();
  const label = { normal: v("tr_rel_normal"), watch: v("tr_rel_watch"), unreliable: v("tr_rel_unreliable"), boost_suspended: v("tr_rel_boost_suspended") }[status];
  const Icon = status === "normal" ? ShieldCheck : ShieldAlert;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", REL_STYLE[status])}>
      <Icon size={11} /> {label}
    </span>
  );
}

/** Résumé de confiance d'une boutique : note, exactitude, fiabilité. Trois indicateurs séparés, jamais fusionnés. */
export function ShopTrustSummary({ shopId, compact }: { shopId: string; compact?: boolean }) {
  const v = useV2();
  const { data } = useShopTrust(shopId);
  if (!data) return null;
  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      <div className="flex flex-wrap items-center gap-2">
        {data.avg != null ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <Stars value={data.avg} /> {data.avg.toFixed(1)} <span className="font-normal text-muted-foreground">({v("tr_rating_count", { n: data.ratingsCount })})</span>
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">{v("tr_rating_none")}</span>
        )}
        {data.reliability !== "normal" && <ReliabilityBadge status={data.reliability} />}
      </div>
      {!compact && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{v("tr_exactness")} : </span>
          {data.accuracyPct != null ? v("tr_exactness_hint", { pct: Math.round(data.accuracyPct), n: data.reports90d }) : v("tr_exactness_none")}
        </p>
      )}
      {!compact && data.reliability === "watch" && <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700">{v("tr_rel_hint_watch")}</p>}
      {!compact && (data.reliability === "unreliable" || data.reliability === "boost_suspended") && (
        <p className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">{v("tr_rel_hint_unreliable")}</p>
      )}
    </div>
  );
}

export function ContributorBadge({ userId }: { userId: string | undefined }) {
  const v = useV2();
  const { data } = useContributorBadge(userId);
  if (!data || data.level === "none") return null;
  const label = { bronze: v("tr_badge_bronze"), silver: v("tr_badge_silver"), gold: v("tr_badge_gold") }[data.level];
  const color = { bronze: "#b87333", silver: "#9aa0a6", gold: "#d4a017" }[data.level];
  return (
    <span title={v("tr_badge_hint")} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: `${color}66`, background: `${color}1f`, color }}>
      <Award size={11} /> {label}
    </span>
  );
}
