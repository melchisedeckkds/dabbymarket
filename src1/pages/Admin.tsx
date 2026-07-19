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

      // Popularité produits (par coups de cœur)
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
    downloadCSV(
      "dabbymarket_boutiques.csv",
      metrics.allShops.map((s: any) => ({ id: s.id, name: s.name })),
    );
    downloadCSV(
      "dabbymarket_produits.csv",
      metrics.allProducts.map((p: any) => ({ id: p.id, name: p.name, price_xaf: p.price_xaf, shopId: p.shop_id, boosted: !!p.boosted_until })),
    );
    downloadCSV(
      "dabbymarket_pepites.csv",
      pendingRecharges.map((r: any) => ({ id: r.id, user: r.profiles?.phone, amount: r.amount, method: r.method, status: r.status, reference: r.reference_code })),
    );
    downloadCSV(
      "dabbymarket_suggestions.csv",
      suggestions.map((s: any) => ({ id: s.id, type: s.type, text: s.text, votes: s.votes_count, author: s.profiles?.name })),
    );
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
      <div className="flex items-center gap-2 px-4 pt-3">
        <Link to="/compte" className="grid h-9 w-9 place-items-center rounded-full bg-card">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">{t("admin_title")}</h1>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">
          <ShieldCheck size={12} /> Admin
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Metric icon={Store} label={t("admin_activeShops")} value={metrics.shopsCount.toLocaleString(locale)} />
          <Metric icon={Package} label={t("admin_publishedProducts")} value={metrics.productsCount.toLocaleString(locale)} />
          <Metric icon={Zap} label={t("admin_activeBoosts")} value={metrics.boostsActive.toString()} />
          <Metric icon={TrendingUp} label={t("admin_pepitesConsumed")} value={metrics.pepitesSpent.toLocaleString(locale)} />
          <Metric icon={Users} label={t("admin_users")} value={metrics.usersCount.toLocaleString(locale)} />
          <Metric icon={Clock} label={t("admin_pendingRecharges")} value={pendingRecharges.length.toString()} />
        </div>

        <button onClick={exportAll} className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3 text-sm font-bold">
          <Download size={16} /> {t("admin_exportAll")}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <ChartCard title={t("admin_views7d")} data={views7d?.values ?? [0, 0, 0, 0, 0, 0, 0]} labels={views7d?.labels ?? []} />
          <ChartCard title={t("admin_pepites7d")} data={pepites7d?.values ?? [0, 0, 0, 0, 0, 0, 0]} labels={pepites7d?.labels ?? []} />
        </div>

        {pendingRecharges.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">{t("admin_pendingRecharges")} ({pendingRecharges.length})</h2>
            <div className="space-y-2">
              {pendingRecharges.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <Clock size={18} className="text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">+{r.amount} {t("pepites")}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {r.profiles?.phone} · {r.method} · {r.reference_code}
                    </p>
                  </div>
                  <button onClick={() => handleConfirm(r.id, false)} className="rounded-full border border-destructive px-2.5 py-1.5 text-[11px] font-bold text-destructive">
                    <XCircle size={12} className="inline" />
                  </button>
                  <button onClick={() => handleConfirm(r.id, true)} className="rounded-full bg-[color:var(--verified)] px-3 py-1.5 text-[11px] font-bold text-background">
                    <CheckCircle2 size={12} className="inline" /> {t("common_confirm")}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("admin_topShops")}</h2>
          <div className="space-y-1.5">
            {metrics.topShops.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                <span className="w-4 text-xs font-bold text-muted-foreground">#{i + 1}</span>
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-accent text-sm">
                  {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                </span>
                <span className="flex-1 truncate text-sm font-semibold">{s.name}</span>
                <span className="text-xs text-muted-foreground">❤️ {s.popularity}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("admin_topProducts")}</h2>
          <div className="space-y-1.5">
            {metrics.topProducts.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                <span className="w-4 text-xs font-bold text-muted-foreground">#{i + 1}</span>
                <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="text-xs text-muted-foreground">{formatXAF(p.price_xaf)}</span>
                <span className="text-xs text-primary">❤️ {p.likes}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("admin_userSuggestions")} ({suggestions.length})</h2>
          <div className="space-y-1.5">
            {[...suggestions]
              .sort((a: any, b: any) => b.votes_count - a.votes_count)
              .slice(0, 5)
              .map((s: any) => (
                <div key={s.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-2.5">
                  <span className="flex flex-col items-center rounded bg-background px-1.5 py-1 text-[10px] font-bold text-primary">
                    <ThumbsUp size={10} />
                    {s.votes_count}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{s.text}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {s.type} · {s.profiles?.name}
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

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <Icon size={16} className="text-primary" />
      <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function ChartCard({ title, data, labels }: { title: string; data: number[]; labels: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <MiniBarChart data={data} labels={labels} />
    </div>
  );
}
