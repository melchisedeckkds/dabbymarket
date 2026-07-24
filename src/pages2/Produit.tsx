import { Link, useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Heart, Bookmark, Zap, Share2, MessageCircle, BadgeCheck, Star, Truck, ShieldCheck, MapPin, Check, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  useProduct, useLikes, useToggleLike, useWishlist, useToggleWishlist,
  useBoostProduct, useReviews, useStartConversation, useRecordView, useViewsCount,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { ConditionBadge, VerifiedBadge } from "@/components/product-card";
import { ProductDetailSkeleton } from "@/components/skeletons";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { CommentSection } from "@/components/comment-section";
import { GuestPrompt } from "@/components/guest-prompt";
import { shareContent } from "@/lib/share";
import { BottomNav } from "@/components/bottom-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { Pepite } from "@/components/pepite";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";

const BOOST_COST = 80;

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

export default function ProduitPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const { t } = useApp();
  const { data: product, isLoading } = useProduct(id);
  const shop = product?.shops;
  const { data: likesData = [] } = useLikes(id);
  const { data: wishlistData = [] } = useWishlist();
  const { data: reviews = [] } = useReviews(shop?.id);
  const toggleLike = useToggleLike();
  const toggleWishlist = useToggleWishlist();
  const boostProduct = useBoostProduct();
  const startConversation = useStartConversation();
  useRecordView("product", id);
  const { data: viewsCount = 0 } = useViewsCount("product", id);
  const [imgIndex, setImgIndex] = useState(0);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  if (isLoading) return <ProductDetailSkeleton />;

  if (!product || !shop) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-background p-8 text-center text-sm text-muted-foreground">
        {t("produit_notFound")}
        <div className="lg:hidden"><BottomNav /></div>
      </div>
    );
  }

  const liked = !!session && likesData.some((l: any) => l.user_id === session.user.id);
  const saved = !!wishlistData.find((w: any) => w.product_id === product.id);
  const isBoosted = !!product.boosted_until && new Date(product.boosted_until).getTime() > Date.now();
  const shopReviews = reviews.slice(0, 2);

  async function handleBoost() {
    if (!session) return setShowGuestPrompt(true);
    if (isBoosted) return toast.success(t("produit_alreadyBoosted"));
    try {
      await boostProduct.mutateAsync(product!.id);
      hapticSuccess();
      toast.success(t("produit_boostSuccess"), { description: t("produit_boostSuccessDesc") });
    } catch (e: any) {
      toast.error(t("produit_insufficientPepites"), { description: `${BOOST_COST} ${t("pepites")} (${profile?.pepites_balance ?? 0})` });
    }
  }

  function handleLike() {
    if (!session) return setShowGuestPrompt(true);
    hapticLight();
    toggleLike.mutate({ productId: product.id, liked });
    toast.success(liked ? t("produit_likeRemoved") : t("produit_likeAdded"));
  }

  function handleSave() {
    if (!session) return setShowGuestPrompt(true);
    hapticLight();
    toggleWishlist.mutate({ productId: product.id, saved });
    toast.success(saved ? t("produit_saveRemoved") : t("produit_saveAdded"));
  }

  async function handleContact() {
    if (!session) return setShowGuestPrompt(true);
    if (session.user.id === shop!.owner_id) return toast.error(t("produit_ownProductError"));
    const conv = await startConversation.mutateAsync({ sellerId: shop!.owner_id, shopId: shop!.id, productId: product!.id });
    navigate(`/messages/${conv.id}`);
  }

  async function handleShare() {
    const url = `${window.location.origin}/produit/${product!.id}`;
    await shareContent(
      { title: product!.name, text: `${product!.name} — ${formatXAF(product!.price_xaf)} sur DabbyMarket`, url },
      t,
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] bg-background lg:justify-center">
      <SidebarNav />
      <div className="flex min-h-screen w-full max-w-md flex-col bg-background pb-44 lg:max-w-2xl lg:border-x lg:border-border lg:pb-8">
        {/* Photo hero */}
        <div className="relative aspect-square w-full overflow-hidden bg-accent">
          {product.images?.[imgIndex] && (
            <img src={product.images[imgIndex]} alt={product.name} className="h-full w-full object-cover" />
          )}
          {/* Gradient de lecture */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />

          <Link
            to="/"
            aria-label={t("common_back")}
            className="absolute left-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/60"
          >
            <ArrowLeft size={18} />
          </Link>
          <button
            onClick={handleSave}
            aria-label={t("produit_saveIdle")}
            className={cn(
              "absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full backdrop-blur-md transition-all",
              saved
                ? "gold-gradient scale-110 text-background shadow-lg shadow-primary/30"
                : "border border-white/20 bg-black/40 text-white hover:bg-black/60",
            )}
          >
            <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
          </button>

          {isBoosted && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full gold-gradient shine px-3 py-1.5 text-[11px] font-black text-background shadow-xl shadow-primary/25">
              <Zap size={13} /> {t("produit_boosted24h")}
            </span>
          )}

          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
            <Eye size={12} /> {viewsCount}
          </span>

          {product.images && product.images.length > 1 && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-1">
              {product.images.map((_: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setImgIndex(i)}
                  aria-label={`${t("produit_photoAlt")} ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === imgIndex ? "w-6 bg-primary shadow-md shadow-primary/40" : "w-1.5 bg-white/60",
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {product.images && product.images.length > 1 && (
          <div className="flex snap-x-rail gap-2 overflow-x-auto px-4 pt-3 no-scrollbar">
            {product.images.map((img: string, i: number) => (
              <button
                key={img}
                onClick={() => setImgIndex(i)}
                className={cn(
                  "h-16 w-16 shrink-0 snap-start overflow-hidden rounded-xl border-2 transition-all",
                  i === imgIndex ? "border-primary shadow-md shadow-primary/20 scale-105" : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4 px-4 pt-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-black leading-tight tracking-tight">{product.name}</h1>
              <ConditionBadge condition={product.condition} />
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl font-black tracking-tight text-primary drop-shadow-[0_1px_10px_rgba(212,175,55,0.25)]">
                {formatXAF(product.price_xaf)}
              </span>
            </div>
          </div>

          <Link
            to={`/boutique/${shop.id}`}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            <div className="relative">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-accent text-xl ring-2 ring-background">
                {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
              </div>
              {shop.verified && (
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--verified)] text-background text-[10px] ring-2 ring-background">
                  ✓
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-black">{shop.name}</span>
                {shop.verified && <BadgeCheck size={14} className="shrink-0 fill-[color:var(--verified)] text-background" />}
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Voir la boutique →</p>
            </div>
            {shop.verified && <VerifiedBadge />}
          </Link>

          {product.description && (
            <section className="space-y-2">
              <h2 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t("produit_description")}</h2>
              <p className="text-sm leading-relaxed">{product.description}</p>
            </section>
          )}

          <section className="grid grid-cols-3 gap-2 text-center text-[11px]">
            {[
              { icon: Truck, label: t("produit_deliveryByShop") },
              { icon: ShieldCheck, label: shop.verified ? t("produit_verifiedSeller") : t("produit_unverifiedSeller") },
              { icon: MapPin, label: t("produit_viewOnMap") },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="group rounded-2xl border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Icon size={16} />
                </span>
                <p className="mt-1.5 font-bold">{label}</p>
              </div>
            ))}
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-lg shadow-primary/5">
            <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/15 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-primary" />
                <h2 className="text-[11px] font-black uppercase tracking-wider text-primary">{t("produit_yourActions")}</h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background/60 px-2.5 py-1 text-[11px] font-black text-primary backdrop-blur">
                <Pepite size={12} /> {profile?.pepites_balance ?? 0}
              </span>
            </div>
            <div className="relative mt-3 grid grid-cols-3 gap-2 text-center text-[10.5px]">
              <RecapTile active={liked} icon={Heart} activeLabel={t("produit_liked")} idleLabel={t("produit_likeIdle")} />
              <RecapTile active={saved} icon={Bookmark} activeLabel={t("produit_saved")} idleLabel={t("produit_saveIdle")} />
              <RecapTile
                active={isBoosted}
                icon={Zap}
                activeLabel={t("produit_boosted24h")}
                idleLabel={t("produit_notBoosted")}
                hint={isBoosted ? `-${BOOST_COST} ${t("pepites")}` : `${t("produit_costWord")} ${BOOST_COST} ${t("pepites")}`}
              />
            </div>
          </section>

          {shopReviews.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Star size={13} className="text-primary" />
                  <h2 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t("produit_recentReviews")}</h2>
                </div>
                <Link to={`/boutique/${shop.id}`} className="text-[11px] font-black text-primary">
                  {t("common_seeAll")} →
                </Link>
              </div>
              {shopReviews.map((r: any) => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                        {(r.profiles?.name ?? "?")[0]?.toUpperCase()}
                      </span>
                      <span className="text-sm font-bold">{r.profiles?.name ?? "—"}</span>
                    </div>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={11} className={i < r.rating ? "fill-primary text-primary" : "text-muted-foreground/30"} />
                      ))}
                    </span>
                  </div>
                  {r.comment && <p className="mt-1.5 text-sm leading-relaxed">{r.comment}</p>}
                </div>
              ))}
            </section>
          )}

          <CommentSection productId={product.id} />
        </div>

        {/* Barre d'actions fixe */}
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md border-t border-border/60 bg-background/95 p-3 backdrop-blur-xl lg:bottom-0 lg:max-w-2xl">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleLike}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-2xl border-2 py-2.5 text-[11px] font-black transition-all active:scale-95",
                liked ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-card hover:border-destructive/40",
              )}
            >
              <Heart size={18} fill={liked ? "currentColor" : "none"} className={liked ? "animate-pop" : ""} />
              {t("produit_likeIdle")}
            </button>
            <button
              onClick={handleSave}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-2xl border-2 py-2.5 text-[11px] font-black transition-all active:scale-95",
                saved ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/40",
              )}
            >
              <Bookmark size={18} fill={saved ? "currentColor" : "none"} className={saved ? "animate-pop" : ""} />
              {t("produit_saveIdle")}
            </button>
            <button
              onClick={handleBoost}
              disabled={boostProduct.isPending}
              className={cn(
                "shine flex flex-col items-center gap-0.5 rounded-2xl py-2.5 text-[11px] font-black transition-all shadow-lg shadow-primary/20 active:scale-95",
                isBoosted ? "bg-accent text-foreground" : "gold-gradient text-background",
              )}
            >
              <Zap size={18} />
              {isBoosted ? t("produit_boosted24h") : `${t("produit_boost")} (${BOOST_COST})`}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={handleContact}
              className="inline-flex items-center justify-center gap-2 rounded-2xl gold-gradient py-3 text-sm font-black text-background shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]"
            >
              <MessageCircle size={16} /> {t("produit_contact")}
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card py-3 text-sm font-black transition-all hover:border-primary/40"
            >
              <Share2 size={16} /> {t("produit_share")}
            </button>
          </div>
        </div>

        <div className="lg:hidden"><BottomNav /></div>
        <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
      </div>
    </div>
  );
}

function RecapTile({
  active, icon: Icon, activeLabel, idleLabel, hint,
}: {
  active: boolean;
  icon: React.ComponentType<{ size?: number; className?: string; fill?: string }>;
  activeLabel: string; idleLabel: string; hint?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 p-2.5 transition-all",
        active
          ? "border-primary bg-gradient-to-br from-primary/15 to-transparent text-primary shadow-md shadow-primary/10"
          : "border-border bg-background/60 text-muted-foreground backdrop-blur",
      )}
    >
      {active && (
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--verified)] text-background shadow ring-2 ring-background">
          <Check size={10} strokeWidth={3} />
        </span>
      )}
      <Icon size={18} className={cn("mx-auto", active && "animate-pop drop-shadow")} fill={active ? "currentColor" : "none"} />
      <p className={cn("mt-1.5 font-black", active && "text-foreground")}>{active ? activeLabel : idleLabel}</p>
      {hint && <p className="mt-0.5 text-[9px] opacity-80">{hint}</p>}
    </div>
  );
}
