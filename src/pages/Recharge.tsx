import { Link } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useRequestRecharge, useMyTransactions, usePepitePacks, useAppConfig } from "@/lib/queries";
import { Pepite } from "@/components/pepite";
import { ArrowLeft, Copy, Smartphone, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-store";
import { hapticSuccess } from "@/lib/haptics";

const ADMIN_PHONE_DISPLAY = "+237 696 430 723";
const ADMIN_BENEFICIARY_NAME = "Kondjebe Melchisedeck Stanley Daniel";

const methods: { id: "OrangeMoney" | "MTNMoMo"; label: string; color: string }[] = [
  { id: "OrangeMoney", label: "Orange Money", color: "#ff6a00" },
  { id: "MTNMoMo", label: "MTN Mobile Money", color: "#ffcb05" },
];

export default function RechargePage() {
  const { profile } = useAuth();
  const { t, lang } = useApp();
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const requestRecharge = useRequestRecharge();
  const { data: myTransactions = [] } = useMyTransactions();
  const { data: packs = [] } = usePepitePacks();
  const { data: config } = useAppConfig();
  const [pack, setPack] = useState(0);
  const [method, setMethod] = useState<"OrangeMoney" | "MTNMoMo">("OrangeMoney");
  const [txCode, setTxCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Le pack "populaire" est le pack médian du catalogue (STANDARD),
  // repéré par sa position plutôt que codé en dur — reste cohérent même
  // si l'admin ajoute ou retire un pack depuis le panneau Économie.
  const popularIndex = Math.floor(packs.length / 2);
  const selected = packs[pack];
  const quota = config?.free_active_listings_quota ?? 3;
  const overagePrice = config?.quota_overage_price_pepites ?? 10;

  function copyNumber() {
    navigator.clipboard.writeText(ADMIN_PHONE_DISPLAY.replace(/\s/g, ""));
    toast.success(t("recharge_numberCopied"));
  }

  async function submit() {
    if (!txCode.trim()) return toast.error(t("recharge_codeRequired"));
    if (!selected) return;
    setSubmitting(true);
    try {
      await requestRecharge.mutateAsync({ amount: selected.pepites, method, reference: txCode.trim() });
      hapticSuccess();
      toast.success(t("recharge_requestSent"), {
        description: t("recharge_requestSentDesc"),
      });
      setTxCode("");
    } catch (err: any) {
      toast.error(t("recharge_requestFailed"), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-card">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">{t("recharge_title")}</h1>
      </div>

      <div className="p-4">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">{t("recharge_currentBalance")}</p>
          <div className="mt-1 inline-flex items-center gap-2">
            <Pepite size={28} />
            <span className="text-3xl font-bold text-primary">{profile?.pepites_balance ?? 0}</span>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="border-b border-primary/20 bg-primary/10 px-4 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{t("recharge_step1Title")}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">{t("recharge_step1Desc")}</p>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background p-3">
              <Smartphone size={20} className="text-primary" />
              <span className="flex-1 font-mono text-lg font-bold">{ADMIN_PHONE_DISPLAY}</span>
              <button onClick={copyNumber} className="grid h-9 w-9 place-items-center rounded-full bg-accent hover:bg-primary/20">
                <Copy size={16} />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("recharge_beneficiary")} : {ADMIN_BENEFICIARY_NAME}</p>
          </div>
        </div>

        <h2 className="mt-6 mb-2 text-sm font-semibold">{t("recharge_step2Title")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {packs.map((p: any, i: number) => (
            <button key={p.id} onClick={() => setPack(i)} className={cn("relative rounded-xl border p-3 text-left transition-colors", pack === i ? "border-primary bg-primary/5" : "border-border bg-card")}>
              {i === popularIndex && <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{t("recharge_popular")}</span>}
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{p.label}</p>
              <div className="flex items-center gap-1.5">
                <Pepite size={18} />
                <span className="text-lg font-bold">{p.pepites}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.price_fcfa.toLocaleString(locale)} FCFA</p>
            </button>
          ))}
        </div>

        <h2 className="mt-6 mb-2 text-sm font-semibold">{t("recharge_step3Title")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {methods.map((m) => (
            <button key={m.id} onClick={() => setMethod(m.id)} className={cn("flex items-center gap-2 rounded-xl border p-3 text-left", method === m.id ? "border-primary bg-primary/5" : "border-border bg-card")}>
              <span className="h-3 w-3 rounded-full" style={{ background: m.color }} />
              <span className="text-xs font-semibold">{m.label}</span>
            </button>
          ))}
        </div>

        <h2 className="mt-6 mb-2 text-sm font-semibold">{t("recharge_step4Title")}</h2>
        <input value={txCode} onChange={(e) => setTxCode(e.target.value)} className="input" placeholder={t("recharge_codePlaceholder")} />
        <p className="mt-1 text-[11px] text-muted-foreground">{t("recharge_codeHint")}</p>

        <button onClick={submit} disabled={submitting || !selected} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3.5 text-sm font-bold disabled:opacity-60">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {t("recharge_submit")} — {selected ? selected.price_fcfa.toLocaleString(locale) : "…"} FCFA
        </button>

        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground">
          {t("recharge_pendingNotice")}
        </div>

        {myTransactions.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">{t("recharge_recentRecharges")}</h2>
            <div className="space-y-2">
              {myTransactions
                .filter((tx: any) => tx.type === "recharge")
                .slice(0, 8)
                .map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    {tx.status === "confirmed" ? (
                      <CheckCircle2 size={18} className="text-[color:var(--verified)]" />
                    ) : tx.status === "rejected" ? (
                      <XCircle size={18} className="text-destructive" />
                    ) : (
                      <Clock size={18} className="animate-pulse text-primary" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">+{tx.amount} {t("pepites")}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{t("recharge_codeLabel")} : {tx.reference_code}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                      {tx.status === "confirmed" ? t("recharge_statusValidated") : tx.status === "rejected" ? t("recharge_statusRejected") : t("recharge_statusPending")}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-accent/60 p-3 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground">{t("recharge_costsTitle")}</p>
          <ul className="mt-1 space-y-0.5">
            <li>
              • {t("recharge_costShop")} : <span className="font-bold text-[color:var(--verified)]">{t("common_free")}</span>
            </li>
            <li>
              • {t("recharge_costPublishFree")} : <span className="font-bold text-[color:var(--verified)]">{t("common_free")}</span> ({t("recharge_costPublishQuota").replace("{n}", String(quota))})
            </li>
            <li>• {t("recharge_costPublishOverage").replace("{price}", String(overagePrice))}</li>
            <li>• {t("recharge_costBoostsIntro")}</li>
          </ul>
          <p className="mt-2 text-[10px] italic">{t("recharge_boostFairnessNote")}</p>
        </div>
      </div>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-border);background:var(--color-card);padding:0.75rem 0.9rem;font-size:0.9rem;outline:none;color:var(--color-foreground);font-family:monospace}`}</style>
    </AppShell>
  );
}
