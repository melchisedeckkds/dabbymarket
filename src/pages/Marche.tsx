import { Link } from "react-router-dom";
import {
  Search, Sparkles, Map as MapIcon, MessageCircle, Share2, Heart, Bookmark,
  Shirt, Smartphone, Utensils, Sofa, Wrench, LayoutGrid, Package, Loader2,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { ProductCard } from "@/components/product-card";
import { useInfiniteProducts, usePosts, useToggleLike, useLikes, useComments } from "@/lib/queries";
import { CommentSheet } from "@/components/comment-sheet";
import { GuestPrompt } from "@/components/guest-prompt";
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
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [condition, setCondition] = useState<"all" | "Neuf" | "Occasion">("all");

  const {
    data: productsPages,
    isLoading: loadingProducts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts();
  const products = useMemo(() => productsPages?.pages.flat() ?? [], [productsPages]);
  const { data: posts = [], isLoading: loadingPosts } = usePosts();

  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      if (cat && p.category !== cat) return false;
      if (condition !== "all" && p.condition !== condition) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [products, q, cat, condition]);

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
                <ProductCard product={p} />
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
          <div className="mt-4 flex justify-center pb-2">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              {isFetchingNextPage && <Loader2 size={14} className="animate-spin" />}
              {t("marche_loadMore")}
            </button>
          </div>
        )}
      </div>
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
        <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-base">
          {author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}
        </div>
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold">{author?.name ?? "DabbyMarket"}</span>
        </div>
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

      {/* Légende */}
      <p className="px-3 pb-1 pt-1.5 text-sm leading-relaxed">
        <span className="font-semibold">{author?.name ?? "DabbyMarket"}</span> {post.text}
      </p>

      {/* Lien vers les commentaires */}
      <button onClick={() => setShowComments(true)} className="px-3 pb-3 text-left text-xs text-muted-foreground">
        {postComments.length > 0 ? `${t("marche_viewComments")} (${postComments.length})` : t("comments_empty")}
      </button>

      {lightboxOpen && post.image_url && <ImageLightbox src={post.image_url} onClose={() => setLightboxOpen(false)} />}
      {showComments && <CommentSheet postId={post.id} onClose={() => setShowComments(false)} />}
      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
    </article>
  );
      }
