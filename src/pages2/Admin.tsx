import { Link, Navigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { AdminMetricsSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { MiniBarChart } from "@/components/mini-chart";
import { downloadCSV } from "@/lib/csv";
import { usePendingRecharges, useConfirmRecharge, useSuggestions, usePepites7d, useViews7d } from "@/lib/queries";
import { useApp } from "@/lib/app-store";
import { ArrowLeft, Download, Store, Package, Zap, TrendingUp, Users, ShieldCheck, Clock, CheckCircle2, XCircle, ThumbsUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function useAdminMetrics() {
  return useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const [{ count: shopsCount }, { data: products }, { count: usersCount }, { data: spentTx }] = await Promise.all([
        supabase.from("shops").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id, name, price_xaf, shop_id, boosted_until"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("pepites_transactions").select("amount").lt("amount", 0).eq("status", "confirmed"),
      ]);

      const productsList = products ?? [];
      const boostsActive = productsList.filter((p) => p.boosted_until && new Date(p.boosted_until).getTime() > Date.now()).length;
      const pepitesSpent = (spentTx ?? []).reduce((s, t) => s + Math.abs(t.amount), 0);

      const { data: likeRows } = await supabase.from("likes").select("product_id").not("product_id", "is", null);
      const likeCounts = new Map<string, number>();
      (likeRows ?? []).forEach((l) => likeCounts.set(l.product_id!, (likeCounts.get(l.product_id!) ?? 0) + 1));
      const topProducts = [...productsList]
        .map((p) => ({ ...p, likes: likeCounts.get(p.id) ?? 0 }))
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 5);

      const { data: shopsData } = await supabase.from("shops").select("id, name, logo_url");
      const shopLikeTotals = new Map<string, number>();
      productsList.forEach((p) => shopLikeTotals.set(p.shop_id, (shopLikeTotals.get(p.shop_id) ?? 0) + (likeCounts.get(p.id) ?? 0)));
      const topShops = [...(shopsData ?? [])]
        .map((s) => ({ ...s, popularity: shopLikeTotals.get(s.id) ?? 0 }))
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 5);

      return {
        shopsCount: shopsCount ?? 0,
        productsCount: productsList.length,
        boostsActive,
        usersCount: usersCount ?? 0,
        pepitesSpent,
        topProducts,
        topShops,
        allShops: shopsData ?? [],
        allProducts: productsList,
      };
    },
  });
}

