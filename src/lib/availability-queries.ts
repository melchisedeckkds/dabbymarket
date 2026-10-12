// DabbyMarket — Dabby Disponibilité : accès aux données (React Query).
// Principe de robustesse : toutes les LECTURES retombent sur une valeur
// vide si la migration 0018 n'est pas encore appliquée — l'application
// existante continue alors de fonctionner exactement comme avant.

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { useApp } from "./app-store";
import { CATEGORIES } from "./categories";
import { normText, type AvailabilityRow, type DeclaredStatus, type EffectiveStatus, type ReliabilityLevel } from "./availability";

// ============ CATÉGORIES (administrables, avec repli statique) ============
export type CategoryRow = {
  id: string; parent_id: string | null; name_fr: string; name_en: string; description: string | null;
  icon: string | null; sort_order: number; active: boolean; ttl_hours: number | null;
  is_regulated: boolean; allow_stock: boolean; units: string[]; attributes: CategoryAttribute[];
};
export type CategoryAttribute = { key: string; label_fr: string; label_en?: string; type: "text" | "number" | "select"; options?: string[]; required?: boolean };
export type CategoryOption = { id: string; label: string; icon: string; parent_id: string | null; allow_stock: boolean; is_regulated: boolean };

export function useCategoryRows() {
  return useQuery({
    queryKey: ["product-categories"],
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase.from("product_categories").select("*").order("sort_order");
      if (error) return [];
      return (data ?? []) as CategoryRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Catégories pour les sélecteurs. Si la base n'en renvoie aucune, repli sur la liste statique historique. */
export function useCategoryOptions(opts?: { topLevelOnly?: boolean; stockOnly?: boolean }) {
  const { t, lang } = useApp();
  const { data: rows = [] } = useCategoryRows();
  const list: CategoryOption[] = rows.length
    ? rows
        .filter((r) => r.active)
        .filter((r) => (opts?.topLevelOnly ? !r.parent_id : true))
        .filter((r) => (opts?.stockOnly ? r.allow_stock : true))
        .map((r) => ({ id: r.id, label: lang === "en" ? r.name_en : r.name_fr, icon: r.icon ?? "Package", parent_id: r.parent_id, allow_stock: r.allow_stock, is_regulated: r.is_regulated }))
    : CATEGORIES.map((c) => ({ id: c.id, label: t(c.key), icon: c.icon, parent_id: null, allow_stock: true, is_regulated: false }));
  return list;
}

export function useCategoryLabel() {
  const { lang, t } = useApp();
  const { data: rows = [] } = useCategoryRows();
  return (id: string | null | undefined) => {
    if (!id) return "";
    const r = rows.find((x) => x.id === id);
    if (r) return lang === "en" ? r.name_en : r.name_fr;
    const s = CATEGORIES.find((c) => c.id === id);
    return s ? t(s.key) : id;
  };
}

export type CatalogItem = { id: string; category_id: string; name_fr: string; name_en: string; slug: string; sale_unit: string | null; synonyms: string[]; active: boolean };
export function useCatalogItems() {
  return useQuery({
    queryKey: ["catalog-items"],
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase.from("catalog_items").select("*").order("name_fr");
      if (error) return [];
      return (data ?? []) as CatalogItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============ DISPONIBILITÉ D'UNE BOUTIQUE (catalogue public) ============
export type ShopProduct = any & {
  effective_status?: EffectiveStatus; declared_status?: DeclaredStatus; confirmed_at?: string | null;
  out_reports?: number; found_reports?: number; ttl_hours?: number;
};

/** Produits d'une boutique fusionnés avec leur disponibilité effective (vue product_availability). */
export function useShopCatalog(shopId: string | undefined) {
  return useQuery({
    queryKey: ["shop-catalog", shopId],
    enabled: !!shopId,
    queryFn: async (): Promise<ShopProduct[]> => {
      const [{ data: products, error }, { data: avail }] = await Promise.all([
        supabase.from("products").select("*").eq("shop_id", shopId!).order("created_at", { ascending: false }),
        supabase.from("product_availability").select("product_id, effective_status, declared_status, confirmed_at, out_reports, found_reports, ttl_hours").eq("shop_id", shopId!),
      ]);
      if (error) throw error;
      const byId = new Map<string, any>((avail ?? []).map((a: any) => [a.product_id, a]));
      return (products ?? []).map((p: any) => ({ ...p, ...(byId.get(p.id) ?? {}) }));
    },
  });
}

export function useProductAvailability(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-availability", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await supabase.from("product_availability").select("*").eq("product_id", productId!).maybeSingle();
      return (data ?? null) as null | { effective_status: EffectiveStatus; declared_status: DeclaredStatus; confirmed_at: string | null; out_reports: number; found_reports: number; found_last_at: string | null; ttl_hours: number; stock_qty: number | null; sale_unit: string | null; sale_conditions: string | null };
    },
  });
}

/** Index léger (id -> statut) pour le chatbot : ne renvoie que ce qui est utile, plafonné. */
export function useAvailabilityIndex() {
  return useQuery({
    queryKey: ["availability-index"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_availability").select("product_id, effective_status, confirmed_at, listing_kind, price_xaf").neq("effective_status", "unknown").limit(500);
      if (error) return new Map<string, any>();
      return new Map<string, any>((data ?? []).map((r: any) => [r.product_id, r]));
    },
    staleTime: 60 * 1000,
  });
}

export function useShopReliability(shopId: string | undefined) {
  return useQuery({
    queryKey: ["shop-reliability", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data } = await supabase.from("shop_availability_reliability").select("*").eq("shop_id", shopId!).maybeSingle();
      return (data ?? null) as null | { level: ReliabilityLevel; tracked_items: number; updates_30d: number; issues_30d: number; fresh_ratio: number | null };
    },
  });
}

// ============ RECHERCHE GÉOLOCALISÉE ============
export type SearchParams = {
  query?: string; category?: string | null; catalogItem?: string | null;
  lat?: number | null; lng?: number | null; radiusKm?: number | null;
  bounds?: { south: number; west: number; north: number; east: number } | null;
  onlyAvailable?: boolean; maxPrice?: number | null; freshMinutes?: number | null;
  city?: string | null; includeUnknown?: boolean; perShop?: number; limit?: number; enabled?: boolean;
};

const r3 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 1000) / 1000);

