import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Check, X as XIcon, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { useMt, type MtKey } from "@/lib/dabbymap-i18n";
import {
  CATEGORY_EMOJI, useAgentQueue, useMapperRole, useReviewContribution, useToVerify, useVerifyLandmark,
  type Landmark, type PendingContribution,
} from "@/lib/dabbymap";

export default function AgentCartePage() {
  const mt = useMt();
  const { data: role, isLoading } = useMapperRole();
  const isAgent = !!role?.isAgent;
  const [tab, setTab] = useState<"validate" | "verify">("validate");
  const queue = useAgentQueue(isAgent);
  const toVerify = useToVerify(isAgent);

  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Link to="/carte" aria-label={mt("lm_back")} className="grid h-9 w-9 place-items-center rounded-full bg-card"><ArrowLeft size={18} /></Link>
        <h1 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={18} className="text-primary" /> {mt("lm_agent_title")}</h1>
      </div>

      {isLoading ? (
        <div className="grid place-items-center p-10"><Loader2 className="animate-spin" /></div>
      ) : !isAgent ? (
        <p className="m-4 rounded-xl bg-card p-4 text-sm text-muted-foreground">{mt("lm_agent_noRights")}</p>
      ) : (
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            {([["validate", "lm_agent_toValidate", queue.data?.length ?? 0], ["verify", "lm_agent_toVerify", toVerify.data?.length ?? 0]] as const).map(([k, label, n]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn("rounded-xl border py-2.5 text-sm font-bold", tab === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
                {mt(label)} ({n})
              </button>
            ))}
          </div>
          {tab === "validate" ? (
            queue.data && queue.data.length ? queue.data.map((c) => <ContributionCard key={c.id} c={c} />) : <Empty />
          ) : (
            toVerify.data && toVerify.data.length ? toVerify.data.map((l) => <VerifyCard key={l.id} l={l} />) : <Empty />
          )}
        </div>
      )}
    </AppShell>
  );
}

const Empty = () => {
  const mt = useMt();
  return <p className="rounded-xl bg-card p-4 text-center text-sm text-muted-foreground">{mt("lm_agent_none")}</p>;
};

function osmLink(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;
}

function ContributionCard({ c }: { c: PendingContribution }) {
  const mt = useMt();
  const review = useReviewContribution();
  const ch = c.proposed_changes ?? {};
  const typeLabel = c.contribution_type === "create" ? mt("lm_agent_create") : c.contribution_type === "edit" ? mt("lm_agent_edit") : mt("lm_agent_report");
  const title = ch.name ?? c.landmark_name ?? "—";
  async function act(approve: boolean) {
    try {
      await review.mutateAsync({ id: c.id, approve });
      toast.success(approve ? mt("lm_agent_approved") : mt("lm_agent_rejected"));
    } catch (e: any) { toast.error(mt("lm_error"), { description: e?.message }); }
  }
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold">{typeLabel}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{ch.category_code ? CATEGORY_EMOJI[ch.category_code] ?? "📍" : "📍"} {title}</p>
          {c.landmark_name && ch.name && ch.name !== c.landmark_name && <p className="text-xs text-muted-foreground">« {c.landmark_name} » → « {ch.name} »</p>}
          {ch.category_code && <p className="text-xs text-muted-foreground">{mt(`cat_${ch.category_code}` as MtKey)}</p>}
          {ch.access_hint && <p className="text-xs">{ch.access_hint}</p>}
          {ch.note && <p className="mt-1 rounded-lg bg-accent p-2 text-xs">{ch.note}</p>}
          {typeof ch.lat === "number" || typeof ch.lat === "string" ? (
            <a href={osmLink(Number(ch.lat), Number(ch.lng))} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary underline">
              <MapPin size={12} /> {mt("lm_agent_seeOnMap")}
            </a>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={review.isPending} onClick={() => act(false)} className="flex items-center justify-center gap-1 rounded-xl border border-destructive py-2 text-xs font-bold text-destructive disabled:opacity-50"><XIcon size={14} /> {mt("lm_agent_reject")}</button>
        <button disabled={review.isPending} onClick={() => act(true)} className="flex items-center justify-center gap-1 rounded-xl bg-[color:var(--verified)] py-2 text-xs font-bold text-white disabled:opacity-50"><Check size={14} /> {mt("lm_agent_approve")}</button>
      </div>
    </div>
  );
}

function VerifyCard({ l }: { l: Landmark }) {
  const mt = useMt();
  const verify = useVerifyLandmark();
  async function act(result: "confirmed" | "moved" | "closed") {
    try { await verify.mutateAsync({ landmarkId: l.id, result }); toast.success(mt("lm_verifyDone")); }
    catch (e: any) { toast.error(mt("lm_error"), { description: e?.message }); }
  }
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-sm font-bold">{CATEGORY_EMOJI[l.category_code] ?? "📍"} {l.name}</p>
      <p className="text-xs text-muted-foreground">{mt(`cat_${l.category_code}` as MtKey)}</p>
      <a href={osmLink(l.lat, l.lng)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary underline"><MapPin size={12} /> {mt("lm_agent_seeOnMap")}</a>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button disabled={verify.isPending} onClick={() => act("confirmed")} className="rounded-xl bg-[color:var(--verified)] py-2 text-xs font-bold text-white disabled:opacity-50">{mt("lm_verifyConfirmed")}</button>
        <button disabled={verify.isPending} onClick={() => act("moved")} className="rounded-xl border border-border py-2 text-xs font-bold disabled:opacity-50">{mt("lm_verifyMoved")}</button>
        <button disabled={verify.isPending} onClick={() => act("closed")} className="rounded-xl border border-destructive py-2 text-xs font-bold text-destructive disabled:opacity-50">{mt("lm_verifyClosed")}</button>
      </div>
    </div>
  );
}
