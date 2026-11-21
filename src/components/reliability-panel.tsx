import { useState } from "react";
import { toast } from "sonner";
import { useV2 } from "@/lib/v2-i18n";
import { useShopTrust, useAppealReliability, useMyAppeals } from "@/lib/v2-queries";
import { ReliabilityBadge } from "@/components/trust-badges";

/** « Ma fiabilité » côté marchand : statut, motif, boosts suspendus, contestation. */
export function ReliabilityPanel({ shopId }: { shopId: string }) {
  const v = useV2();
  const { data } = useShopTrust(shopId);
  const { data: appeals = [] } = useMyAppeals(shopId);
  const appeal = useAppealReliability(shopId);
  const [msg, setMsg] = useState("");
  if (!data) return null;
  const bad = data.reliability !== "normal";
  const open = (appeals as any[]).some((a) => a.status === "open");

  async function send() {
    try { await appeal.mutateAsync(msg.trim()); toast.success(v("rel_panel_appeal_sent")); setMsg(""); } catch (e: any) { toast.error(e.message ?? v("common_error")); }
  }

  return (
    <section className="space-y-2.5 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-bold">{v("rel_panel_title")}</h3>
      {!bad ? (
        <p className="text-xs text-muted-foreground">{v("rel_panel_ok")}</p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-xs">{v("rel_panel_status")} : <ReliabilityBadge status={data.reliability} /></p>
          {data.reliabilityNote && <p className="rounded-lg bg-accent px-2.5 py-1.5 text-[11px]">{data.reliabilityNote}</p>}
          {(data.reliability === "unreliable" || data.reliability === "boost_suspended") && <p className="text-[11px] text-destructive">{v("rel_panel_boost_off")}</p>}
          {open ? (
            <p className="text-[11px] font-semibold text-primary">{v("rel_panel_appeal_sent")}</p>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground">{v("rel_panel_appeal_hint")}</p>
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} maxLength={800} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <button onClick={send} disabled={msg.trim().length < 20 || appeal.isPending} className="w-full rounded-xl gold-gradient py-2.5 text-xs font-bold disabled:opacity-50">{v("rel_panel_appeal_send")}</button>
            </>
          )}
        </>
      )}
    </section>
  );
}
