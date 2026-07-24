import { Link } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useRequestRecharge, useMyTransactions } from "@/lib/queries";
import { Pepite } from "@/components/pepite";
import { ArrowLeft, Copy, Smartphone, CheckCircle2, Clock, XCircle, Loader2, Sparkles, Wallet, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-store";
import { hapticSuccess } from "@/lib/haptics";

const ADMIN_PHONE_DISPLAY = "+237 696 430 723";

const packs = [
  { pepites: 200, xaf: 1000 },
  { pepites: 500, xaf: 2500, popular: true },
  { pepites: 1200, xaf: 5000 },
  { pepites: 3000, xaf: 12000 },
];

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
  const [pack, setPack] = useState(1);
  const [method, setMethod] = useState<"OrangeMoney" | "MTNMoMo">("OrangeMoney");
  const [txCode, setTxCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function copyNumber() {
    navigator.clipboard.writeText(ADMIN_PHONE_DISPLAY.replace(/\s/g, ""));
    toast.success(t("recharge_numberCopied"));
  }

  async function submit() {
    if (!txCode.trim()) return toast.error(t("recharge_codeRequired"));
    setSubmitting(true);
    try {
      await requestRecharge.mutateAsync({ amount: packs[pack].pepites, method, reference: txCode.trim() });
      hapticSuccess();
      toast.success(t("recharge_requestSent"), { description: t("recharge_requestSentDesc") });
      setTxCode("");
    } catch (err: any) {
      toast.error(t("recharge_requestFailed"), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/" className="group grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40">
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Wallet size={13} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/80">Portefeuille</span>
            </div>
            <h1 className="truncate text-base font-black">{t("recharge_title")}</h1>
          </div>
        </div>
      </div>

      <div className="relative p-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(212,175,55,0.12),transparent_70%)]" />

        {/* Solde hero */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card to-card p-5 shadow-xl shadow-primary/10">
          <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <span className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-yellow-300/15 blur-3xl" />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/80">{t("recharge_currentBalance")}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <Pepite size={32} />
                <span className="text-[42px] font-black leading-none tracking-tight text-primary">
                  {profile?.pepites_balance ?? 0}
                </span>
              </div>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl gold-gradient shine shadow-lg shadow-primary/25">
              <Sparkles size={22} className="text-background" />
            </div>
          </div>
        </div>

        {/* Étape 1 : numéro */}
        <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/15 to-transparent px-4 py-2.5">
            <StepNumber n={1} />
            <p className="text-[11px] font-black uppercase tracking-wider text-primary">{t("recharge_step1Title")}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">{t("recharge_step1Desc")}</p>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl gold-gradient shadow-md shadow-primary/20">
                <Smartphone size={20} className="text-background" />
              </div>
              <span className="flex-1 font-mono text-base font-black tracking-wider">{ADMIN_PHONE_DISPLAY}</span>
              <button
                onClick={copyNumber}
                className="group grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md transition-all hover:scale-110"
                aria-label="Copier"
              >
                <Copy size={16} className="transition-transform group-active:scale-90" />
              </button>
            </div>
            <p className="mt-2 text-[10px] italic text-muted-foreground">{t("recharge_beneficiary")}</p>
          </div>
        </div>

        {/* Étape 2 : pack */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <StepNumber n={2} />
            <h2 className="text-sm font-black tracking-tight">{t("recharge_step2Title")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {packs.map((p, i) => (
              <button
                key={i}
                onClick={() => setPack(i)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.98]",
                  pack === i
                    ? "border-primary bg-gradient-to-br from-primary/15 via-card to-card shadow-lg shadow-primary/20"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                {p.popular && (
                  <span className="absolute -top-px right-3 rounded-b-lg gold-gradient px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-background shadow-md">
                    ★ {t("recharge_popular")}
                  </span>
                )}
                <div className="flex items-baseline gap-1.5">
                  <Pepite size={20} />
                  <span className="text-2xl font-black tracking-tight">{p.pepites}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-muted-foreground">{p.xaf.toLocaleString(locale)} FCFA</p>
                {pack === i && (
                  <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                    <CheckCircle2 size={12} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Étape 3 : méthode */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <StepNumber n={3} />
            <h2 className="text-sm font-black tracking-tight">{t("recharge_step3Title")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98]",
                  method === m.id ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className="h-4 w-4 rounded-full shadow-inner" style={{ background: m.color, boxShadow: `0 0 12px ${m.color}55` }} />
                <span className="text-xs font-black">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Étape 4 : code */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <StepNumber n={4} />
            <h2 className="text-sm font-black tracking-tight">{t("recharge_step4Title")}</h2>
          </div>
          <input
            value={txCode}
            onChange={(e) => setTxCode(e.target.value)}
            className="input"
            placeholder={t("recharge_codePlaceholder")}
          />
          <p className="mt-1.5 text-[10px] italic text-muted-foreground">{t("recharge_codeHint")}</p>
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="shine mt-5 flex w-full items-center justify-center gap-2 rounded-2xl gold-gradient py-4 text-sm font-black text-background shadow-xl shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          {t("recharge_submit")} — {packs[pack].xaf.toLocaleString(locale)} FCFA
        </button>

        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground">
          <Clock size={14} className="mt-0.5 shrink-0 text-primary" />
          <p>{t("recharge_pendingNotice")}</p>
        </div>

        {myTransactions.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-black tracking-tight">
              <Clock size={14} className="text-primary" />
              {t("recharge_recentRecharges")}
            </h2>
            <div className="space-y-2">
              {myTransactions
                .filter((tx: any) => tx.type === "recharge")
                .slice(0, 8)
                .map((tx: any) => {
                  const isConfirmed = tx.status === "confirmed";
                  const isRejected = tx.status === "rejected";
                  return (
                    <div
                      key={tx.id}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3 transition-all",
                        isConfirmed && "border-[color:var(--verified)]/40 bg-[color:var(--verified)]/5",
                        isRejected && "border-destructive/40 bg-destructive/5",
                        !isConfirmed && !isRejected && "border-primary/30 bg-primary/5",
                      )}
                    >
                      <div
                        className={cn(
                          "grid h-9 w-9 place-items-center rounded-xl",
                          isConfirmed && "bg-[color:var(--verified)]/15 text-[color:var(--verified)]",
                          isRejected && "bg-destructive/15 text-destructive",
                          !isConfirmed && !isRejected && "bg-primary/15 text-primary",
                        )}
                      >
                        {isConfirmed ? <CheckCircle2 size={16} /> : isRejected ? <XCircle size={16} /> : <Clock size={16} className="animate-pulse" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black">+{tx.amount} <span className="text-xs font-medium text-muted-foreground">{t("pepites")}</span></p>
                        <p className="truncate text-[10px] font-mono text-muted-foreground">
                          {t("recharge_codeLabel")} : {tx.reference_code}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                          isConfirmed && "bg-[color:var(--verified)]/20 text-[color:var(--verified)]",
                          isRejected && "bg-destructive/20 text-destructive",
                          !isConfirmed && !isRejected && "bg-primary/20 text-primary",
                        )}
                      >
                        {isConfirmed ? t("recharge_statusValidated") : isRejected ? t("recharge_statusRejected") : t("recharge_statusPending")}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-border bg-gradient-to-br from-card via-accent/20 to-card p-4 text-[11px]">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-black text-foreground">
            <Sparkles size={14} className="text-primary" /> {t("recharge_costsTitle")}
          </p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex items-center justify-between">
              <span>• {t("recharge_costShop")}</span>
              <span className="font-black text-[color:var(--verified)]">{t("common_free")}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>• {t("recharge_costPublish")}</span>
              <span className="inline-flex items-center gap-1 font-bold">15 <Pepite size={11} /></span>
            </li>
            <li className="flex items-center justify-between">
              <span>• {t("recharge_costBoostProduct")} <span className="text-primary">— {t("recharge_boostRecommendedByAI")}</span></span>
              <span className="inline-flex items-center gap-1 font-bold">80 <Pepite size={11} /></span>
            </li>
            <li className="flex items-center justify-between">
              <span>• {t("recharge_costBoostShop")}</span>
              <span className="inline-flex items-center gap-1 font-bold">120 <Pepite size={11} /></span>
            </li>
          </ul>
        </div>
      </div>

      <style>{`.input{width:100%;border-radius:0.85rem;border:2px solid var(--color-border);background:var(--color-card);padding:0.85rem 0.95rem;font-size:0.95rem;outline:none;color:var(--color-foreground);font-family:monospace;font-weight:700;letter-spacing:0.05em;transition:all .2s}
      .input:focus{border-color:var(--color-primary);box-shadow:0 0 0 4px color-mix(in oklab,var(--color-primary) 15%,transparent)}`}</style>
    </AppShell>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full gold-gradient text-[10px] font-black text-background shadow-md shadow-primary/20">
      {n}
    </span>
  );
}
