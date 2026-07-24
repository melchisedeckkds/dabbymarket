import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { useApp } from "@/lib/app-store";
import { useAuth } from "@/lib/auth";
import { useWishlist, useMyShops, useMyTransactions, useMyViews7d, useMoveProduct } from "@/lib/queries";
import { Pepite } from "@/components/pepite";
import { MiniBarChart } from "@/components/mini-chart";
import { ShopListSkeleton } from "@/components/skeletons";
import { useEffect, useState } from "react";
import {
  Bookmark, Heart, Star, Store, Moon, Sun, Languages, Settings, ChevronRight,
  ShoppingBag, LogOut, Sparkles, TrendingUp, ShieldCheck, MessageSquarePlus,
  LayoutDashboard, Plus, Loader2, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/product-card";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function useFollowedShops() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["followed-shops", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("follows").select("*, shops(*)").eq("follower_id", session!.user.id);
      if (error) throw error;
      return data;
    },
  });
}

function useMyShopStats(shopIds: string[]) {
  return useQuery({
    queryKey: ["my-shop-stats", shopIds],
    enabled: shopIds.length > 0,
    queryFn: async () => {
      const { data: myProducts } = await supabase.from("products").select("id, name, shop_id, images, boosted_until").in("shop_id", shopIds);
      const productIds = (myProducts ?? []).map((p) => p.id);
      const boostsActive = (myProducts ?? []).filter((p) => p.boosted_until && new Date(p.boosted_until).getTime() > Date.now()).length;

      let likesCount = 0;
      if (productIds.length > 0) {
        const { count } = await supabase.from("likes").select("id", { count: "exact", head: true }).in("product_id", productIds);
        likesCount = count ?? 0;
      }

      const { data: reviewsData } = await supabase.from("reviews").select("rating").in("shop_id", shopIds);
      const avgRating = reviewsData?.length ? (reviewsData.reduce((s, r) => s + r.rating, 0) / reviewsData.length).toFixed(1) : "—";

      return { productsCount: productIds.length, productIds, products: myProducts ?? [], boostsActive, likesCount, avgRating };
    },
  });
}

