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

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

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
      <div className="flex min-h-screen w-full max-w-md flex-col bg-background pb-40 lg:max-w-2xl lg:border-x lg:border-border lg:pb-8">
      <div className="relative aspect-square w-full overflow-hidden bg-accent">
        <Link to="/" aria-label={t("common_back")} className="absolute left-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-background/70 backdrop-blur transition-colors hover:bg-background">
          <ArrowLeft size={18} />
        </Link>
        <button
          onClick={handleSave}
          aria-label={t("produit_saveIdle")}
          className={cn(
            "absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full backdrop-blur transition-all",
            saved ? "bg-primary text-primary-foreground scale-110" : "bg-background/70 hover:bg-background",
          )}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
        {product.images?.[imgIndex] && <img src={product.images[imgIndex]} alt={product.name} className="h-full w-full object-cover" />}
        {isBoosted && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full gold-gradient shine px-2.5 py-1 text-[11px] font-bold shadow-lg">
            <Zap size={12} /> {t("produit_boosted24h")}
          </span>
        )}
        {product.images && product.images.length > 1 && (
          <div className="absolute bottom-3 right-3 flex gap-1">
            {product.images.map((_: string, i: number) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                aria-label={`${t("produit_photoAlt")} ${i + 1}`}
                className={cn("h-1.5 rounded-full transition-all", i === imgIndex ? "w-5 bg-primary" : "w-1.5 bg-background/70")}
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
              className={cn("h-16 w-16 shrink-0 snap-start overflow-hidden rounded-xl border-2 transition-colors", i === imgIndex ? "border-primary" : "border-transparent opacity-70")}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4 px-4 pt-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold leading-tight">{product.name}</h1>
            <ConditionBadge condition={product.condition} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-primary">{formatXAF(product.price_xaf)}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Eye size={13} /> {viewsCount}
            </span>
          </div>
        </div>

        <Link to={`/boutique/${shop.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-accent">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-xl">
            {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{shop.name}</span>
              {shop.verified && <BadgeCheck size={14} className="shrink-0 fill-[color:var(--verified)] text-background" />}
            </div>
            {reviews.length > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Star size={11} className="fill-primary text-primary" />
                {(reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)} ({reviews.length})
              </span>
            )}
          </div>
          {shop.verified && <VerifiedBadge />}
        </Link>

        {product.description && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("produit_description")}</h2>
            <p className="text-sm leading-relaxed">{product.description}</p>
          </section>
        )}

        <section className="grid grid-cols-3 gap-2 text-center text-[11px]">
          {[
            { icon: Truck, label: t("produit_deliveryByShop") },
            { icon: ShieldCheck, label: shop.verified ? t("produit_verifiedSeller") : t("produit_unverifiedSeller") },
            { icon: MapPin, label: t("produit_viewOnMap") },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-3">
              <Icon size={18} className="mx-auto text-primary" />
              <p className="mt-1 font-semibold">{label}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("produit_yourActions")}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
              <Pepite size={12} /> {t("produit_balance")} : {profile?.pepites_balance ?? 0}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10.5px]">
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("produit_recentReviews")}</h2>
              <Link to={`/boutique/${shop.id}`} className="text-[11px] font-semibold text-primary">
                {t("common_seeAll")}
              </Link>
            </div>
            {shopReviews.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{r.profiles?.name ?? "—"}</span>
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={11} className={i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"} />
                    ))}
                  </span>
                </div>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
              </div>
            ))}
          </section>
        )}

        <CommentSection productId={product.id} />
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md border-t border-border bg-background/95 p-3 backdrop-blur lg:bottom-0 lg:max-w-2xl">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleLike}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl border border-border py-2.5 text-[11px] font-semibold transition-all",
              liked ? "bg-destructive/10 border-destructive text-destructive" : "bg-card hover:bg-accent",
            )}
          >
            <Heart size={18} fill={liked ? "currentColor" : "none"} className={liked ? "animate-pop" : ""} />
            {t("produit_likeIdle")}
          </button>
          <button
            onClick={handleSave}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl border border-border py-2.5 text-[11px] font-semibold transition-all",
              saved ? "bg-primary/10 border-primary text-primary" : "bg-card hover:bg-accent",
            )}
          >
            <Bookmark size={18} fill={saved ? "currentColor" : "none"} className={saved ? "animate-pop" : ""} />
            {t("produit_saveIdle")}
          </button>
          <button
            onClick={handleBoost}
            disabled={boostProduct.isPending}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl py-2.5 text-[11px] font-bold transition-all shadow-lg shadow-primary/20",
              isBoosted ? "bg-accent text-foreground" : "gold-gradient shine",
            )}
          >
            <Zap size={18} />
            {isBoosted ? t("produit_boosted24h") : `${t("produit_boost")} (${BOOST_COST})`}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={handleContact} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
            <MessageCircle size={16} /> {t("produit_contact")}
          </button>
          <button onClick={handleShare} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold">
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
  active,
  icon: Icon,
  activeLabel,
  idleLabel,
  hint,
}: {
  active: boolean;
  icon: React.ComponentType<{ size?: number; className?: string; fill?: string }>;
  activeLabel: string;
  idleLabel: string;
  hint?: string;
}) {
  return (
    <div className={cn("relative rounded-xl border p-2 transition-all", active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground")}>
      {active && (
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[color:var(--verified)] text-background">
          <Check size={10} strokeWidth={3} />
        </span>
      )}
      <Icon size={16} className={cn("mx-auto", active && "animate-pop")} fill={active ? "currentColor" : "none"} />
      <p className={cn("mt-1 font-bold", active && "text-foreground")}>{active ? activeLabel : idleLabel}</p>
      {hint && <p className="text-[10px] opacity-70">{hint}</p>}
    </div>
  );
}
