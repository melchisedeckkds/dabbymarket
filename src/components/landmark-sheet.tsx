import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X, Navigation, Flag, Pencil, ShieldCheck, Camera, Loader2, BadgeCheck, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { useMt, type MtKey } from "@/lib/dabbymap-i18n";
import {
  CATEGORY_EMOJI, photoUrl, useContribute, useLandmarkPhoto, useMapperRole, useUploadLandmarkPhoto, useVerifyLandmark, type Landmark,
} from "@/lib/dabbymap";

type Mode = "view" | "report" | "fix" | "verify";

export function LandmarkSheet({ landmark, onClose, onRoute }: {
  landmark: Landmark;
  onClose: () => void;
  onRoute: (lm: Landmark) => void;
}) {
  const mt = useMt();
  const { session } = useAuth();
  const { data: role } = useMapperRole();
  const isAgent = !!role?.isAgent;
  const [mode, setMode] = useState<Mode>("view");
  const [text, setText] = useState("");
  const [name, setName] = useState(landmark.name);
  const [hint, setHint] = useState(landmark.access_hint ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const contribute = useContribute();
  const verify = useVerifyLandmark();
  const upload = useUploadLandmarkPhoto();
  const { data: photoPath } = useLandmarkPhoto(landmark.id);
  const photo = photoUrl(photoPath ?? landmark.thumbnail_path);
  useEscapeToClose(true, onClose);

  const verified = landmark.verification_status !== "unverified" && landmark.verification_status !== "located";
  const fail = (e: any) => toast.error(mt("lm_error"), { description: e?.message });

  async function sendReport() {
    try {
      await contribute.mutateAsync({ type: "report", landmarkId: landmark.id, changes: { note: text.trim() } });
      toast.success(mt("lm_reportSent")); setMode("view"); setText("");
    } catch (e) { fail(e); }
  }
  async function sendFix() {
    const changes: Record<string, unknown> = {};
    if (name.trim() && name.trim() !== landmark.name) changes.name = name.trim();
    if (hint.trim() !== (landmark.access_hint ?? "")) changes.access_hint = hint.trim();
    if (!Object.keys(changes).length) { setMode("view"); return; }
    try {
      const outcome = await contribute.mutateAsync({ type: "edit", landmarkId: landmark.id, changes });
      toast.success(outcome === "approved" ? mt("lm_fixApplied") : mt("lm_fixSent")); setMode("view");
    } catch (e) { fail(e); }
  }
  async function sendVerify(result: "confirmed" | "moved" | "closed") {
    try {
      await verify.mutateAsync({ landmarkId: landmark.id, result, notes: text.trim() || undefined });
      toast.success(mt("lm_verifyDone")); setMode("view"); setText("");
    } catch (e) { fail(e); }
  }
  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      await upload.mutateAsync({ landmarkId: landmark.id, file, autoApprove: isAgent });
      toast.success(mt("lm_photoSent"));
    } catch { toast.error(mt("lm_photoFail")); }
  }

  const loginBlock = (
    <p className="rounded-xl bg-accent p-3 text-xs text-muted-foreground">
      {mt("lm_loginNeeded")} <Link to="/auth" className="font-bold text-primary underline">{mt("lm_login")}</Link>
    </p>
  );
  const busy = contribute.isPending || verify.isPending;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[500] max-h-[75vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl animate-in slide-in-from-bottom">
      <div className="flex items-start gap-3 p-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-2xl">
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : CATEGORY_EMOJI[landmark.category_code] ?? "📍"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight">{landmark.name}</p>
          <p className="text-xs text-muted-foreground">{mt(`cat_${landmark.category_code}` as MtKey)}</p>
          <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            verified ? "bg-[color:var(--verified)]/15 text-[color:var(--verified)]" : "bg-accent text-muted-foreground")}>
            {verified ? <BadgeCheck size={12} /> : <HelpCircle size={12} />}
            {mt(`lm_status_${landmark.verification_status}` as MtKey)}
          </span>
        </div>
        <button onClick={onClose} aria-label={mt("lm_close")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent"><X size={16} /></button>
      </div>

      {mode === "view" && (
        <div className="space-y-3 px-4 pb-4">
          {landmark.access_hint && <p className="text-sm">{landmark.access_hint}</p>}
          {landmark.verification_status === "unverified" && <p className="text-xs text-muted-foreground">{mt("lm_unverifiedHint")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onRoute(landmark)} className="col-span-2 flex items-center justify-center gap-2 rounded-xl gold-gradient py-2.5 text-sm font-bold">
              <Navigation size={16} /> {mt("lm_route")}
            </button>
            <button onClick={() => setMode("report")} className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold"><Flag size={14} /> {mt("lm_report")}</button>
            <button onClick={() => setMode("fix")} className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold"><Pencil size={14} /> {mt("lm_fix")}</button>
            {isAgent && (
              <>
                <button onClick={() => setMode("verify")} className="flex items-center justify-center gap-1.5 rounded-xl border border-primary py-2 text-xs font-bold text-primary"><ShieldCheck size={14} /> {mt("lm_verify")}</button>
                <button onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="flex items-center justify-center gap-1.5 rounded-xl border border-primary py-2 text-xs font-bold text-primary disabled:opacity-60">
                  {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {mt("lm_addPhoto")}
                </button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              </>
            )}
          </div>
        </div>
      )}

      {mode !== "view" && (
        <div className="space-y-3 px-4 pb-4">
          {!session ? loginBlock : mode === "report" ? (
            <>
              <label className="text-xs font-semibold">{mt("lm_reportWhat")}</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={3} placeholder={mt("lm_reportPlaceholder")}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary" />
              <Actions busy={busy} disabled={text.trim().length < 3} onSend={sendReport} onCancel={() => setMode("view")} />
            </>
          ) : mode === "fix" ? (
            <>
              <label className="text-xs font-semibold">{mt("lm_name")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary" />
              <label className="text-xs font-semibold">{mt("lm_hint")}</label>
              <textarea value={hint} onChange={(e) => setHint(e.target.value)} maxLength={300} rows={2} placeholder={mt("lm_hintPlaceholder")}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary" />
              <Actions busy={busy} disabled={name.trim().length < 2} onSend={sendFix} onCancel={() => setMode("view")} />
            </>
          ) : (
            <>
              <label className="text-xs font-semibold">{mt("lm_notes")}</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={2} className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary" />
              <div className="grid grid-cols-3 gap-2">
                <button disabled={busy} onClick={() => sendVerify("confirmed")} className="rounded-xl bg-[color:var(--verified)] py-2.5 text-xs font-bold text-white disabled:opacity-60">{mt("lm_verifyConfirmed")}</button>
                <button disabled={busy} onClick={() => sendVerify("moved")} className="rounded-xl border border-border py-2.5 text-xs font-bold disabled:opacity-60">{mt("lm_verifyMoved")}</button>
                <button disabled={busy} onClick={() => sendVerify("closed")} className="rounded-xl border border-destructive py-2.5 text-xs font-bold text-destructive disabled:opacity-60">{mt("lm_verifyClosed")}</button>
              </div>
              <button onClick={() => setMode("view")} className="w-full rounded-xl py-2 text-xs text-muted-foreground">{mt("lm_cancel")}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Actions({ busy, disabled, onSend, onCancel }: { busy: boolean; disabled: boolean; onSend: () => void; onCancel: () => void }) {
  const mt = useMt();
  return (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={onCancel} className="rounded-xl border border-border py-2.5 text-sm font-semibold">{mt("lm_cancel")}</button>
      <button onClick={onSend} disabled={busy || disabled} className="flex items-center justify-center gap-2 rounded-xl gold-gradient py-2.5 text-sm font-bold disabled:opacity-50">
        {busy && <Loader2 size={14} className="animate-spin" />} {mt("lm_send")}
      </button>
    </div>
  );
}
