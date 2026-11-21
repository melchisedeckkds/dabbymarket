import { useState } from "react";
import { toast } from "sonner";
import { useV2, type V2Key } from "@/lib/v2-i18n";
import {
  useAdminReviewAnomalies, useAdminShopReviews, useAdminSetReviewStatus,
  useAdminReliabilityShops, useAdminSetReliability, useAdminAppeals, useAdminResolveAppeal,
  useAdminHealthProfiles, useAdminSetHealthStatus, useAdminDrugs, useAdminAddDrug, useAdminSetConfig, useHealthConfig,
} from "@/lib/v2-queries";

const card = "rounded-2xl border border-border bg-card p-4 space-y-3";
const btn = "rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50";
const err = (e: any, v: ReturnType<typeof useV2>) => toast.error(e?.message ?? v("common_error"));

/** Avis boutique : anomalies (rafales de comptes récents) + modération des avis d'une boutique. */
export function AdminReviewsTab() {
  const v = useV2();
  const { data: anomalies = [] } = useAdminReviewAnomalies();
  const [shopId, setShopId] = useState<string | undefined>();
  const { data: reviews = [] } = useAdminShopReviews(shopId);
  const setStatus = useAdminSetReviewStatus();
  return (
    <div className="space-y-4">
      <section className={card}>
        <h3 className="text-sm font-bold">{v("ad_reviews")}</h3>
        {anomalies.length === 0 && <p className="text-xs text-muted-foreground">{v("ad_anomalies_none")}</p>}
        {anomalies.map((a) => (
          <button key={a.shop_id} onClick={() => setShopId(a.shop_id)} className="flex w-full items-center justify-between rounded-xl bg-accent px-3 py-2 text-left text-xs">
            <span className="font-semibold">{a.shop_name}</span>
            <span className="text-muted-foreground">{a.reviews_30d} avis · {Math.round(a.young_account_share * 100)} % comptes récents</span>
          </button>
        ))}
      </section>
      {shopId && (
        <section className={card}>
          {(reviews as any[]).map((r) => (
            <div key={r.id} className="space-y-1 border-b border-border pb-2 text-xs last:border-0">
              <p className="font-semibold">{"★".repeat(r.rating)} · {r.profiles?.name ?? "—"} · {r.evidence} · poids {r.weight} · {r.status}</p>
              {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
              <button className={btn} disabled={setStatus.isPending}
                onClick={() => setStatus.mutateAsync({ reviewId: r.id, status: r.status === "visible" ? "hidden" : "visible" }).catch((e) => err(e, v))}>
                {r.status === "visible" ? v("ad_hide") : v("ad_show")}
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Fiabilité des boutiques : statuts non normaux + contestations ouvertes. */
export function AdminReliabilityTab() {
  const v = useV2();
  const { data: shops = [] } = useAdminReliabilityShops();
  const { data: appeals = [] } = useAdminAppeals();
  const setRel = useAdminSetReliability();
  const resolve = useAdminResolveAppeal();
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <div className="space-y-4">
      <section className={card}>
        <h3 className="text-sm font-bold">{v("ad_reliability")}</h3>
        {(shops as any[]).map((s) => (
          <div key={s.id} className="space-y-1.5 border-b border-border pb-2 text-xs last:border-0">
            <p className="font-semibold">{s.name} — {s.reliability_status}{s.reliability_manual ? " (manuel)" : ""}</p>
            {s.reliability_note && <p className="text-muted-foreground">{s.reliability_note}</p>}
            <div className="flex flex-wrap gap-1.5">
              {(["normal", "watch", "unreliable", "boost_suspended"] as const).map((st) => (
                <button key={st} className={btn} disabled={setRel.isPending || st === s.reliability_status}
                  onClick={() => setRel.mutateAsync({ shopId: s.id, status: st, note: notes[s.id] }).catch((e) => err(e, v))}>{st}</button>
              ))}
            </div>
            <input value={notes[s.id] ?? ""} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} placeholder={v("ad_note")} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
          </div>
        ))}
      </section>
      <section className={card}>
        <h3 className="text-sm font-bold">Contestations</h3>
        {(appeals as any[]).length === 0 && <p className="text-xs text-muted-foreground">—</p>}
        {(appeals as any[]).map((a) => (
          <div key={a.id} className="space-y-1.5 border-b border-border pb-2 text-xs last:border-0">
            <p className="font-semibold">{a.shops?.name}</p>
            <p className="text-muted-foreground">{a.message}</p>
            <input value={notes[a.id] ?? ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} placeholder={v("ad_note")} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
            <div className="flex gap-1.5">
              <button className={btn} onClick={() => resolve.mutateAsync({ appealId: a.id, accept: true, note: notes[a.id] }).catch((e) => err(e, v))}>{v("ad_accept")}</button>
              <button className={btn} onClick={() => resolve.mutateAsync({ appealId: a.id, accept: false, note: notes[a.id] }).catch((e) => err(e, v))}>{v("ad_reject")}</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/** Santé : dossiers, référentiel de médicaments, interrupteur S2. */
export function AdminHealthTab() {
  const v = useV2();
  const [status, setStatus] = useState("pending");
  const { data: profiles = [] } = useAdminHealthProfiles(status);
  const setHealth = useAdminSetHealthStatus();
  const { data: cfg } = useHealthConfig();
  const setConfig = useAdminSetConfig();
  const { data: drugs = [] } = useAdminDrugs();
  const addDrug = useAdminAddDrug();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [d, setD] = useState({ nameFr: "", dci: "", dosage: "", forme: "", rxStatus: "prescription" as "prescription" | "otc_listed" | "controlled" });

  return (
    <div className="space-y-4">
      <section className={card}>
        <h3 className="text-sm font-bold">{v("ad_s2_switch")}</h3>
        <p className="text-[11px] text-destructive">{v("ad_s2_warning")}</p>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={!!cfg?.s2Enabled} disabled={setConfig.isPending}
            onChange={(e) => {
              if (e.target.checked && !window.confirm(v("ad_s2_warning"))) return;
              setConfig.mutateAsync({ key: "health_s2_enabled", value: e.target.checked ? "1" : "0" }).catch((x) => err(x, v));
            }} />
          S2
        </label>
      </section>

      <section className={card}>
        <h3 className="text-sm font-bold">{v("ad_health")}</h3>
        <div className="flex flex-wrap gap-1.5">
          {["pending", "verified", "suspended", "rejected", "expired"].map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`${btn} ${status === s ? "bg-primary/10 text-primary" : ""}`}>{v(`hl_status_${s}` as V2Key)}</button>
          ))}
        </div>
        {(profiles as any[]).map((p) => (
          <div key={p.shop_id} className="space-y-1.5 border-b border-border pb-2 text-xs last:border-0">
            <p className="font-semibold">{p.shops?.name} — {v(`hl_type_${p.facility_type}` as V2Key)}</p>
            <p className="text-muted-foreground">Autorisation : {p.authorization_ref} · Responsable : {p.responsible_name}</p>
            <input value={notes[p.shop_id] ?? ""} onChange={(e) => setNotes({ ...notes, [p.shop_id]: e.target.value })} placeholder={v("ad_note")} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
            <div className="flex gap-1.5">
              <button className={btn} onClick={() => setHealth.mutateAsync({ shopId: p.shop_id, status: "verified", note: notes[p.shop_id] }).catch((e) => err(e, v))}>{v("ad_verify")}</button>
              <button className={btn} onClick={() => setHealth.mutateAsync({ shopId: p.shop_id, status: "rejected", note: notes[p.shop_id] }).catch((e) => err(e, v))}>{v("ad_reject")}</button>
              <button className={btn} onClick={() => setHealth.mutateAsync({ shopId: p.shop_id, status: "suspended", note: notes[p.shop_id] }).catch((e) => err(e, v))}>{v("ad_suspend")}</button>
            </div>
          </div>
        ))}
      </section>

      <section className={card}>
        <h3 className="text-sm font-bold">{v("ad_drugs")}</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <input placeholder="Nom commercial" value={d.nameFr} onChange={(e) => setD({ ...d, nameFr: e.target.value })} className="col-span-2 rounded-lg border border-border bg-background px-2 py-1.5" />
          <input placeholder="DCI" value={d.dci} onChange={(e) => setD({ ...d, dci: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5" />
          <input placeholder="Dosage" value={d.dosage} onChange={(e) => setD({ ...d, dosage: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5" />
          <input placeholder="Forme" value={d.forme} onChange={(e) => setD({ ...d, forme: e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1.5" />
          <select value={d.rxStatus} onChange={(e) => setD({ ...d, rxStatus: e.target.value as any })} className="rounded-lg border border-border bg-background px-2 py-1.5">
            <option value="prescription">Sur ordonnance</option><option value="otc_listed">Liste sans ordonnance</option><option value="controlled">Contrôlé (jamais publiable)</option>
          </select>
        </div>
        <button className={btn} disabled={!d.nameFr.trim() || !d.dci.trim() || addDrug.isPending}
          onClick={() => addDrug.mutateAsync(d).then(() => setD({ ...d, nameFr: "", dci: "", dosage: "", forme: "" })).catch((e) => err(e, v))}>{v("common_save")}</button>
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          {(drugs as any[]).map((x) => <li key={x.catalog_item_id}>{x.catalog_items?.name_fr} — {x.dci} {x.dosage ?? ""} ({x.rx_status})</li>)}
        </ul>
      </section>
    </div>
  );
}