export function useAvailabilitySearch(p: SearchParams) {
  const q = (p.query ?? "").trim();
  const key = ["availability-search", q, p.category ?? null, p.catalogItem ?? null, r3(p.lat), r3(p.lng), p.radiusKm ?? null,
    p.bounds ? [r3(p.bounds.south), r3(p.bounds.west), r3(p.bounds.north), r3(p.bounds.east)] : null,
    !!p.onlyAvailable, p.maxPrice ?? null, p.freshMinutes ?? null, p.city ?? null, !!p.includeUnknown, p.perShop ?? 1, p.limit ?? 150];
  return useQuery({
    queryKey: key,
    enabled: p.enabled !== false,
    staleTime: 60 * 1000,
    retry: false,
    queryFn: async (): Promise<AvailabilityRow[]> => {
      const { data, error } = await supabase.rpc("availability_search", {
        p_query: q || null, p_category: p.category ?? null, p_catalog_item: p.catalogItem ?? null,
        p_lat: p.lat ?? null, p_lng: p.lng ?? null, p_radius_km: p.radiusKm ?? null,
        p_south: p.bounds?.south ?? null, p_west: p.bounds?.west ?? null, p_north: p.bounds?.north ?? null, p_east: p.bounds?.east ?? null,
        p_only_available: !!p.onlyAvailable, p_max_price: p.maxPrice ?? null, p_fresh_minutes: p.freshMinutes ?? null,
        p_city: p.city ?? null, p_include_unknown: !!p.includeUnknown, p_per_shop: p.perShop ?? 1, p_limit: p.limit ?? 150,
      });
      if (error) return [];
      return (data ?? []) as AvailabilityRow[];
    },
  });
}

export type Trouvaille = {
  product_id: string; shop_id: string; shop_name: string; neighborhood: string | null; city: string | null; lat: number | null; lng: number | null;
  product_name: string; price_xaf: number; image: string | null; category: string; effective_status: EffectiveStatus; confirmed_at: string | null;
  rating_avg: number; rating_count: number; score: number; sample_comment: string | null; sample_author: string | null;
};
export function useTrouvailles(city?: string | null) {
  return useQuery({
    queryKey: ["trouvailles", city ?? null],
    staleTime: 2 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<Trouvaille[]> => {
      const { data, error } = await supabase.rpc("get_trouvailles", { p_city: city ?? null, p_limit: 10 });
      if (error) return [];
      return (data ?? []) as Trouvaille[];
    },
  });
}