export default function AdminPage() {
  const { profile } = useAuth();
  const { t, lang } = useApp();
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const { data: metrics, isLoading } = useAdminMetrics();
  const { data: pendingRecharges = [] } = usePendingRecharges();
  const confirmRecharge = useConfirmRecharge();
  const { data: suggestions = [] } = useSuggestions();
  const { data: pepites7d } = usePepites7d();
  const { data: views7d } = useViews7d();

  if (profile && !profile.is_admin) return <Navigate to="/compte" replace />;

  async function exportAll() {
    if (!metrics) return;
    downloadCSV("dabbymarket_boutiques.csv", metrics.allShops.map((s: any) => ({ id: s.id, name: s.name })));
    downloadCSV("dabbymarket_produits.csv", metrics.allProducts.map((p: any) => ({ id: p.id, name: p.name, price_xaf: p.price_xaf, shopId: p.shop_id, boosted: !!p.boosted_until })));
    downloadCSV("dabbymarket_pepites.csv", pendingRecharges.map((r: any) => ({ id: r.id, user: r.profiles?.phone, amount: r.amount, method: r.method, status: r.status, reference: r.reference_code })));
    downloadCSV("dabbymarket_suggestions.csv", suggestions.map((s: any) => ({ id: s.id, type: s.type, text: s.text, votes: s.votes_count, author: s.profiles?.name })));
    toast.success(t("admin_exportSuccess"));
  }

  async function handleConfirm(id: string, approve: boolean) {
    try {
      await confirmRecharge.mutateAsync({ transactionId: id, approve });
      toast.success(approve ? t("admin_rechargeValidated") : t("admin_rechargeRejected"));
    } catch (err: any) {
      toast.error(t("admin_actionFailed"), { description: err.message });
    }
  }

  if (isLoading || !metrics) {
    return (
      <AppShell>
        <AdminMetricsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Bandeau admin premium */}
      <div className="relative overflow-hidden border-b border-primary/30 bg-gradient-to-br from-primary/20 via-background to-background">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-center gap-3 px-4 pt-4 pb-4">
          <Link to="/compte" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card/80 backdrop-blur transition-all hover:border-primary/40">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ShieldCheck size={13} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Console admin</span>
            </div>
            <h1 className="text-lg font-black">{t("admin_title")}</h1>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full gold-gradient px-3 py-1.5 text-[10px] font-black text-background shadow-lg shadow-primary/25">
            <ShieldCheck size={12} /> ADMIN
          </span>
        </div>
      </div>

      <div className="space-y-5 p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Metric icon={Store} label={t("admin_activeShops")} value={metrics.shopsCount.toLocaleString(locale)} tone="primary" />
          <Metric icon={Package} label={t("admin_publishedProducts")} value={metrics.productsCount.toLocaleString(locale)} />
          <Metric icon={Zap} label={t("admin_activeBoosts")} value={metrics.boostsActive.toString()} tone="primary" />
          <Metric icon={TrendingUp} label={t("admin_pepitesConsumed")} value={metrics.pepitesSpent.toLocaleString(locale)} />
          <Metric icon={Users} label={t("admin_users")} value={metrics.usersCount.toLocaleString(locale)} />
          <Metric icon={Clock} label={t("admin_pendingRecharges")} value={pendingRecharges.length.toString()} tone={pendingRecharges.length > 0 ? "alert" : undefined} />
        </div>

        <button
          onClick={exportAll}
          className="shine relative flex w-full items-center justify-center gap-2 rounded-2xl gold-gradient py-3.5 text-sm font-black text-background shadow-xl shadow-primary/25 transition-transform active:scale-[0.98]"
        >
          <Download size={16} /> {t("admin_exportAll")}
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <ChartCard title={t("admin_views7d")} data={views7d?.values ?? [0, 0, 0, 0, 0, 0, 0]} labels={views7d?.labels ?? []} />
          <ChartCard title={t("admin_pepites7d")} data={pepites7d?.values ?? [0, 0, 0, 0, 0, 0, 0]} labels={pepites7d?.labels ?? []} />
        </div>

        {pendingRecharges.length > 0 && (
          <section>
            <SectionHeader icon={Clock} title={t("admin_pendingRecharges")} count={pendingRecharges.length} />
            <div className="mt-2 space-y-2">
              {pendingRecharges.map((r: any) => (
                <div key={r.id} className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 to-card p-3 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Clock size={18} className="animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">+{r.amount} <span className="text-xs font-semibold text-muted-foreground">{t("pepites")}</span></p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {r.profiles?.phone} · {r.method} · <span className="font-mono">{r.reference_code}</span>
                    </p>
                  </div>
                  <button onClick={() => handleConfirm(r.id, false)} className="grid h-9 w-9 place-items-center rounded-full border border-destructive/60 text-destructive transition-all hover:bg-destructive hover:text-background">
                    <XCircle size={14} />
                  </button>
                  <button onClick={() => handleConfirm(r.id, true)} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--verified)] px-3 py-2 text-[11px] font-black text-background shadow-md">
                    <CheckCircle2 size={12} /> {t("common_confirm")}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeader icon={Store} title={t("admin_topShops")} />
          <div className="mt-2 space-y-1.5">
            {metrics.topShops.map((s: any, i: number) => (
              <div key={s.id} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 transition-all hover:border-primary/30">
                <RankBadge rank={i + 1} />
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm ring-2 ring-background">
                  {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                </span>
                <span className="flex-1 truncate text-sm font-semibold">{s.name}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  ❤ {s.popularity}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader icon={Package} title={t("admin_topProducts")} />
          <div className="mt-2 space-y-1.5">
            {metrics.topProducts.map((p: any, i: number) => (
              <div key={p.id} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 transition-all hover:border-primary/30">
                <RankBadge rank={i + 1} />
                <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="text-xs font-bold text-primary">{formatXAF(p.price_xaf)}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  ❤ {p.likes}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader icon={ThumbsUp} title={t("admin_userSuggestions")} count={suggestions.length} />
          <div className="mt-2 space-y-1.5">
            {[...suggestions]
              .sort((a: any, b: any) => b.votes_count - a.votes_count)
              .slice(0, 5)
              .map((s: any) => (
                <div key={s.id} className="flex items-start gap-2.5 rounded-2xl border border-border bg-card p-3">
                  <span className="flex min-w-[42px] flex-col items-center rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                    <ThumbsUp size={11} />
                    <span className="text-xs font-black">{s.votes_count}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-snug">{s.text}</p>
                    <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.type} · <span className="normal-case">{s.profiles?.name}</span>
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; tone?: "primary" | "alert" }) {
  const toneClass =
    tone === "primary"
      ? "border-primary/30 bg-gradient-to-br from-primary/12 via-card to-card"
      : tone === "alert"
      ? "border-[color:var(--verified)]/30 bg-gradient-to-br from-[color:var(--verified)]/12 via-card to-card"
      : "border-border bg-card";
  const iconTone = tone === "alert" ? "text-[color:var(--verified)]" : "text-primary";
  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}>
      <span className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
      <Icon size={18} className={`relative ${iconTone}`} />
      <p className="relative mt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="relative text-xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function ChartCard({ title, data, labels }: { title: string; data: number[]; labels: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
        <TrendingUp size={11} /> {title}
      </p>
      <MiniBarChart data={data} labels={labels} />
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count }: { icon: React.ComponentType<{ size?: number }>; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
        <Icon size={13} />
      </span>
      <h2 className="text-sm font-black tracking-tight">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-muted-foreground">{count}</span>
      )}
      <span className="ml-2 h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const isPodium = rank <= 3;
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${
        isPodium
          ? "gold-gradient text-background shadow-md shadow-primary/25"
          : "bg-accent text-muted-foreground"
      }`}
    >
      {rank}
    </span>
  );
}
