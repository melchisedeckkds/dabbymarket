import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useV2, type V2Key } from "@/lib/v2-i18n";
import { useShop } from "@/lib/queries";
import { useMyHealthProfile, useSubmitHealthProfile, useDutyPeriods, useAddDutyPeriod, useDeleteDutyPeriod } from "@/lib/v2-queries";

const TYPES = ["pharmacie", "hopital", "centre_sante", "laboratoire", "imagerie", "cabinet", "autre"] as const;

export default function SanteDossierPage() {
  const { shopId } = useParams();
  const v = useV2();
  const { data: shop } = useShop(shopId);
  const { data: profile } = useMyHealthProfile(shopId);
  const submit = useSubmitHealthProfile(shopId);
  const [type, setType] = useState<string>("pharmacie");
  const [ref, setRef] = useState("");
  const [resp, setResp] = useState("");
  useEffect(() => {
    if (profile) { setType(profile.facility_type); setRef(profile.authorization_ref); setResp(profile.responsible_name); }
  }, [profile]);

  const verified = profile?.status === "verified";
  const { data: duty = [] } = useDutyPeriods(verified ? shopId : undefined);
  const addDuty = useAddDutyPeriod(shopId);
  const delDuty = useDeleteDutyPeriod(shopId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function send() {
    try { await submit.mutateAsync({ facilityType: type, authorizationRef: ref, responsibleName: resp }); toast.success(v("hl_dossier_sent")); }
    catch (e: any) { toast.error(e.message ?? v("common_error")); }
  }
  async function addPeriod() {
    try { await addDuty.mutateAsync({ startsAt: new Date(from).toISOString(), endsAt: new Date(to).toISOString() }); setFrom(""); setTo(""); }
    catch (e: any) { toast.error(e.message ?? v("common_error")); }
  }

  return (
    <AppShell>
      <div className="space-y-4 px-4 pt-3">
        <Link to={`/boutique/${shopId}`} className="text-xs text-muted-foreground">← {shop?.name}</Link>
        <h1 className="text-base font-bold">{v("hl_dossier_title")}</h1>
        <p className="text-[11px] text-muted-foreground">{v("hl_dossier_intro")}</p>
        {profile && (
          <div className="rounded-xl border border-border bg-card p-3 text-xs">
            <p className="font-semibold">{v(`hl_status_${profile.status}` as V2Key)}</p>
            {profile.review_note && <p className="mt-1 text-muted-foreground">{profile.review_note}</p>}
            {verified && profile.expires_at && <p className="mt-1 text-muted-foreground">{v("hl_valid_until", { d: new Date(profile.expires_at).toLocaleDateString() })}</p>}
          </div>
        )}
        <label className="block text-xs font-semibold">{v("hl_dossier_type")}
          <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
            {TYPES.map((t) => <option key={t} value={t}>{v(`hl_type_${t}` as V2Key)}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold">{v("hl_dossier_ref")}
          <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-xs font-semibold">{v("hl_dossier_resp")}
          <input value={resp} onChange={(e) => setResp(e.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
        </label>
        <button onClick={send} disabled={ref.trim().length < 3 || resp.trim().length < 2 || submit.isPending} className="w-full rounded-xl gold-gradient py-3 text-sm font-bold disabled:opacity-50">{v("hl_dossier_send")}</button>

        {verified && (
          <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">{v("hl_duty_title")}</h2>
            {(duty as any[]).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span>{new Date(d.starts_at).toLocaleString()} → {new Date(d.ends_at).toLocaleString()}</span>
                <button onClick={() => delDuty.mutate(d.id)} className="text-destructive">✕</button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold">{v("hl_duty_from")}<input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" /></label>
              <label className="text-[11px] font-semibold">{v("hl_duty_to")}<input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" /></label>
            </div>
            <button onClick={addPeriod} disabled={!from || !to || addDuty.isPending} className="w-full rounded-xl border border-border py-2 text-xs font-semibold disabled:opacity-50">{v("hl_duty_add")}</button>
          </section>
        )}
      </div>
    </AppShell>
  );
}
