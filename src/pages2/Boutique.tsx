import { Link, useParams, useNavigate } from "react-router-dom";
import { Star, MapPin, ArrowLeft, MessageCircle, Store, Eye, Package as PackageIcon, Info, Award } from "lucide-react";
import { useState } from "react";
import { VerifiedBadge, ConditionBadge } from "@/components/product-card";
import { ShopHeaderSkeleton } from "@/components/skeletons";
import { GuestPrompt } from "@/components/guest-prompt";
import { BottomNav } from "@/components/bottom-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { useShop, useProducts, useReviews, useStartConversation, useRecordView, useViewsCount } from "@/lib/queries";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function useIsFollowing(shopId: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["is-following", shopId, session?.user?.id],
    enabled: !!shopId && !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("id").eq("shop_id", shopId!).eq("follower_id", session!.user.id).maybeSingle();
      return !!data;
    },
  });
}

function useToggleFollow(shopId: string | undefined) {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (following: boolean) => {
      if (following) {
        await supabase.from("follows").delete().eq("shop_id", shopId!).eq("follower_id", session!.user.id);
      } else {
        await supabase.from("follows").insert({ shop_id: shopId!, follower_id: session!.user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["is-following", shopId] }),
  });
}

export default function BoutiquePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t, lang } = useApp();
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const { data: shop, isLoading } = useShop(id);
  const { data: products = [] } = useProducts(id);
  const { data: reviews = [] } = useReviews(id);
  const { data: following = false } = useIsFollowing(id);
  const toggleFollow = useToggleFollow(id);
  const startConversation = useStartConversation();
  useRecordView("shop", id);
  const { data: viewsCount = 0 } = useViewsCount("shop", id);
  const [tab, setTab] = useState<"produits" | "avis" | "apropos" | "loc">("produits");
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  if (isLoading) return <ShopHeaderSkeleton />;

  if (!shop) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-background p-8 text-center text-sm text-muted-foreground">
        {t("boutique_notFound")}
        <div className="lg:hidden"><BottomNav /></div>
      </div>
    );
  }

  const avgRating = reviews.length ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  async function handleContact() {
    if (!session) return setShowGuestPrompt(true);
    if (session.user.id === shop.owner_id) return toast.error(t("boutique_ownShopError"));
    const conv = await startConversation.mutateAsync({ sellerId: shop.owner_id, shopId: shop.id });
    navigate(`/messages/${conv.id}`);
  }

  function handleFollow() {
    if (!session) return setShowGuestPrompt(true);
    toggleFollow.mutate(following);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] bg-background lg:justify-center">
      <SidebarNav />
      <div className="flex min-h-screen w-full max-w-md flex-col bg-background pb-32 lg:max-w-2xl lg:border-x lg:border-border lg:pb-8">
        {/* Cover hero premium */}
        <div className="relative h-52 w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/20 to-card" />
          <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_100%,rgba(212,175,55,0.35),transparent_70%)]" />
          {/* Motif points */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />

          <Link
            to="/"
            className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/60"
            aria-label={t("common_back")}
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
            <Eye size={12} /> {viewsCount}
          </div>
        </div>

        <div className="-mt-14 px-4">
          <div className="flex items-end gap-3">
            <div className="relative">
              <div className="absolute inset-0 -m-1 rounded-3xl bg-gradient-to-br from-primary via-yellow-400 to-primary blur-md opacity-70" />
              <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-3xl border-4 border-background bg-card text-4xl shadow-2xl">
                {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
              </div>
              {shop.verified && (
                <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full gold-gradient text-background shadow-lg ring-4 ring-background">
                  ✓
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-black tracking-tight">{shop.name}</h1>
                {shop.verified && <VerifiedBadge />}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                {avgRating && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary">
                    <Star size={11} className="fill-primary" />
                    {avgRating}
                    <span className="opacity-70">({reviews.length})</span>
                  </span>
                )}
                <span className="text-[11px]">
                  {t("common_since")} {new Date(shop.created_at).toLocaleDateString(locale, { month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          {shop.description && (
            <p className="mt-4 rounded-2xl border border-border bg-card/60 p-3 text-sm leading-relaxed text-muted-foreground backdrop-blur">
              {shop.description}
            </p>
          )}

          {/* Stats rapides */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatMini icon={PackageIcon} value={products.length} label={t("boutique_products")} />
            <StatMini icon={Star} value={avgRating ?? "—"} label={t("boutique_reviews")} />
            <StatMini icon={Eye} value={viewsCount} label={t("boutique_views")} />
          </div>

          {/* Tabs premium */}
          <div className="mt-5 flex items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm">
            {(
              [
                ["produits", t("boutique_products"), PackageIcon],
                ["avis", t("boutique_reviews"), Star],
                ["apropos", t("boutique_about"), Info],
                ["loc", t("boutique_location"), MapPin],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition-all",
                  tab === k
                    ? "gold-gradient text-background shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={12} />
                <span className="hidden xs:inline">{label}</span>
                <span className="xs:hidden">{label}</span>
              </button>
            ))}
          </div>

          {tab === "produits" && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {products.length === 0 && (
                <p className="col-span-2 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  {t("boutique_noProducts")}
                </p>
              )}
              {products.map((p: any) => (
                <Link
                  to={`/produit/${p.id}`}
                  key={p.id}
                  className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="relative aspect-square overflow-hidden bg-accent">
                    {p.images?.[0] && (
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    )}
                    <span className="absolute left-2 top-2">
                      <ConditionBadge condition={p.condition} />
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-1 text-xs font-semibold">{p.name}</p>
                    <p className="mt-0.5 text-sm font-black text-primary">{formatXAF(p.price_xaf)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {tab === "avis" && (
            <div className="mt-4 space-y-3">
              {reviews.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  {t("boutique_noReviews")}
                </p>
              )}
              {reviews.map((r: any) => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-black text-primary">
                        {(r.profiles?.name ?? "?")[0]?.toUpperCase()}
                      </span>
                      <span className="text-sm font-bold">{r.profiles?.name ?? "—"}</span>
                    </div>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={i < r.rating ? "fill-primary text-primary" : "text-muted-foreground/30"} />
                      ))}
                    </span>
                  </div>
                  {r.comment && <p className="mt-2 text-sm leading-relaxed">{r.comment}</p>}
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale)}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "apropos" && (
            <dl className="mt-4 space-y-2 text-sm">
              {[
                [t("boutique_category"), shop.category, Award],
                [t("boutique_since"), `${t("common_since")} ${new Date(shop.created_at).toLocaleDateString(locale)}`, Info],
                [t("boutique_publishedProducts"), `${products.length}`, PackageIcon],
                [t("boutique_views"), `${viewsCount}`, Eye],
                [t("boutique_status"), shop.verified ? t("boutique_statusVerified") : t("boutique_statusUnverified"), Store],
              ].map(([k, v, Icon]) => {
                const IconC = Icon as React.ComponentType<{ size?: number; className?: string }>;
                return (
                  <div key={k as string} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                      <IconC size={14} />
                    </span>
                    <dt className="flex-1 text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-sm font-bold">{v}</dd>
                  </div>
                );
              })}
            </dl>
          )}

          {tab === "loc" && (
            <div className="mt-4 space-y-3">
              <div className="relative grid h-48 place-items-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card text-muted-foreground shadow-inner">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(212,175,55,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.15) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }}
                />
                <div className="relative text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full gold-gradient shadow-lg shadow-primary/25">
                    <MapPin size={26} className="text-background" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-foreground">
                    {shop.lat != null ? t("boutique_locationSaved") : t("boutique_locationMissing")}
                  </p>
                </div>
              </div>
              <Link to="/carte" className="block rounded-2xl gold-gradient py-3 text-center text-sm font-black text-background shadow-lg shadow-primary/25">
                {t("boutique_viewOnMap")}
              </Link>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md border-t border-border/60 bg-background/95 p-3 backdrop-blur-xl lg:bottom-0 lg:max-w-2xl">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleContact} className="shine inline-flex items-center justify-center gap-2 rounded-2xl gold-gradient py-3.5 text-sm font-black text-background shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]">
              <MessageCircle size={16} /> {t("boutique_contact")}
            </button>
            <button
              onClick={handleFollow}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2xl border-2 py-3.5 text-sm font-black transition-all active:scale-[0.98]",
                following
                  ? "border-primary bg-primary/15 text-primary shadow-md shadow-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <Store size={16} /> {following ? t("boutique_following") : t("boutique_follow")}
            </button>
          </div>
        </div>

        <div className="lg:hidden"><BottomNav /></div>
        <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
      </div>
    </div>
  );
}

function StatMini({ icon: Icon, value, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-2.5 text-center shadow-sm">
      <Icon size={14} className="mx-auto text-primary" />
      <p className="mt-0.5 text-sm font-black">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
