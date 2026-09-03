import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { useApp } from "@/lib/app-store";
import { useAuth } from "@/lib/auth";
import { useWishlist, useMyShops, useMyTransactions, useMyViews7d, useMoveProduct, useUpdateProfile, useUpdateShop, uploadImage, useMyFlashListings, useMarkFlashStatus } from "@/lib/queries";
import { compressImage } from "@/lib/image";
import { Pepite } from "@/components/pepite";
import { MiniBarChart } from "@/components/mini-chart";
import { ShopListSkeleton } from "@/components/skeletons";
import { useEffect, useRef, useState } from "react";
import {
  Bookmark, Heart, Star, Store, Moon, Sun, Languages, Settings, ChevronRight,
  ShoppingBag, LogOut, Sparkles, TrendingUp, ShieldCheck, MessageSquarePlus,
  LayoutDashboard, Plus, Loader2, FileText, Camera, Zap, CheckCircle2, Trash2,
} from "lucide-react";
import { formatFlashRemaining } from "@/lib/flash";
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

      return {
        productsCount: productIds.length,
        productIds,
        products: myProducts ?? [],
        boostsActive,
        likesCount,
        avgRating,
      };
    },
  });
}

export default function ComptePage() {
  const { theme, toggleTheme, lang, setLang, dataSaver, toggleDataSaver, t } = useApp();
  const { profile, signOut, session } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"achats" | "boutique" | "flash">("achats");
  const { data: wishlistData = [] } = useWishlist();
  const { data: followedShops = [] } = useFollowedShops();
  const { data: myShops = [], isLoading: loadingShops } = useMyShops();
  const { data: transactions = [] } = useMyTransactions();

  const shopIds = myShops.map((s: any) => s.id);
  const { data: stats } = useMyShopStats(shopIds);
  const { data: views7d } = useMyViews7d(shopIds, stats?.productIds ?? []);
  const moveProduct = useMoveProduct();
  const updateProfile = useUpdateProfile();
  const updateShop = useUpdateShop();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingShopId, setUploadingShopId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const shopLogoInputRef = useRef<HTMLInputElement>(null);
  const shopBeingEdited = useRef<string | null>(null);
  const pepitesSpent = transactions.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !session) return;
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file, 500, 0.8);
      const url = await uploadImage("avatars", session.user.id, compressed);
      await updateProfile.mutateAsync({ avatar_url: url });
      toast.success(t("compte_avatarUpdated"));
    } catch (err: any) {
      toast.error(t("compte_photoUpdateFailed"), { description: err.message });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleShopLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const shopId = shopBeingEdited.current;
    e.target.value = "";
    if (!file || !session || !shopId) return;
    setUploadingShopId(shopId);
    try {
      const compressed = await compressImage(file, 500, 0.8);
      const url = await uploadImage("shop-logos", session.user.id, compressed);
      await updateShop.mutateAsync({ shopId, logo_url: url });
      toast.success(t("compte_shopLogoUpdated"));
    } catch (err: any) {
      toast.error(t("compte_photoUpdateFailed"), { description: err.message });
    } finally {
      setUploadingShopId(null);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate("/auth");
  }

  return (
    <AppShell>
      <div className="p-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full gold-gradient text-xl font-bold"
              aria-label={t("compte_editAvatar")}
            >
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile?.name?.[0]?.toUpperCase() ?? "?"}
              <span className="absolute inset-0 grid place-items-center bg-background/40">
                {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              </span>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold">{profile?.name ?? "…"}</p>
              <p className="text-xs text-muted-foreground">{profile?.phone}</p>
            </div>
            <Link to="/recharge" className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-bold text-primary">
              <Pepite size={16} /> {profile?.pepites_balance ?? 0}
            </Link>
          </div>
          {profile?.is_admin && (
            <Link to="/admin" className="mt-3 flex items-center gap-2 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 to-transparent px-3 py-2 text-[11px] font-semibold text-primary transition-all hover:from-primary/25">
              <ShieldCheck size={14} /> {t("nav_admin")}
              <ChevronRight size={14} className="ml-auto" />
            </Link>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 rounded-xl border border-border bg-card p-1">
          {([
            ["achats", t("compte_myPurchases"), ShoppingBag],
            ["boutique", t("compte_myShop"), Store],
            ["flash", t("flash_myListings"), Zap],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === "achats" && (
          <div className="mt-4 space-y-4">
            <Section title={t("compte_wishlist")} icon={Bookmark} count={wishlistData.length}>
              {wishlistData.length === 0 ? (
                <Empty cta={{ to: "/", label: t("messages_discoverCta") }}>{t("compte_noWishlist")}</Empty>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {wishlistData.map((w: any) => (
                    <Link key={w.product_id} to={`/produit/${w.product_id}`} className="overflow-hidden rounded-xl border border-border">
                      <div className="relative aspect-square bg-accent">
                        {w.products?.images?.[0] && <img src={w.products.images[0]} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="p-1.5">
                        <p className="line-clamp-1 text-[11px] font-semibold">{w.products?.name}</p>
                        <p className="text-[11px] font-bold text-primary">{w.products ? formatXAF(w.products.price_xaf) : ""}</p>
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
                    <Link key={f.shop_id} to={`/boutique/${f.shop_id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-lg">
                        {f.shops?.logo_url ? <img src={f.shops.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{f.shops?.name}</span>
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
          <div className="mt-4 space-y-4">
            {loadingShops ? (
              <ShopListSkeleton />
            ) : myShops.length === 0 ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full gold-gradient text-2xl">
                  <Store />
                </div>
                <h3 className="mt-3 text-base font-bold">{t("compte_noShop")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t("compte_noShopDesc")}</p>
                <Link to="/creer-boutique" className="mt-4 inline-flex items-center gap-2 rounded-xl gold-gradient px-4 py-2.5 text-sm font-bold">
                  {t("compte_createShop")}
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
                    <h3 className="mb-2 text-sm font-semibold">{t("compte_manageProducts")}</h3>
                    <div className="space-y-2">
                      {stats.products.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent text-sm">
                            {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <p className="min-w-0 flex-1 truncate text-xs font-semibold">{p.name}</p>
                          <select
                            defaultValue={p.shop_id}
                            onChange={(e) => {
                              if (e.target.value === p.shop_id) return;
                              moveProduct.mutate(
                                { productId: p.id, newShopId: e.target.value },
                                { onSuccess: () => toast.success(t("compte_productTransferred")) },
                              );
                            }}
                            className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-medium"
                          >
                            {myShops.map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{t("compte_myShops")} ({myShops.length})</h3>
                    <Link to="/creer-boutique" className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                      <Plus size={12} /> {t("compte_createAnother")}
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {myShops.map((s: any) => (
                      <Link key={s.id} to={`/boutique/${s.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            shopBeingEdited.current = s.id;
                            shopLogoInputRef.current?.click();
                          }}
                          aria-label={t("compte_editShopLogo")}
                          className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-xl"
                        >
                          {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                          <span className="absolute inset-0 grid place-items-center bg-background/60">
                            {uploadingShopId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Camera size={13} />}
                          </span>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground">{s.category}</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                  <input ref={shopLogoInputRef} type="file" accept="image/*" className="hidden" onChange={handleShopLogoChange} />
                </div>
              </>
            )}
          </div>
        )}

        {tab === "flash" && <MyFlashTab />}

        {/* ===== MENU DES RÉGLAGES ===== */}
        <div className="mt-6 space-y-2">
          <Row to="/suggestions" icon={MessageSquarePlus} label={t("compte_suggestFeature")} />
          <Row to="/cgu" icon={FileText} label={t("compte_terms")} />
          
          {/* Bouton de bascule Jour / Nuit CORRIGÉ */}
          <Row 
            onClick={toggleTheme} 
            icon={theme === "dark" ? Sun : Moon} 
            label={theme === "dark" ? "🌙 Mode Nuit" : "☀️ Mode Jour"} 
          />
          
          <Row 
            icon={Languages} 
            label={`${t("compte_language")} : ${lang === "fr" ? "Français" : "English"}`} 
            onClick={() => setLang(lang === "fr" ? "en" : "fr")} 
          />
          <Row
            icon={TrendingUp}
            label={`${t("compte_dataSaverMode")} — ${dataSaver ? t("common_on") : t("common_off")}`}
            onClick={toggleDataSaver}
          />
          <Row icon={LogOut} label={t("compte_logout")} onClick={handleLogout} destructive />
        </div>
      </div>
    </AppShell>
  );
}

// ===== COMPOSANTS INTERNES =====

function UserDashboard({
  totalShops,
  pepitesSpent,
  boostsActive,
  likesCount,
  avgRating,
  views7d,
}: {
  totalShops: number;
  pepitesSpent: number;
  boostsActive: number;
  likesCount: number;
  avgRating: string;
  views7d?: { values: number[]; labels: string[] };
}) {
  const { t } = useApp();
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
      <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/10 px-4 py-2.5">
        <LayoutDashboard size={14} className="text-primary" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{t("compte_dashboard")}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        <Stat icon={Heart} label={t("compte_likesReceived")} value={likesCount.toString()} />
        <Stat icon={Star} label={t("compte_rating")} value={avgRating} />
        <Stat icon={Store} label={t("compte_shopsCount")} value={totalShops.toString()} />
        <Stat icon={Sparkles} label={t("compte_activeBoosts")} value={boostsActive.toString()} />
        <Stat icon={Pepite as unknown as React.ComponentType<{ size?: number; className?: string }>} label={t("compte_pepitesSpent")} value={pepitesSpent.toString()} />
      </div>
      {views7d && (
        <div className="border-t border-primary/20 p-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("compte_views7d")}</p>
          <MiniBarChart data={views7d.values} labels={views7d.labels} />
        </div>
      )}
    </div>
  );
}

function MyFlashTab() {
  const { t } = useApp();
  const { data: listings = [], isLoading } = useMyFlashListings();
  const markStatus = useMarkFlashStatus();

  const statusLabel: Record<string, string> = {
    active: "",
    sold: t("flash_statusSold"),
    removed: t("flash_statusRemoved"),
    expired: t("flash_statusExpired"),
    suspended: t("flash_statusSuspended"),
  };

  async function handleMark(id: string, status: "sold" | "removed") {
    try {
      await markStatus.mutateAsync({ flashId: id, status });
      toast.success(status === "sold" ? t("flash_soldToast") : t("flash_removedToast"));
    } catch (err: any) {
      toast.error(t("flash_actionFailed"), { description: err.message });
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Link to="/vendre-rapidement" className="flex items-center justify-center gap-2 rounded-xl gold-gradient py-3 text-sm font-bold">
        <Zap size={16} /> {t("flash_createOne")}
      </Link>

      {isLoading ? (
        <ShopListSkeleton />
      ) : listings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{t("flash_noListings")}</p>
      ) : (
        <div className="space-y-2">
          {listings.map((f: any) => {
            const remaining = f.status === "active" ? formatFlashRemaining(f.expires_at, {
              expired: t("flash_expired"),
              hoursLeft: (n) => `${n} ${t("flash_hoursLeft")}`,
              daysLeft: (n) => `${n} ${t("flash_daysLeft")}`,
            }) : null;
            return (
              <div key={f.id} className="rounded-xl border border-border bg-card p-3">
                <Link to={`/flash/${f.id}`} className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent text-lg">
                    {f.images?.[0] ? <img src={f.images[0]} alt="" className="h-full w-full object-cover" /> : "⚡"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.price_xaf.toLocaleString("fr-FR")} FCFA
                      {f.status === "active" ? ` · ${t("flash_expiresIn")} ${remaining}` : ` · ${statusLabel[f.status]}`}
                    </p>
                  </div>
                </Link>
                {f.status === "active" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={() => handleMark(f.id, "sold")} className="flex items-center justify-center gap-1 rounded-lg bg-[color:var(--verified)] py-2 text-[11px] font-bold text-background">
                      <CheckCircle2 size={12} /> {t("flash_markSold")}
                    </button>
                    <button onClick={() => handleMark(f.id, "removed")} className="flex items-center justify-center gap-1 rounded-lg border border-destructive py-2 text-[11px] font-bold text-destructive">
                      <Trash2 size={12} /> {t("flash_remove")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: React.ComponentType<{ size?: number }>; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={16} />
        <h3 className="text-sm font-semibold">{title}</h3>
        {count !== undefined && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-muted-foreground">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children, cta }: { children: React.ReactNode; cta?: { to: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-4 text-center">
      <p className="text-xs text-muted-foreground">{children}</p>
      {cta && (
        <Link to={cta.to} className="mt-2 inline-block rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5 text-center">
      <Icon size={16} className="mx-auto text-primary" />
      <p className="mt-1 text-sm font-bold">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ icon: Icon, label, onClick, to, destructive }: { icon: React.ComponentType<{ size?: number }>; label: string; onClick?: () => void; to?: string; destructive?: boolean }) {
  const className = cn("flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left text-sm font-medium", destructive && "text-destructive");
  const content = (
    <>
      <Icon size={18} />
      <span className="flex-1">{label}</span>
      <ChevronRight size={16} className="text-muted-foreground" />
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}