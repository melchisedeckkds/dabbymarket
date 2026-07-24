import { Link } from "react-router-dom";
import {
  Search, Sparkles, Map as MapIcon, MessageCircle, Share2, Heart,
  Shirt, Smartphone, Utensils, Sofa, Wrench, LayoutGrid, Package, Loader2, TrendingUp, Flame,
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
      {/* Header sticky avec recherche premium */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="space-y-3 px-4 pt-3 pb-3">
          <label className="group flex items-center gap-2 rounded-2xl border-2 border-border bg-card px-4 py-3 shadow-sm transition-all focus-within:border-primary focus-within:shadow-lg focus-within:shadow-primary/10">
            <Search size={18} className="text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("marche_searchPlaceholder")}
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="text-xs font-bold text-primary">
                ✕
              </button>
            )}
          </label>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
              <button className="inline-flex items-center gap-1.5 rounded-full gold-gradient px-3 py-1.5 text-xs font-black text-background shadow-md shadow-primary/20">
                <Sparkles size={12} /> {t("marche_showcase")}
              </button>
              <Link to="/carte" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
                <MapIcon size={12} /> {t("marche_map")}
              </Link>
            </div>
            <div className="ml-auto inline-flex rounded-full border border-border bg-card p-1 text-[11px] font-bold shadow-sm">
              {(["all", "Neuf", "Occasion"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={cn(
                    "rounded-full px-2.5 py-1 transition-all",
                    condition === c ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c === "all" ? t("common_all") : c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rail catégories */}
      <div className="relative mt-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent z-10" />
        <div className="flex snap-x-rail gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
          <CategoryChip active={cat === null} onClick={() => setCat(null)} icon="LayoutGrid" label={t("marche_categoryAll")} />
          {CATEGORIES.map((c) => (
            <CategoryChip key={c.id} active={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)} icon={c.icon} label={t(c.key)} />
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-5 px-4">
        {showFeatured && (
          <section>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg gold-gradient shadow-md shadow-primary/20">
                <Flame size={13} className="text-background" />
              </span>
              <h2 className="text-sm font-black tracking-tight">{t("marche_featured")}</h2>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
                {boostedProducts.length}
              </span>
              <span className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary/70">
                <TrendingUp size={10} /> boostés
              </span>
            </div>
            <div className="flex snap-x-rail gap-3 overflow-x-auto pb-2 no-scrollbar">
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
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-gradient-to-br from-card via-accent/40 to-card" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-gradient-to-br from-card to-transparent p-10 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-2xl">🔍</div>
            <p className="text-sm text-muted-foreground">{t("marche_emptyState")}</p>
            {(q || cat || condition !== "all") && (
              <button
                onClick={() => {
                  setQ("");
                  setCat(null);
                  setCondition("all");
                }}
                className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-black text-primary transition-all hover:bg-primary/20"
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
          <div className="mt-6 flex justify-center pb-4">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="flex items-center gap-2 rounded-2xl border-2 border-border bg-card px-6 py-3 text-sm font-black text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg disabled:opacity-60"
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
    <button type="button" onClick={onClick} className="group flex shrink-0 snap-start flex-col items-center gap-1.5">
      <span
        className={cn(
          "relative grid h-16 w-16 place-items-center rounded-2xl transition-all duration-300",
          active
            ? "gold-gradient text-background shadow-lg shadow-primary/30 scale-110"
            : "bg-card border border-border group-hover:border-primary/40 group-hover:scale-105",
        )}
      >
        <Icon size={22} />
        {active && (
          <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
        )}
      </span>
      <span className={cn("text-[11px] font-bold tracking-tight transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>
        {label}
      </span>
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
  const { data: postComments = [] } = useComments(undefined, post.id);

  function handleLike() {
    if (!session) return setShowGuestPrompt(true);
    hapticLight();
    toggleLike.mutate({ postId: post.id, liked });
  }

  async function handleShare() {
    const url = `${window.location.origin}/`;
    await shareContent({ title: "DabbyMarket", text: post.text, url }, t);
  }

  return (
    <article className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-base ring-2 ring-primary/20">
          {author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}
        </div>
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-bold">{author?.name ?? "DabbyMarket"}</span>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Publication</p>
        </div>
      </div>
      <p className="px-4 pb-3 text-sm leading-relaxed">{post.text}</p>
      {post.image_url && (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-accent">
          <img src={post.image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </div>
      )}
      <div className="flex items-center justify-around border-t border-border/60 p-2 text-muted-foreground">
        <button
          onClick={handleLike}
          className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all", liked ? "text-destructive bg-destructive/10" : "hover:bg-accent")}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          <span>{likesData.length}</span>
        </button>
        <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all hover:bg-accent" onClick={() => setShowComments(true)}>
          <MessageCircle size={16} />
          {postComments.length > 0 && <span>{postComments.length}</span>}
        </button>
        <button onClick={handleShare} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all hover:bg-accent">
          <Share2 size={16} />
        </button>
      </div>
      {showComments && <CommentSheet postId={post.id} onClose={() => setShowComments(false)} />}
      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
    </article>
  );
}
