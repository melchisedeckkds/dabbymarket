import { Link } from "react-router-dom";
import {
  Search, Sparkles, Map as MapIcon, MessageCircle, Share2, Heart, Bookmark,
  Shirt, Smartphone, Utensils, Sofa, Wrench, LayoutGrid, Package, Loader2,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { ProductCard } from "@/components/product-card";
import { useInfiniteProducts, usePosts, useToggleLike, useLikes } from "@/lib/queries";
import { hapticLight } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
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
  const { data: likesData = [] } = useLikes(undefined, post.id);
  const toggleLike = useToggleLike();
  const liked = !!session && likesData.some((l: any) => l.user_id === session.user.id);
  const author = post.profiles;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-base">
          {author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}
        </div>
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold">{author?.name ?? "DabbyMarket"}</span>
        </div>
      </div>
      <p className="px-4 pb-3 text-sm leading-relaxed">{post.text}</p>
      {post.image_url && (
        <div className="relative aspect-[16/10] w-full bg-accent">
          <img src={post.image_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-center justify-between p-3 text-muted-foreground">
        <button
          onClick={() => { hapticLight(); toggleLike.mutate({ postId: post.id, liked }); }}
          className={cn("flex items-center gap-1.5 text-xs font-medium", liked && "text-destructive")}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
          <span>{likesData.length}</span>
        </button>
        <button className="flex items-center gap-1.5 text-xs font-medium">
          <MessageCircle size={18} />
        </button>
        <button className="flex items-center gap-1.5 text-xs font-medium">
          <Share2 size={18} />
        </button>
        <button className="flex items-center gap-1.5 text-xs font-medium">
          <Bookmark size={18} />
        </button>
      </div>
    </article>
  );
}
