import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { useDt, type DtKey } from "@/lib/availability-i18n";
import { STATUS_COLOR, formatAgo, type EffectiveStatus, type ReliabilityLevel } from "@/lib/availability";
import { cn } from "@/lib/utils";

const LABEL: Record<EffectiveStatus, DtKey> = {
  available: "st_available",
  limited: "st_limited",
  to_reconfirm: "st_to_reconfirm",
  contested: "st_contested",
  out: "st_out",
  unknown: "st_unknown",
};

/** Pastille d'état : jamais « disponible » pour une information périmée ou contestée. */
export function AvailabilityBadge({ status, className, compact }: { status: EffectiveStatus | string; className?: string; compact?: boolean }) {
  const dt = useDt();
  const s = (status in LABEL ? status : "unknown") as EffectiveStatus;
  const color = STATUS_COLOR[s];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold", className)}
      style={{ borderColor: `${color}66`, background: `${color}1f`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {compact && s === "contested" ? dt("st_contested").split(" ")[0] : dt(LABEL[s])}
    </span>
  );
}

/** « Déclaré par la boutique — il y a 12 min » (ou « jamais confirmé »). */
export function FreshnessText({ confirmedAt, status, className }: { confirmedAt: string | null | undefined; status?: EffectiveStatus | string; className?: string }) {
  const { lang } = useApp();
  const dt = useDt();
  if (status === "unknown") return null;
  return (
    <span className={cn("text-[10px] text-muted-foreground", className)}>
      {dt("st_declared_by_shop")} · {formatAgo(confirmedAt, lang)}
    </span>
  );
}

export function AvailabilityHint({ status }: { status: EffectiveStatus | string }) {
  const dt = useDt();
  if (status === "to_reconfirm") return <p className="rounded-lg bg-accent px-2.5 py-1.5 text-[11px] text-muted-foreground">{dt("st_to_reconfirm_hint")}</p>;
  if (status === "contested") return <p className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">{dt("st_contested_hint")}</p>;
  return null;
}

export function ReliabilityChip({ level }: { level: ReliabilityLevel | null | undefined }) {
  const dt = useDt();
  if (!level) return null;
  const meta = {
    high: { key: "rel_high" as DtKey, Icon: ShieldCheck, cls: "text-[color:var(--verified)] bg-[color:var(--verified)]/10" },
    medium: { key: "rel_medium" as DtKey, Icon: ShieldCheck, cls: "text-primary bg-primary/10" },
    low: { key: "rel_low" as DtKey, Icon: ShieldAlert, cls: "text-destructive bg-destructive/10" },
    insufficient: { key: "rel_insufficient" as DtKey, Icon: ShieldQuestion, cls: "text-muted-foreground bg-accent" },
  }[level];
  return (
    <span title={dt("rel_note")} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.cls)}>
      <meta.Icon size={11} /> {dt(meta.key)}
    </span>
  );
}