// ============ MARCHAND : déclarer / reconfirmer / créer ============
function useInvalidateAvailability() {
  const qc = useQueryClient();
  return (shopId?: string, productId?: string) => {
    if (shopId) qc.invalidateQueries({ queryKey: ["shop-catalog", shopId] });
    if (productId) qc.invalidateQueries({ queryKey: ["product-availability", productId] });
    qc.invalidateQueries({ queryKey: ["availability-search"] });
    qc.invalidateQueries({ queryKey: ["availability-index"] });
    qc.invalidateQueries({ queryKey: ["trouvailles"] });
    qc.invalidateQueries({ queryKey: ["shop-reliability"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };
}

export function useSetAvailability() {
  const inv = useInvalidateAvailability();
  return useMutation({
    mutationFn: async (i: { productId: string; shopId: string; status: "available" | "limited" | "out"; qty?: number | null; price?: number | null }) => {
      const { data, error } = await supabase.rpc("set_product_availability", { p_product_id: i.productId, p_status: i.status, p_qty: i.qty ?? null, p_price: i.price ?? null });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => inv(v.shopId, v.productId),
  });
}

export function useConfirmProductAvailability() {
  const inv = useInvalidateAvailability();
  return useMutation({
    mutationFn: async (i: { productId: string; shopId: string }) => {
      const { error } = await supabase.rpc("confirm_product_availability", { p_product_id: i.productId });
      if (error) throw error;
    },
    onSuccess: (_d, v) => inv(v.shopId, v.productId),
  });
}

export function useConfirmShopAvailability() {
  const inv = useInvalidateAvailability();
  return useMutation({
    mutationFn: async (shopId: string) => {
      const { data, error } = await supabase.rpc("confirm_shop_availability", { p_shop_id: shopId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (_d, shopId) => inv(shopId),
  });
}

export function useCreateStockItem() {
  const inv = useInvalidateAvailability();
  return useMutation({
    mutationFn: async (i: { shopId: string; name: string; category: string; catalogItemId?: string | null; price: number; status: "available" | "limited" | "out"; qty?: number | null; saleUnit?: string | null; conditions?: string | null; attributes?: Record<string, string> }) => {
      const { data, error } = await supabase.from("products").insert({
        shop_id: i.shopId, name: i.name, description: null, price_xaf: i.price, category: i.category, condition: "Neuf", images: [],
        listing_kind: "stock", catalog_item_id: i.catalogItemId ?? null, availability_status: i.status,
        stock_qty: i.status === "out" ? 0 : i.qty ?? null, sale_unit: i.saleUnit ?? null, sale_conditions: i.conditions ?? null, attributes: i.attributes ?? {},
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => inv(v.shopId),
  });
}

export function useUpdateStockItem() {
  const inv = useInvalidateAvailability();
  return useMutation({
    mutationFn: async (i: { productId: string; shopId: string; patch: { name?: string; price_xaf?: number; sale_conditions?: string | null; show_on_map?: boolean; images?: string[] } }) => {
      const { error } = await supabase.from("products").update(i.patch).eq("id", i.productId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => inv(v.shopId, v.productId),
  });
}

export function useDemandInsights(shopId: string | undefined) {
  return useQuery({
    queryKey: ["demand-insights", shopId],
    enabled: !!shopId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("merchant_demand_insights", { p_shop_id: shopId! });
      if (error) return [] as { term: string; catalog_item_id: string | null; searchers: number; waiting_alerts: number; in_catalog: boolean }[];
      return (data ?? []) as { term: string; catalog_item_id: string | null; searchers: number; waiting_alerts: number; in_catalog: boolean }[];
    },
  });
}

export function useLogSearchDemand() {
  return useMutation({
    mutationFn: async (i: { query: string; catalogItem?: string | null; neighborhood?: string | null; city?: string | null; results: number }) => {
      await supabase.rpc("log_search_demand", { p_query: i.query, p_catalog_item: i.catalogItem ?? null, p_neighborhood: i.neighborhood ?? null, p_city: i.city ?? null, p_results: i.results });
    },
  });
}

// ============ COMMUNAUTÉ : signalements ============
export type ReportKind = "found" | "out_of_stock" | "price_different" | "shop_closed" | "wrong_address";
export function useReportAvailability() {
  const inv = useInvalidateAvailability();
  return useMutation({
    mutationFn: async (i: { productId: string; shopId: string; kind: ReportKind; price?: number | null }) => {
      const { data, error } = await supabase.rpc("report_availability", { p_product_id: i.productId, p_kind: i.kind, p_price: i.price ?? null });
      if (error) throw error;
      return data as { ok: boolean; effective_status: EffectiveStatus };
    },
    onSuccess: (_d, v) => inv(v.shopId, v.productId),
  });
}

// ============ AVIS PAR ARTICLE ============
export type ProductReview = {
  id: string; product_id: string; shop_id: string; user_id: string; rating: number; comment: string | null; status: string;
  declared_exchange: boolean; merchant_reply: string | null; merchant_replied_at: string | null; created_at: string; updated_at: string;
  profiles?: { name: string; avatar_url: string | null } | null;
};

export function useProductReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-reviews", productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductReview[]> => {
      const { data, error } = await supabase.from("product_reviews").select("*, profiles(name, avatar_url)").eq("product_id", productId!).order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as ProductReview[];
    },
  });
}

export function useProductRatingStats(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-rating-stats", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await supabase.from("product_rating_stats").select("*").eq("product_id", productId!).maybeSingle();
      return data ? { avg: Number(data.avg_rating), count: data.ratings_count as number, declared: data.declared_count as number } : null;
    },
  });
}

export function useCatalogRating(catalogItemId: string | null | undefined) {
  return useQuery({
    queryKey: ["catalog-rating", catalogItemId],
    enabled: !!catalogItemId,
    queryFn: async () => {
      const { data } = await supabase.from("catalog_rating_stats").select("*").eq("catalog_item_id", catalogItemId!).maybeSingle();
      return data ? { avg: Number(data.avg_rating), count: data.ratings_count as number, shops: data.shops_count as number } : null;
    },
  });
}

function useInvalidateReviews() {
  const qc = useQueryClient();
  return (productId: string) => {
    qc.invalidateQueries({ queryKey: ["product-reviews", productId] });
    qc.invalidateQueries({ queryKey: ["product-rating-stats", productId] });
    qc.invalidateQueries({ queryKey: ["catalog-rating"] });
    qc.invalidateQueries({ queryKey: ["trouvailles"] });
    qc.invalidateQueries({ queryKey: ["availability-search"] });
  };
}

export function useSubmitReview() {
  const inv = useInvalidateReviews();
  return useMutation({
    mutationFn: async (i: { productId: string; rating: number; comment: string }) => {
      const { data, error } = await supabase.rpc("submit_product_review", { p_product_id: i.productId, p_rating: i.rating, p_comment: i.comment || null });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, v) => inv(v.productId),
  });
}

export function useDeleteMyReview() {
  const inv = useInvalidateReviews();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.rpc("delete_my_product_review", { p_product_id: productId });
      if (error) throw error;
    },
    onSuccess: (_d, productId) => inv(productId),
  });
}

export function useReplyToReview() {
  const inv = useInvalidateReviews();
  return useMutation({
    mutationFn: async (i: { reviewId: string; productId: string; reply: string }) => {
      const { error } = await supabase.rpc("reply_to_product_review", { p_review_id: i.reviewId, p_reply: i.reply });
      if (error) throw error;
    },
    onSuccess: (_d, v) => inv(v.productId),
  });
}

// ============ NOTIFICATIONS, PRÉFÉRENCES, ALERTES ============
export type AppNotification = {
  id: string; audience: "customer" | "merchant"; kind: string; title: string; body: string | null; link: string | null; data: any; read_at: string | null; created_at: string;
};

export function useNotifications() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["notifications", session?.user?.id],
    enabled: !!session?.user?.id,
    retry: false,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) return [];
      return (data ?? []) as AppNotification[];
    },
  });
}

