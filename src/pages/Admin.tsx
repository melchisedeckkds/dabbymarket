import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { AdminMetricsSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { MiniBarChart } from "@/components/mini-chart";
import { downloadCSV } from "@/lib/csv";
import {
  usePendingRecharges,
  useConfirmRecharge,
  useSuggestions,
  usePepites7d,
  useViews7d,
  useReports,
  useResolveReport,
  useAdminShops,
  useSetShopBlocked,
  useSetShopVerified,
  useAdminUsers,
  useSuspendAccount,
  useAdminDeleteAccount,
  useAdjustPepites,
  useAdminDeletePost,
  useAdminDeleteProduct,
  usePosts,
  useProducts,
  useAppConfig,
  usePepitePacks,
  useBoostCatalog,
} from "@/lib/queries";
import { useQueryClient, useMutation as useMutationRQ } from "@tanstack/react-query";
import { useApp } from "@/lib/app-store";
import {
  ArrowLeft,
  Download,
  Store,
  Package,
  Zap,
  TrendingUp,
  Users,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  Loader2,
  Flag,
  Lock,
  Unlock,
  BadgeCheck,
  Trash2,
  UserX,
  UserCheck,
  Coins,
  Search,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

type AdminTab = "overview" | "moderation" | "shops" | "accounts" | "content" | "economy";

export default function AdminPage() {
  const { profile } = useAuth();
  const { t, lang } = useApp();
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const [tab, setTab] = useState<AdminTab>("overview");
  const { data: metrics, isLoading } = useAdminMetrics();
  const { data: pendingRecharges = [] } = usePendingRecharges();
  const confirmRecharge = useConfirmRecharge();
  const { data: suggestions = [] } = useSuggestions();
  const { data: pepites7d } = usePepites7d();
  const { data: views7d } = useViews7d();
  const { data: reports = [] } = useReports();

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

      <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-1 no-scrollbar">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={TrendingUp} label={t("admin_tabOverview")} />
        <TabButton active={tab === "moderation"} onClick={() => setTab("moderation")} icon={Flag} label={t("admin_tabModeration")} badge={reports.length} />
        <TabButton active={tab === "shops"} onClick={() => setTab("shops")} icon={Store} label={t("admin_tabShops")} />
        <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")} icon={Users} label={t("admin_tabAccounts")} />
        <TabButton active={tab === "content"} onClick={() => setTab("content")} icon={FileText} label={t("admin_tabContent")} />
        <TabButton active={tab === "economy"} onClick={() => setTab("economy")} icon={Coins} label={t("admin_tabEconomy")} />
      </div>

      {tab === "moderation" && <ModerationTab reports={reports} />}
      {tab === "shops" && <ShopsTab />}
      {tab === "accounts" && <AccountsTab />}
      {tab === "content" && <ContentTab />}
      {tab === "economy" && <EconomyTab />}

      {tab === "overview" && (
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
      )}
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
        active ? "gold-gradient" : "border border-border bg-card text-muted-foreground"
      }`}
    >
      <Icon size={14} />
      {label}
      {!!badge && badge > 0 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  destructive,
  onConfirm,
  confirmLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  destructive?: boolean;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter className="flex-row justify-end gap-2">
          <button onClick={() => onOpenChange(false)} className="rounded-full border border-border px-4 py-2 text-xs font-bold">
            Annuler
          </button>
          <button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={`rounded-full px-4 py-2 text-xs font-bold text-white ${destructive ? "bg-destructive" : "gold-gradient !text-background"}`}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================
// ONGLET MODÉRATION — file de signalements
// =========================================================
function ModerationTab({ reports }: { reports: any[] }) {
  const { t } = useApp();
  const resolveReport = useResolveReport();

  async function handle(id: string, status: "resolved" | "dismissed") {
    try {
      await resolveReport.mutateAsync({ reportId: id, status });
      toast.success(t("admin_contentDeleted"));
    } catch (err: any) {
      toast.error(t("admin_actionFailed"), { description: err.message });
    }
  }

  return (
    <div className="space-y-2 p-4">
      <h2 className="text-sm font-semibold">{t("admin_reports")} ({reports.length})</h2>
      {reports.length === 0 && <p className="text-xs text-muted-foreground">{t("admin_noReports")}</p>}
      {reports.map((r: any) => (
        <div key={r.id} className="space-y-1.5 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Flag size={14} className="text-destructive" />
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("admin_reportTarget")}: {r.target_type}
            </span>
          </div>
          <p className="text-sm">{r.reason}</p>
          <p className="text-[10px] text-muted-foreground">
            {t("admin_reportedBy")}: {r.profiles?.name} · {new Date(r.created_at).toLocaleDateString()}
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => handle(r.id, "dismissed")} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-bold">
              {t("admin_dismiss")}
            </button>
            <button onClick={() => handle(r.id, "resolved")} className="rounded-full bg-[color:var(--verified)] px-3 py-1.5 text-[11px] font-bold text-background">
              {t("admin_resolve")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// =========================================================
// ONGLET BOUTIQUES — blocage / certification
// =========================================================
function ShopsTab() {
  const { t } = useApp();
  const { data: shops = [], isLoading } = useAdminShops();
  const setBlocked = useSetShopBlocked();
  const setVerified = useSetShopVerified();
  const [confirm, setConfirm] = useState<{ shopId: string; blocked: boolean } | null>(null);

  async function toggleVerified(shopId: string, verified: boolean) {
    try {
      await setVerified.mutateAsync({ shopId, verified: !verified });
    } catch (err: any) {
      toast.error(t("admin_actionFailed"), { description: err.message });
    }
  }

  async function applyBlock() {
    if (!confirm) return;
    try {
      await setBlocked.mutateAsync({ shopId: confirm.shopId, blocked: !confirm.blocked });
      toast.success(confirm.blocked ? t("admin_shopUnblocked") : t("admin_shopBlocked"));
    } catch (err: any) {
      toast.error(t("admin_actionFailed"), { description: err.message });
    }
  }

  if (isLoading) return <div className="p-4"><Loader2 className="animate-spin" size={18} /></div>;

  return (
    <div className="space-y-2 p-4">
      <h2 className="text-sm font-semibold">{t("admin_tabShops")} ({shops.length})</h2>
      {shops.map((s: any) => (
        <div key={s.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm">
            {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{s.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{s.profiles?.name} · {s.profiles?.phone}</p>
            <div className="mt-0.5 flex gap-1">
              {s.is_blocked && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[9px] font-bold text-destructive">{t("admin_blocked")}</span>}
              {s.verified && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">{t("admin_verified")}</span>}
            </div>
          </div>
          <button onClick={() => toggleVerified(s.id, s.verified)} className="grid h-8 w-8 place-items-center rounded-full border border-border">
            <BadgeCheck size={14} className={s.verified ? "text-primary" : "text-muted-foreground"} />
          </button>
          <button
            onClick={() => setConfirm({ shopId: s.id, blocked: s.is_blocked })}
            className={`grid h-8 w-8 place-items-center rounded-full border ${s.is_blocked ? "border-[color:var(--verified)]" : "border-destructive"}`}
          >
            {s.is_blocked ? <Unlock size={14} className="text-[color:var(--verified)]" /> : <Lock size={14} className="text-destructive" />}
          </button>
        </div>
      ))}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm?.blocked ? t("admin_unblockShop") : t("admin_blockShop")}
        description={t("admin_blockShopConfirm")}
        destructive={!confirm?.blocked}
        confirmLabel={confirm?.blocked ? t("admin_unblockShop") : t("admin_blockShop")}
        onConfirm={applyBlock}
      />
    </div>
  );
}

// =========================================================
// ONGLET COMPTES — recherche, suspension, suppression, Pépites
// =========================================================
function AccountsTab() {
  const { t } = useApp();
  const { data: users = [], isLoading } = useAdminUsers();
  const suspend = useSuspendAccount();
  const deleteAccount = useAdminDeleteAccount();
  const adjustPepites = useAdjustPepites();
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const filtered = users.filter(
    (u: any) => u.name?.toLowerCase().includes(query.toLowerCase()) || u.phone?.includes(query),
  );

  async function toggleSuspend(userId: string, suspended: boolean) {
    try {
      await suspend.mutateAsync({ userId, suspended: !suspended });
      toast.success(suspended ? t("admin_accountReactivated") : t("admin_accountSuspended"));
    } catch (err: any) {
      toast.error(t("admin_actionFailed"), { description: err.message });
    }
  }

  async function confirmDeleteAccount() {
    if (!confirmDelete) return;
    try {
      await deleteAccount.mutateAsync(confirmDelete);
      toast.success(t("admin_accountDeleted"));
    } catch (err: any) {
      toast.error(t("admin_actionFailed"), { description: err.message });
    } finally {
      setConfirmDelete(null);
    }
  }

  async function applyAdjust() {
    if (!adjustTarget || !amount) return;
    try {
      await adjustPepites.mutateAsync({ userId: adjustTarget, amount: Number(amount), note });
      toast.success(t("admin_adjustPepitesDone"));
      setAdjustTarget(null);
      setAmount("");
      setNote("");
    } catch (err: any) {
      toast.error(t("admin_actionFailed"), { description: err.message });
    }
  }

  if (isLoading) return <div className="p-4"><Loader2 className="animate-spin" size={18} /></div>;

  return (
    <div className="space-y-2 p-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin_searchAccount")}
          className="w-full rounded-full border border-border bg-card py-2 pl-8 pr-3 text-xs"
        />
      </div>
      {filtered.map((u: any) => (
        <div key={u.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm">
            {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{u.name} {u.is_admin && <ShieldCheck size={11} className="inline text-primary" />}</p>
            <p className="truncate text-[10px] text-muted-foreground">{u.phone} · {u.pepites_balance} {t("pepites")}</p>
            {u.is_blocked && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[9px] font-bold text-destructive">{t("admin_suspended")}</span>}
          </div>
          {!u.is_admin && (
            <>
              <button onClick={() => setAdjustTarget(u.id)} className="grid h-8 w-8 place-items-center rounded-full border border-border">
                <Coins size={14} className="text-primary" />
              </button>
              <button onClick={() => toggleSuspend(u.id, u.is_blocked)} className="grid h-8 w-8 place-items-center rounded-full border border-border">
                {u.is_blocked ? <UserCheck size={14} className="text-[color:var(--verified)]" /> : <UserX size={14} className="text-amber-500" />}
              </button>
              <button onClick={() => setConfirmDelete(u.id)} className="grid h-8 w-8 place-items-center rounded-full border border-destructive">
                <Trash2 size={14} className="text-destructive" />
              </button>
            </>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title={t("admin_deleteAccount")}
        description={t("admin_deleteAccountConfirm")}
        destructive
        confirmLabel={t("common_delete")}
        onConfirm={confirmDeleteAccount}
      />

      <Dialog open={!!adjustTarget} onOpenChange={(v) => !v && setAdjustTarget(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{t("admin_adjustPepites")}</DialogTitle>
          </DialogHeader>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            placeholder={t("admin_adjustPepitesAmount")}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("admin_adjustPepitesNote")}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
          />
          <DialogFooter className="flex-row justify-end gap-2">
            <button onClick={() => setAdjustTarget(null)} className="rounded-full border border-border px-4 py-2 text-xs font-bold">
              Annuler
            </button>
            <button onClick={applyAdjust} className="rounded-full gold-gradient px-4 py-2 text-xs font-bold">
              {t("admin_adjustPepitesApply")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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


// ============================================================
// MODÉRATION DES CONTENUS — l'administrateur peut supprimer
// définitivement n'importe quelle publication ou n'importe quel
// article, sans passer par un signalement préalable.
// ============================================================
function ContentTab() {
  const { t } = useApp();
  const { data: posts = [], isLoading: loadingPosts } = usePosts();
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const deletePost = useAdminDeletePost();
  const deleteProduct = useAdminDeleteProduct();
  const [confirm, setConfirm] = useState<{ kind: "post" | "product"; id: string; label: string } | null>(null);

  async function handleDelete() {
    if (!confirm) return;
    try {
      if (confirm.kind === "post") await deletePost.mutateAsync(confirm.id);
      else await deleteProduct.mutateAsync(confirm.id);
      toast.success(t("admin_contentDeleted"));
    } catch (err: any) {
      toast.error(t("admin_actionFailed"), { description: err.message });
    } finally {
      setConfirm(null);
    }
  }

  const empty = !loadingPosts && !loadingProducts && posts.length === 0 && products.length === 0;

  return (
    <div className="space-y-5 p-4">
      {empty && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {t("admin_noContent")}
        </p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("admin_recentPosts")}</h2>
        <div className="space-y-2">
          {posts.slice(0, 30).map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{p.profiles?.name ?? "—"}</p>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">{p.text}</p>
              </div>
              <button
                onClick={() => setConfirm({ kind: "post", id: p.id, label: t("admin_deletePost") })}
                aria-label={t("admin_deletePost")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-destructive"
              >
                <Trash2 size={14} className="text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("admin_recentProducts")}</h2>
        <div className="space-y-2">
          {products.slice(0, 30).map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{p.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {p.shops?.name ?? "—"} · {formatXAF(p.price_xaf)}
                </p>
              </div>
              <button
                onClick={() => setConfirm({ kind: "product", id: p.id, label: t("admin_deleteProduct") })}
                aria-label={t("admin_deleteProduct")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-destructive"
              >
                <Trash2 size={14} className="text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.label ?? ""}
        description={t("admin_deleteConfirm")}
        destructive
        confirmLabel={t("common_delete")}
        onOpenChange={(v) => !v && setConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// =========================================================
// ONGLET ÉCONOMIE — quota gratuit, packs, catalogue de boosts
// (Modèle 1) : tout modifiable sans déploiement de code.
// =========================================================
function EconomyTab() {
  const { t } = useApp();
  const qc = useQueryClient();
  const { data: config } = useAppConfig();
  const { data: packs = [] } = usePepitePacks();
  const { data: catalog = [] } = useBoostCatalog();

  const updateConfig = useMutationRQ({
    mutationFn: async (input: { key: string; value: number }) => {
      const { error } = await supabase.rpc("admin_update_config", { p_key: input.key, p_value: input.value });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-config"] }),
  });

  const updatePack = useMutationRQ({
    mutationFn: async (input: { id: string; pepites: number; price_fcfa: number; active: boolean }) => {
      const { error } = await supabase.rpc("admin_update_pack", { p_id: input.id, p_pepites: input.pepites, p_price_fcfa: input.price_fcfa, p_active: input.active });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pepite-packs"] }),
  });

  const updateBoost = useMutationRQ({
    mutationFn: async (input: { id: string; cost_pepites: number; active: boolean }) => {
      const { error } = await supabase.rpc("admin_update_boost_price", { p_id: input.id, p_cost_pepites: input.cost_pepites, p_active: input.active });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boost-catalog"] }),
  });

  const [editedConfig, setEditedConfig] = useState<Record<string, string>>({});
  const [editedPacks, setEditedPacks] = useState<Record<string, { pepites: string; price_fcfa: string }>>({});
  const [editedBoosts, setEditedBoosts] = useState<Record<string, string>>({});

  const configLabels: Record<string, string> = {
    free_active_listings_quota: t("admin_cfgQuota"),
    quota_overage_price_pepites: t("admin_cfgOveragePrice"),
    welcome_bonus_amount: t("admin_cfgBonusAmount"),
    welcome_bonus_expiry_days: t("admin_cfgBonusExpiry"),
    max_shops_per_phone: t("admin_cfgMaxShopsPerPhone"),
    max_accounts_per_device_24h: t("admin_cfgMaxAccountsPerDevice"),
    home_featured_slots_per_day: t("admin_cfgHomeSlots"),
    boost_rank_bonus_cap: t("admin_cfgRankCap"),
  };

  return (
    <div className="space-y-5 p-4">
      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("admin_cfgTitle")}</h2>
        <div className="space-y-2">
          {config &&
            Object.entries(config).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                <span className="flex-1 text-xs text-muted-foreground">{configLabels[key] ?? key}</span>
                <input
                  type="number"
                  defaultValue={String(value)}
                  onChange={(e) => setEditedConfig((s) => ({ ...s, [key]: e.target.value }))}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs"
                />
                <button
                  onClick={() => updateConfig.mutate({ key, value: Number(editedConfig[key] ?? value) })}
                  className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground"
                >
                  {t("common_save")}
                </button>
              </div>
            ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("admin_cfgPacks")}</h2>
        <div className="space-y-2">
          {packs.map((p: any) => {
            const edited = editedPacks[p.id] ?? { pepites: String(p.pepites), price_fcfa: String(p.price_fcfa) };
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-2.5">
                <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
                  {p.label}
                  <span className={p.active ? "text-[color:var(--verified)]" : "text-muted-foreground"}>{p.active ? t("admin_active") : t("admin_inactive")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={edited.pepites}
                    onChange={(e) => setEditedPacks((s) => ({ ...s, [p.id]: { ...edited, pepites: e.target.value } }))}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">{t("pepites")}</span>
                  <span className="text-muted-foreground">=</span>
                  <input
                    type="number"
                    value={edited.price_fcfa}
                    onChange={(e) => setEditedPacks((s) => ({ ...s, [p.id]: { ...edited, price_fcfa: e.target.value } }))}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">FCFA</span>
                  <button
                    onClick={() => updatePack.mutate({ id: p.id, pepites: Number(edited.pepites), price_fcfa: Number(edited.price_fcfa), active: p.active })}
                    className="ml-auto rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground"
                  >
                    {t("common_save")}
                  </button>
                  <button
                    onClick={() => updatePack.mutate({ id: p.id, pepites: p.pepites, price_fcfa: p.price_fcfa, active: !p.active })}
                    className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold"
                  >
                    {p.active ? t("admin_deactivate") : t("admin_activate")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("admin_cfgBoosts")}</h2>
        <div className="space-y-1.5">
          {catalog.map((b: any) => (
            <div key={b.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
              <span className="flex-1 truncate text-xs">{b.label}</span>
              <input
                type="number"
                defaultValue={b.cost_pepites}
                onChange={(e) => setEditedBoosts((s) => ({ ...s, [b.id]: e.target.value }))}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs"
              />
              <span className="text-[10px] text-muted-foreground">{t("pepites")}</span>
              <button
                onClick={() => updateBoost.mutate({ id: b.id, cost_pepites: Number(editedBoosts[b.id] ?? b.cost_pepites), active: b.active })}
                className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground"
              >
                {t("common_save")}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{t("admin_cfgBoostsHint")}</p>
      </section>
    </div>
  );
}
