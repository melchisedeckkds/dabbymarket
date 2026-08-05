import { Link, useParams, useNavigate } from "react-router-dom";
import { Star, MapPin, ArrowLeft, MessageCircle, Store, Loader2, Eye, Phone, Flag } from "lucide-react";
import { useState } from "react";
import { VerifiedBadge, ConditionBadge } from "@/components/product-card";
import { ShopHeaderSkeleton } from "@/components/skeletons";
import { GuestPrompt } from "@/components/guest-prompt";
import { ReportDialog } from "@/components/report-dialog";
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
  const [showReport, setShowReport] = useState(false);

  if (isLoading) {
    return <ShopHeaderSkeleton />;
  }

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
      <div className="relative h-40 w-full bg-gradient-to-br from-primary/30 to-card">
        <Link to="/" className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/70 backdrop-blur" aria-label={t("common_back")}>
          <ArrowLeft size={18} />
        </Link>
        {session && session.user.id !== shop.owner_id && (
          <button
            onClick={() => setShowReport(true)}
            aria-label={t("boutique_report")}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/70 backdrop-blur"
          >
            <Flag size={16} />
          </button>
        )}
      </div>

      <div className="-mt-10 px-4">
        <div className="flex items-end gap-3">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-background bg-card text-4xl">
            {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-bold">{shop.name}</h1>
              {shop.verified && <VerifiedBadge />}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {avgRating && (
                <span className="flex items-center gap-0.5 text-foreground">
                  <Star size={13} className="fill-primary text-primary" />
                  <span className="font-semibold">{avgRating}</span>
                  <span className="text-muted-foreground">({reviews.length})</span>
                </span>
              )}
              <span>•</span>
              <span>{t("common_since")} {new Date(shop.created_at).toLocaleDateString(locale, { month: "long", year: "numeric" })}</span>
            </div>
          </div>
        </div>
        {shop.description && <p className="mt-3 text-sm text-muted-foreground">{shop.description}</p>}

        <div className="mt-4 flex items-center gap-2 border-b border-border">
          {([
            ["produits", t("boutique_products")],
            ["avis", t("boutique_reviews")],
            ["apropos", t("boutique_about")],
            ["loc", t("boutique_location")],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn("relative px-1 pb-3 text-sm font-semibold transition-colors", tab === k ? "text-primary" : "text-muted-foreground")}
            >
              {label}
              {tab === k && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {tab === "produits" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {products.length === 0 && (
              <p className="col-span-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("boutique_noProducts")}
              </p>
            )}
            {products.map((p: any) => (
              <Link to={`/produit/${p.id}`} key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative aspect-square bg-accent">
                  {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />}
                  <span className="absolute left-2 top-2">
                    <ConditionBadge condition={p.condition} />
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-1 text-xs font-semibold">{p.name}</p>
                  <p className="mt-0.5 text-sm font-bold text-primary">{formatXAF(p.price_xaf)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === "avis" && (
          <div className="mt-4 space-y-3">
            {reviews.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("boutique_noReviews")}
              </p>
            )}
            {reviews.map((r: any) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{r.profiles?.name ?? "—"}</span>
                  <span className="flex items-center gap-0.5 text-xs">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} className={i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"} />
                    ))}
                  </span>
                </div>
                {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale)}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "apropos" && (
          <div className="mt-4 space-y-3">
            {shop.profiles && (
              <Link to={`/profil/${shop.profiles.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-lg">
                  {shop.profiles.avatar_url ? <img src={shop.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("boutique_owner")}</p>
                  <p className="truncate text-sm font-bold">{shop.profiles.name}</p>
                </div>
                <Phone size={15} className="shrink-0 text-primary" />
              </Link>
            )}
            <dl className="space-y-2 text-sm">
            {[
              [t("boutique_category"), shop.category],
              [t("boutique_since"), `${t("common_since")} ${new Date(shop.created_at).toLocaleDateString(locale)}`],
              [t("boutique_publishedProducts"), `${products.length}`],
              [t("boutique_views"), `${viewsCount}`],
              [t("boutique_status"), shop.verified ? t("boutique_statusVerified") : t("boutique_statusUnverified")],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
            </dl>
          </div>
        )}

        {tab === "loc" && (
          <div className="mt-4 space-y-3">
            <div className="grid h-40 place-items-center rounded-2xl border border-border bg-card text-muted-foreground">
              <div className="text-center">
                <MapPin size={28} className="mx-auto text-primary" />
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {shop.lat != null ? t("boutique_locationSaved") : t("boutique_locationMissing")}
                </p>
              </div>
            </div>
            <Link to="/carte" className="block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
              {t("boutique_viewOnMap")}
            </Link>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md border-t border-border bg-background/95 p-3 backdrop-blur lg:bottom-0 lg:max-w-2xl">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleContact} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
            <MessageCircle size={16} /> {t("boutique_contact")}
          </button>
          <button
            onClick={handleFollow}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold",
              following ? "border-primary bg-primary/10 text-primary" : "border-border bg-card",
            )}
          >
            <Store size={16} /> {following ? t("boutique_following") : t("boutique_follow")}
          </button>
        </div>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
      <ReportDialog open={showReport} onClose={() => setShowReport(false)} targetType="shop" targetId={shop.id} />
      </div>
    </div>
  );
}
