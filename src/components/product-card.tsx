import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Share2, Bookmark, BadgeCheck, Zap, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLikes, useToggleLike, useWishlist, useToggleWishlist, useIsFollowing, useToggleFollow } from "@/lib/queries";
import { hapticLight } from "@/lib/haptics";
import { shareContent } from "@/lib/share";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";
import { GuestPrompt } from "./guest-prompt";
import { SponsoredBadge } from "./sponsored-badge";

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

type RealProduct = {
  id: string;
  name: string;
  price_xaf: number;
  condition: "Neuf" | "Occasion";
  images: string[];
  boosted_until: string | null;
  shops: { id: string; owner_id: string; name: string; logo_url: string | null; verified: boolean } | null;
};

export function ProductCard({ product, rating, sponsored }: { product: RealProduct; rating?: { avg: number; count: number }; sponsored?: boolean }) {
  const { session } = useAuth();
  const { t } = useApp();
  const shop = product.shops;
  const { data: likesData = [] } = useLikes(product.id);
  const { data: wishlistData = [] } = useWishlist();
  const toggleLike = useToggleLike();
  const toggleWishlist = useToggleWishlist();

  const liked = !!session && likesData.some((l: any) => l.user_id === session.user.id);
  const saved = !!wishlistData.find((w: any) => w.product_id === product.id);
  const isBoosted = (!!product.boosted_until && new Date(product.boosted_until).getTime() > Date.now()) || !!sponsored;
  const photo = product.images?.[0];
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const { data: following = false } = useIsFollowing(shop?.id);
  const toggleFollow = useToggleFollow(shop?.id);
  const isOwnShop = !!session && shop?.owner_id === session.user.id;

  function handleFollow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!session) return setShowGuestPrompt(true);
    hapticLight();
    toggleFollow.mutate(following);
  }

  function handleLike() {
    if (!session) return setShowGuestPrompt(true);
    hapticLight();
    toggleLike.mutate({ productId: product.id, liked });
  }

  function handleSave() {
    if (!session) return setShowGuestPrompt(true);
    hapticLight();
    toggleWishlist.mutate({ productId: product.id, saved });
  }

  async function handleShare() {
    const url = `${window.location.origin}/produit/${product.id}`;
    await shareContent({ title: product.name, text: `${product.name} — ${formatXAF(product.price_xaf)} sur DabbyMarket`, url }, t);
  }

  if (!shop) return null;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg animate-float-in">
      <Link to={`/boutique/${shop.id}`} className="flex items-center gap-2 px-3 py-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-base">
          {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-semibold">{shop.name}</span>
            {shop.verified && <BadgeCheck size={14} className="shrink-0 fill-[color:var(--verified)] text-background" />}
          </div>
          {rating && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Star size={10} className="fill-primary text-primary" /> {rating.avg} ({rating.count})
            </span>
          )}
        </div>
        {!isOwnShop && (
          <button
            onClick={handleFollow}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors",
              following ? "border-border bg-accent text-muted-foreground" : "border-primary bg-primary/10 text-primary",
            )}
          >
            {following ? t("boutique_following") : t("boutique_follow")}
          </button>
        )}
        <ConditionBadge condition={product.condition} />
      </Link>

      <Link to={`/produit/${product.id}`} className="relative block aspect-square w-full overflow-hidden bg-accent">
        {photo ? (
          <img src={photo} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-4xl text-muted-foreground">🛍️</span>
        )}
        {isBoosted && <SponsoredBadge className="absolute left-2 top-2 shadow" />}
      </Link>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/produit/${product.id}`} className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">{product.name}</h3>
          </Link>
          <span className="shrink-0 text-sm font-bold text-primary">{formatXAF(product.price_xaf)}</span>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-muted-foreground">
          <button
            type="button"
            onClick={handleLike}
            className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors", liked && "text-destructive")}
            aria-label="Coup de cœur"
          >
            <Heart size={18} fill={liked ? "currentColor" : "none"} strokeWidth={2} className={liked ? "animate-pop" : ""} />
            <span>{likesData.length}</span>
          </button>
          <Link to={`/produit/${product.id}`} className="flex items-center gap-1.5 text-xs font-medium" aria-label="Commenter">
            <MessageCircle size={18} strokeWidth={2} />
          </Link>
          <button type="button" onClick={handleShare} className="flex items-center gap-1.5 text-xs font-medium" aria-label={t("produit_share")}>
            <Share2 size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors", saved && "text-primary")}
            aria-label="Panier d'envie"
          >
            <Bookmark size={18} fill={saved ? "currentColor" : "none"} strokeWidth={2} className={saved ? "animate-pop" : ""} />
          </button>
        </div>
      </div>
      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
    </article>
  );
}

export function ConditionBadge({ condition }: { condition: "Neuf" | "Occasion" }) {
  const { t } = useApp();
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        condition === "Neuf" ? "bg-[color:var(--verified)]/15 text-[color:var(--verified)]" : "bg-accent text-foreground",
      )}
    >
      {condition === "Neuf" ? t("common_new") : t("common_used")}
    </span>
  );
}

export function VerifiedBadge() {
  const { t } = useApp();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--verified)]/15 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--verified)]">
      <BadgeCheck size={13} />
      {t("common_verified")}
    </span>
  );
}