export default function ComptePage() {
  const { theme, toggleTheme, lang, setLang, dataSaver, toggleDataSaver, t } = useApp();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"achats" | "boutique">("achats");
  const { data: wishlistData = [] } = useWishlist();
  const { data: followedShops = [] } = useFollowedShops();
  const { data: myShops = [], isLoading: loadingShops } = useMyShops();
  const { data: transactions = [] } = useMyTransactions();

  const shopIds = myShops.map((s: any) => s.id);
  const { data: stats } = useMyShopStats(shopIds);
  const { data: views7d } = useMyViews7d(shopIds, stats?.productIds ?? []);
  const moveProduct = useMoveProduct();
  const pepitesSpent = transactions.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

  async function handleLogout() {
    await signOut();
    navigate("/auth");
  }

  return (
    <AppShell>
      <div className="relative p-4">
        {/* Halo décoratif */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(212,175,55,0.12),transparent_70%)]" />

        {/* Carte profil premium */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-4 shadow-xl shadow-primary/10">
          <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/25 blur-3xl" />
          <span className="absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-yellow-300/15 blur-3xl" />

          <div className="relative flex items-center gap-3.5">
            <div className="relative">
              <div className="absolute inset-0 -m-0.5 rounded-full bg-gradient-to-br from-primary to-yellow-400 blur opacity-70" />
              <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full ring-4 ring-background gold-gradient text-xl font-black text-background">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-black tracking-tight">{profile?.name ?? "…"}</p>
              <p className="text-[11px] font-medium text-muted-foreground">{profile?.phone}</p>
            </div>
            <Link
              to="/recharge"
              className="group flex items-center gap-1.5 rounded-2xl border border-primary/40 bg-background/60 px-3 py-2 text-sm font-black text-primary shadow-md backdrop-blur transition-all hover:scale-105 hover:bg-primary hover:text-primary-foreground"
            >
              <Pepite size={16} /> {profile?.pepites_balance ?? 0}
            </Link>
          </div>
          {profile?.is_admin && (
            <Link
              to="/admin"
              className="relative mt-3.5 flex items-center gap-2 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-3 py-2.5 text-[11px] font-black text-primary transition-all hover:from-primary/30"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full gold-gradient text-background shadow">
                <ShieldCheck size={12} />
              </span>
              {t("nav_admin")}
              <ChevronRight size={14} className="ml-auto" />
            </Link>
          )}
        </div>

        {/* Tabs premium */}
        <div className="relative mt-5 grid grid-cols-2 rounded-2xl border border-border bg-card p-1 shadow-sm">
          {(
            [
              ["achats", t("compte_myPurchases"), ShoppingBag],
              ["boutique", t("compte_myShop"), Store],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all",
                tab === k ? "gold-gradient text-background shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === "achats" && (
          <div className="mt-4 space-y-5">
            <Section title={t("compte_wishlist")} icon={Bookmark} count={wishlistData.length}>
              {wishlistData.length === 0 ? (
                <Empty cta={{ to: "/", label: t("messages_discoverCta") }}>{t("compte_noWishlist")}</Empty>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {wishlistData.map((w: any) => (
                    <Link
                      key={w.product_id}
                      to={`/produit/${w.product_id}`}
                      className="group overflow-hidden rounded-2xl border border-border transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                    >
                      <div className="relative aspect-square overflow-hidden bg-accent">
                        {w.products?.images?.[0] && (
                          <img src={w.products.images[0]} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-1 text-[11px] font-semibold">{w.products?.name}</p>
                        <p className="text-[11px] font-black text-primary">{w.products ? formatXAF(w.products.price_xaf) : ""}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            <Section title={t("compte_followedShops")} icon={Store} count={followedShops.length}>
              {followedShops.length === 0 ? (
                <Empty cta={{ to: "/carte", label: t("nav_carte") }}>{t("compte_noFollowedShops")}</Empty>
              ) : (
                <div className="space-y-2">
                  {followedShops.map((f: any) => (
                    <Link
                      key={f.shop_id}
                      to={`/boutique/${f.shop_id}`}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30"
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-lg ring-2 ring-background">
                        {f.shops?.logo_url ? <img src={f.shops.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold">{f.shops?.name}</span>
                          {f.shops?.verified && <VerifiedBadge />}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {tab === "boutique" && (
          <div className="mt-4 space-y-5">
            {loadingShops ? (
              <ShopListSkeleton />
            ) : myShops.length === 0 ? (
              <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-8 text-center shadow-inner">
                <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
                <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl gold-gradient shadow-lg shadow-primary/25">
                  <Store size={24} className="text-background" />
                </div>
                <h3 className="relative mt-4 text-lg font-black">{t("compte_noShop")}</h3>
                <p className="relative mt-1 text-xs text-muted-foreground">{t("compte_noShopDesc")}</p>
                <Link
                  to="/creer-boutique"
                  className="shine relative mt-5 inline-flex items-center gap-2 rounded-2xl gold-gradient px-5 py-3 text-sm font-black text-background shadow-lg shadow-primary/25"
                >
                  <Plus size={15} /> {t("compte_createShop")}
                </Link>
              </div>
            ) : (
              <>
                <UserDashboard
                  totalShops={myShops.length}
                  pepitesSpent={pepitesSpent}
                  boostsActive={stats?.boostsActive ?? 0}
                  likesCount={stats?.likesCount ?? 0}
                  avgRating={stats?.avgRating ?? "—"}
                  views7d={views7d}
                />

                {myShops.length > 1 && stats && stats.products.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-black">
                      <Settings size={13} className="text-primary" /> {t("compte_manageProducts")}
                    </h3>
                    <div className="space-y-2">
                      {stats.products.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
                          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent text-sm">
                            {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <p className="min-w-0 flex-1 truncate text-xs font-bold">{p.name}</p>
                          <select
                            defaultValue={p.shop_id}
                            onChange={(e) => {
                              if (e.target.value === p.shop_id) return;
                              moveProduct.mutate(
                                { productId: p.id, newShopId: e.target.value },
                                { onSuccess: () => toast.success(t("compte_productTransferred")) },
                              );
                            }}
                            className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-bold"
                          >
                            {myShops.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-sm font-black">
                      <Store size={13} className="text-primary" /> {t("compte_myShops")}
                      <span className="rounded-full bg-accent px-1.5 text-[10px] font-black text-muted-foreground">{myShops.length}</span>
                    </h3>
                    <Link to="/creer-boutique" className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary transition-all hover:bg-primary hover:text-primary-foreground">
                      <Plus size={12} /> {t("compte_createAnother")}
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {myShops.map((s: any) => (
                      <Link
                        key={s.id}
                        to={`/boutique/${s.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30"
                      >
                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-xl ring-2 ring-background">
                          {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{s.name}</p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.category}</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Réglages */}
        <div className="mt-6">
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Settings size={11} /> Préférences
          </p>
          <div className="space-y-2">
            <Row to="/suggestions" icon={MessageSquarePlus} label={t("compte_suggestFeature")} />
            <Row to="/cgu" icon={FileText} label={t("compte_terms")} />
            <Row onClick={toggleTheme} icon={theme === "dark" ? Sun : Moon} label={theme === "dark" ? "🌙 Mode Nuit" : "☀️ Mode Jour"} />
            <Row icon={Languages} label={`${t("compte_language")} : ${lang === "fr" ? "Français" : "English"}`} onClick={() => setLang(lang === "fr" ? "en" : "fr")} />
            <Row icon={TrendingUp} label={`${t("compte_dataSaverMode")} — ${dataSaver ? t("common_on") : t("common_off")}`} onClick={toggleDataSaver} />
            <Row icon={LogOut} label={t("compte_logout")} onClick={handleLogout} destructive />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function UserDashboard({
  totalShops, pepitesSpent, boostsActive, likesCount, avgRating, views7d,
}: {
  totalShops: number; pepitesSpent: number; boostsActive: number; likesCount: number; avgRating: string;
  views7d?: { values: number[]; labels: string[] };
}) {
  const { t } = useApp();
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/12 via-card to-card shadow-lg shadow-primary/5">
      <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative flex items-center gap-2 border-b border-primary/20 bg-gradient-to-r from-primary/15 to-transparent px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-lg gold-gradient text-background shadow">
          <LayoutDashboard size={13} />
        </span>
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">{t("compte_dashboard")}</p>
      </div>
      <div className="relative grid grid-cols-3 gap-2 p-3">
        <Stat icon={Heart} label={t("compte_likesReceived")} value={likesCount.toString()} />
        <Stat icon={Star} label={t("compte_rating")} value={avgRating} />
        <Stat icon={Store} label={t("compte_shopsCount")} value={totalShops.toString()} />
        <Stat icon={Sparkles} label={t("compte_activeBoosts")} value={boostsActive.toString()} />
        <Stat icon={Pepite as unknown as React.ComponentType<{ size?: number; className?: string }>} label={t("compte_pepitesSpent")} value={pepitesSpent.toString()} />
        <Stat icon={TrendingUp} label={t("compte_views7d")} value={String((views7d?.values ?? []).reduce((a, b) => a + b, 0))} />
      </div>
      {views7d && (
        <div className="relative border-t border-primary/20 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-primary">
            <TrendingUp size={11} /> {t("compte_views7d")}
          </p>
          <MiniBarChart data={views7d.values} labels={views7d.labels} />
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: React.ComponentType<{ size?: number }>; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
          <Icon size={13} />
        </span>
        <h3 className="text-sm font-black tracking-tight">{title}</h3>
        {count !== undefined && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-muted-foreground">{count}</span>}
        <span className="ml-2 h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      </div>
      {children}
    </div>
  );
}

function Empty({ children, cta }: { children: React.ReactNode; cta?: { to: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center">
      <p className="text-xs text-muted-foreground">{children}</p>
      {cta && (
        <Link to={cta.to} className="mt-2.5 inline-block rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-black text-primary transition-all hover:bg-primary hover:text-primary-foreground">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="group rounded-xl border border-border bg-background/60 p-2.5 text-center shadow-sm backdrop-blur transition-all hover:border-primary/30 hover:shadow-md">
      <Icon size={16} className="mx-auto text-primary" />
      <p className="mt-1 text-base font-black tracking-tight">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({
  icon: Icon, label, onClick, to, destructive,
}: { icon: React.ComponentType<{ size?: number }>; label: string; onClick?: () => void; to?: string; destructive?: boolean }) {
  const className = cn(
    "group flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
    destructive && "text-destructive hover:border-destructive/40",
  );
  const content = (
    <>
      <span className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
        destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
      )}>
        <Icon size={15} />
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </>
  );
  if (to) return <Link to={to} className={className}>{content}</Link>;
  return <button onClick={onClick} className={className}>{content}</button>;
}