export function useUnreadNotificationCount() {
  const { data = [] } = useNotifications();
  return data.filter((n) => !n.read_at).length;
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const { error } = await supabase.rpc("mark_notifications_read", { p_ids: ids ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/** Écoute temps réel des nouvelles notifications de l'utilisateur connecté. */
export function useNotificationsRealtime(onNew: (n: AppNotification) => void) {
  const { session } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const channel = supabase
      .channel(`notifications-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (payload) => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        onNew(payload.new as AppNotification);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);
}

export type NotifPrefs = {
  restock: boolean; price_change: boolean; new_product: boolean; merchant_reviews: boolean; merchant_reports: boolean;
  merchant_demand: boolean; merchant_reminders: boolean; max_per_day: number;
};
export const DEFAULT_PREFS: NotifPrefs = { restock: true, price_change: true, new_product: true, merchant_reviews: true, merchant_reports: true, merchant_demand: true, merchant_reminders: true, max_per_day: 12 };

export function useNotifPrefs() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["notif-prefs", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async (): Promise<NotifPrefs> => {
      const { data } = await supabase.from("notification_prefs").select("*").eq("user_id", session!.user.id).maybeSingle();
      return { ...DEFAULT_PREFS, ...(data ?? {}) } as NotifPrefs;
    },
  });
}

export function useSaveNotifPrefs() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (prefs: NotifPrefs) => {
      const { error } = await supabase.from("notification_prefs").upsert({ user_id: session!.user.id, ...prefs, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-prefs"] }),
  });
}

export type AvailabilityAlert = {
  id: string; kind: "product" | "catalog_item" | "search"; product_id: string | null; catalog_item_id: string | null; query: string | null;
  max_price_xaf: number | null; neighborhood: string | null; city: string | null; active: boolean; created_at: string;
  products?: { name: string } | null; catalog_items?: { name_fr: string; name_en: string } | null;
};

export function useMyAlerts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-alerts", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async (): Promise<AvailabilityAlert[]> => {
      const { data, error } = await supabase.from("availability_alerts").select("*, products(name), catalog_items(name_fr, name_en)").order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as AvailabilityAlert[];
    },
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (i: { kind: "product" | "catalog_item" | "search"; productId?: string | null; catalogItemId?: string | null; query?: string | null; maxPrice?: number | null; neighborhood?: string | null; city?: string | null }) => {
      const { error } = await supabase.from("availability_alerts").insert({
        user_id: session!.user.id, kind: i.kind, product_id: i.productId ?? null, catalog_item_id: i.catalogItemId ?? null,
        query: i.query ?? null, max_price_xaf: i.maxPrice ?? null, neighborhood: i.neighborhood ?? null, city: i.city ?? null,
      });
      if (error) {
        if ((error as any).code === "23505") return; // alerte déjà existante : succès silencieux
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-alerts"] }),
  });
}

export function useToggleAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { id: string; active: boolean }) => {
      const { error } = await supabase.from("availability_alerts").update({ active: i.active }).eq("id", i.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-alerts"] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("availability_alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-alerts"] }),
  });
}

// ============ ADMIN ============
export function useAdminSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<CategoryRow> & { id: string; name_fr: string; name_en: string }) => {
      const { error } = await supabase.from("product_categories").upsert({ ...c, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-categories"] }),
  });
}

export function useAdminSaveCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<CatalogItem> & { slug: string; category_id: string; name_fr: string; name_en: string }) => {
      const { error } = await supabase.from("catalog_items").upsert(c, { onConflict: "slug" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog-items"] }),
  });
}

export function useAdminReviews() {
  return useQuery({
    queryKey: ["admin-reviews"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_reviews").select("*, profiles(name), products(name)").neq("status", "visible").order("created_at", { ascending: false }).limit(50);
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useAdminSetReviewStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { reviewId: string; status: "visible" | "hidden" | "removed" }) => {
      const { error } = await supabase.rpc("admin_set_review_status", { p_review_id: i.reviewId, p_status: i.status });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });
}

// ============ RECONNAISSANCE DU PRODUIT DE RÉFÉRENCE DANS UNE RECHERCHE ============
/**
 * Renvoie le produit de référence si — et seulement si — UN SEUL produit du
 * catalogue correspond à tous les mots de la recherche (ex. « gaz 12,5 kg »).
 * Une recherche ambiguë (« gaz ») ne choisit rien : l'alerte portera alors sur le texte.
 */
export function matchCatalogItem(query: string, items: CatalogItem[]): CatalogItem | null {
  const tokens = normText(query).split(" ").filter(Boolean);
  if (tokens.length === 0 || normText(query).length < 2) return null;
  const hits = items.filter((it) => {
    if (!it.active) return false;
    const hay = normText(`${it.name_fr} ${it.name_en} ${(it.synonyms ?? []).join(" ")}`);
    return tokens.every((tk) => hay.includes(tk));
  });
  return hits.length === 1 ? hits[0] : null;
}

/** Notes moyennes de plusieurs articles en une requête (fiche boutique). */
export function useProductRatingsMap(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["product-ratings-map", key],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("product_rating_stats").select("product_id, avg_rating, ratings_count").in("product_id", ids);
      return new Map<string, { avg: number; count: number }>((data ?? []).map((r: any) => [r.product_id, { avg: Number(r.avg_rating), count: r.ratings_count as number }]));
    },
  });
}

/** Catégories proposées à la création d'une boutique / d'un article : niveau principal, hors catégories réglementées. */
export function useCreationCategories() {
  return useCategoryOptions({ topLevelOnly: true }).filter((c) => !c.is_regulated);
}
