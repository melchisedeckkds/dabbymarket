import { Link, useSearchParams } from "react-router-dom";
import {
  Search, Sparkles, Map as MapIcon, MessageCircle, Share2, Heart, Bookmark,
  Shirt, Smartphone, Utensils, Sofa, Wrench, LayoutGrid, Package, Loader2,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef, type ComponentType } from "react";
import { motion } from "framer-motion";
import { ImageLightbox } from "@/components/image-lightbox";
import { AppShell } from "@/components/app-shell";
import { ProductCard } from "@/components/product-card";
import { useInfiniteProducts, useInfinitePosts, useSinglePost, useToggleLike, useLikes, useComments, useShopRatingsMap, useActiveBoostIds, useAppConfig, applyRankCap } from "@/lib/queries";
import { CommentSheet } from "@/components/comment-sheet";
import { GuestPrompt } from "@/components/guest-prompt";
import { HashtagText } from "@/components/hashtag-text";
import { hapticLight } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
import { shareContent } from "@/lib/share";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categories";

const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.045, duration: 0.35, ease: EASE } }),
};

export default function MarchePage() {
  const { t } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [cat, setCat] = useState<string | null>(null);
  const [condition, setCondition] = useState<"all" | "Neuf" | "Occasion">("all");

  // Lien profond `/?post=<id>` (ex. depuis un profil) : ouvre directement
  // la publication en plein écran avec sa légende, ses likes et ses
  // commentaires, même si elle n'est pas encore chargée dans le fil.
  const deepLinkPostId = searchParams.get("post") ?? undefined;
  const { data: deepLinkPost } = useSinglePost(deepLinkPostId);
  const { data: deepLinkLikes = [] } = useLikes(undefined, deepLinkPostId);
  const { data: deepLinkComments = [] } = useComments(undefined, deepLinkPostId);
  const [deepLinkShowComments, setDeepLinkShowComments] = useState(false);
  function closeDeepLink() {
    const next = new URLSearchParams(searchParams);
    next.delete("post");
    setSearchParams(next, { replace: true });
  }

  const {
    data: productsPages,
    isLoading: loadingProducts,
    fetchNextPage: fetchNextProducts,
    hasNextPage: hasNextProducts,
    isFetchingNextPage: fetchingNextProducts,
  } = useInfiniteProducts();
  const products = useMemo(() => productsPages?.pages.flat() ?? [], [productsPages]);
  const {
    data: postsPages,
    isLoading: loadingPosts,
    fetchNextPage: fetchNextPosts,
    hasNextPage: hasNextPosts,
    isFetchingNextPage: fetchingNextPosts,
  } = useInfinitePosts();
  const posts = useMemo(() => postsPages?.pages.flat() ?? [], [postsPages]);
  const shopRatings = useShopRatingsMap(products.map((p: any) => p.shops?.id).filter(Boolean));

  const hasNextPage = hasNextProducts || hasNextPosts;
  const isFetchingNextPage = fetchingNextProducts || fetchingNextPosts;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Scroll infini : dès que la sentinelle en bas de liste devient visible,
  // on charge la page suivante de produits ET de publications.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (hasNextProducts && !fetchingNextProducts) fetchNextProducts();
        if (hasNextPosts && !fetchingNextPosts) fetchNextPosts();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextProducts, hasNextPosts, fetchingNextProducts, fetchingNextPosts, fetchNextProducts, fetchNextPosts]);

  const { data: rechercheBoostIds = new Set<string>() } = useActiveBoostIds("product", "recherche");
  const { data: rankCapConfig } = useAppConfig();
  const rankCap = Number(rankCapConfig?.boost_rank_bonus_cap ?? 3);

  const filteredProducts = useMemo(() => {
    const base = products.filter((p: any) => {
      if (cat && p.category !== cat) return false;
      if (condition !== "all" && p.condition !== condition) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    // Un boost Recherche ne réordonne jamais librement : il ne peut faire
    // remonter un article que de `rankCap` places au maximum, jamais
    // dépasser un résultat nettement plus pertinent.
    return q || cat ? applyRankCap(base, rechercheBoostIds, rankCap) : base;
  }, [products, q, cat, condition, rechercheBoostIds, rankCap]);

  const filteredPosts = useMemo(() => {
    if (cat || condition !== "all") return [];
    return posts.filter((p: any) => !q || p.text.toLowerCase().includes(q.toLowerCase()));
  }, [posts, q, cat, condition]);

  const boostedProducts = useMemo(
    () => products.filter((p: any) => p.boosted_until && new Date(p.boosted_until).getTime() > Date.now()),
    [products],
  );

  const isEmpty = filteredProducts.length === 0 && filteredPosts.length === 0;
  const loading = loadingProducts || loadingPosts;
  const showFeatured = boostedProducts.length > 0 && !q && !cat && condition === "all";

  return (
    <AppShell>
      <div className="space-y-3 px-4 pt-3">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <Search size={18} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("marche_searchPlaceholder")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            <button className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              <Sparkles size={13} /> {t("marche_showcase")}
            </button>
            <Link to="/carte" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <MapIcon size={13} /> {t("marche_map")}
            </Link>
          </div>
          <div className="ml-auto inline-flex rounded-full border border-border bg-card p-1 text-xs font-semibold">
            {(["all", "Neuf", "Occasion"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCondition(c)}
                className={cn("rounded-full px-2.5 py-1 transition-colors", condition === c ? "bg-accent text-foreground" : "text-muted-foreground")}
              >
                {c === "all" ? t("common_all") : c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex snap-x-rail gap-3 overflow-x-auto px-4 no-scrollbar">
        <CategoryChip active={cat === null} onClick={() => setCat(null)} icon="LayoutGrid" label={t("marche_categoryAll")} />
        {CATEGORIES.map((c) => (
          <CategoryChip key={c.id} active={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)} icon={c.icon} label={t(c.key)} />
        ))}
      </div>

      <div className="mt-4 space-y-4 px-4">
        {showFeatured && (
          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles size={15} className="text-primary" />
              <h2 className="text-sm font-bold">{t("marche_featured")}</h2>
            </div>
            <div className="flex snap-x-rail gap-3 overflow-x-auto pb-1 no-scrollbar">
              {boostedProducts.map((p: any, i: number) => (
                <motion.div key={p.id} custom={i} initial="hidden" animate="show" variants={fadeUp} className="w-44 shrink-0 snap-start">
                  <ProductCard product={p} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-card" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-xl">🔍</div>
            <p className="text-sm text-muted-foreground">{t("marche_emptyState")}</p>
            {(q || cat || condition !== "all") && (
              <button
                onClick={() => {
                  setQ("");
                  setCat(null);
                  setCondition("all");
                }}
                className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
              >
                {t("marche_resetFilters")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {filteredProducts.map((p: any, i: number) => (
              <motion.div key={p.id} custom={i} initial="hidden" animate="show" variants={fadeUp}>
                <ProductCard product={p} rating={p.shops ? shopRatings.data?.get(p.shops.id) : undefined} sponsored={rechercheBoostIds.has(p.id)} />
              </motion.div>
            ))}
            {filteredPosts.map((p: any, i: number) => (
              <motion.div key={p.id} custom={i + filteredProducts.length} initial="hidden" animate="show" variants={fadeUp} className="sm:col-span-2 lg:col-span-2">
                <TextPost post={p} />
              </motion.div>
            ))}
          </div>
        )}

        {!loading && hasNextPage && (
          <div ref={sentinelRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Loader2 size={18} className="animate-spin text-primary" />}
          </div>
        )}
      </div>
      {deepLinkPost && deepLinkPost.image_url && (
        <ImageLightbox
          src={deepLinkPost.image_url}
          onClose={closeDeepLink}
          caption={deepLinkPost.text}
          authorName={deepLinkPost.profiles?.name}
          likesCount={deepLinkLikes.length}
          commentsCount={deepLinkComments.length}
          onOpenComments={() => setDeepLinkShowComments(true)}
        />
      )}
      {deepLinkPost && !deepLinkPost.image_url && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center bg-background/90 p-4 backdrop-blur-md" onClick={closeDeepLink}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-accent text-base">
                {deepLinkPost.profiles?.avatar_url ? <img src={deepLinkPost.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}
              </span>
              <span className="text-sm font-semibold">{deepLinkPost.profiles?.name}</span>
            </div>
            <p className="text-[15px] text-foreground/90">
              <HashtagText text={deepLinkPost.text} className="font-caption" />
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart size={13} className="fill-current" /> {deepLinkLikes.length}
              </span>
              <button onClick={() => setDeepLinkShowComments(true)} className="flex items-center gap-1">
                <MessageCircle size={13} /> {deepLinkComments.length}
              </button>
            </div>
          </div>
        </div>
      )}
      {deepLinkShowComments && deepLinkPostId && (
        <CommentSheet postId={deepLinkPostId} onClose={() => setDeepLinkShowComments(false)} />
      )}
    </AppShell>
  );
}

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  Shirt, Smartphone, Utensils, Sparkles, Sofa, Wrench, LayoutGrid, Package,
};

function CategoryChip({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  const Icon = ICONS[icon] ?? Package;
  return (
    <button type="button" onClick={onClick} className="flex shrink-0 snap-start flex-col items-center gap-1.5">
      <span className={cn("grid h-14 w-14 place-items-center rounded-full transition-colors", active ? "gold-gradient" : "bg-card border border-border")}>
        <Icon size={22} />
      </span>
      <span className={cn("text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
    </button>
  );
}

function TextPost({ post }: { post: any }) {
  const { session } = useAuth();
  const { t } = useApp();
  const { data: likesData = [] } = useLikes(undefined, post.id);
  const toggleLike = useToggleLike();
  const liked = !!session && likesData.some((l: any) => l.user_id === session.user.id);
  const author = post.profiles;
  const [showComments, setShowComments] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [burst, setBurst] = useState(false);
  const { data: postComments = [] } = useComments(undefined, post.id);

  function handleLike() {
    if (!session) return setShowGuestPrompt(true);
    hapticLight();
    toggleLike.mutate({ postId: post.id, liked });
  }

  function handleDoubleTapImage() {
    if (!session) return setShowGuestPrompt(true);
    if (!liked) {
      hapticLight();
      toggleLike.mutate({ postId: post.id, liked });
    }
    setBurst(true);
    setTimeout(() => setBurst(false), 700);
  }

  async function handleShare() {
    const url = `${window.location.origin}/`;
    await shareContent({ title: "DabbyMarket", text: post.text, url }, t);
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* En-tête */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Link to={`/profil/${author?.id}`} className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-base">
          {author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}
        </Link>
        <Link to={`/profil/${author?.id}`} className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold">{author?.name ?? "DabbyMarket"}</span>
        </Link>
      </div>

      {/* Image — proportions naturelles conservées, jamais recadrée de force */}
      {post.image_url && (
        <div className="relative w-full bg-accent" onDoubleClick={handleDoubleTapImage}>
          <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full" aria-label={t("marche_viewImage")}>
            <img src={post.image_url} alt="" className="h-auto max-h-[36rem] w-full object-cover" />
          </button>
          {burst && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1.15, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <Heart size={88} className="fill-white text-white drop-shadow-lg" />
            </motion.div>
          )}
        </div>
      )}

      {/* Barre d'actions */}
      <div className="flex items-center gap-4 px-3 pt-2.5 text-foreground">
        <button onClick={handleLike} aria-label={t("produit_likeIdle")}>
          <Heart size={24} fill={liked ? "currentColor" : "none"} className={cn(liked && "text-destructive", liked && "animate-pop")} />
        </button>
        <button onClick={() => setShowComments(true)} aria-label={t("comments_title")}>
          <MessageCircle size={24} />
        </button>
        <button onClick={handleShare} aria-label={t("produit_share")}>
          <Share2 size={24} />
        </button>
      </div>

      {/* Compteur de coups de cœur */}
      {likesData.length > 0 && (
        <p className="px-3 pt-1.5 text-sm font-semibold">
          {likesData.length} {t("marche_likesLabel")}
        </p>
      )}

      {/* Légende — typographie raffinée, sans répéter le nom déjà visible dans l'en-tête */}
      {post.text && (
        <p className="px-3 pb-1 pt-1.5 text-[15px] text-foreground/90">
          <HashtagText text={post.text} className="font-caption" />
        </p>
      )}

      {/* Lien vers les commentaires */}
      <button onClick={() => setShowComments(true)} className="px-3 pb-3 text-left text-xs text-muted-foreground">
        {postComments.length > 0 ? `${t("marche_viewComments")} (${postComments.length})` : t("comments_empty")}
      </button>

      {lightboxOpen && post.image_url && (
        <ImageLightbox
          src={post.image_url}
          onClose={() => setLightboxOpen(false)}
          caption={post.text}
          authorName={author?.name}
          likesCount={likesData.length}
          commentsCount={postComments.length}
          onOpenComments={() => {
            setLightboxOpen(false);
            setShowComments(true);
          }}
        />
      )}
      {showComments && <CommentSheet postId={post.id} onClose={() => setShowComments(false)} />}
      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
    </article>
  );
      }
