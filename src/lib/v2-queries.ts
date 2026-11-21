// DabbyMarket 2.0 — requêtes pour : recherche catalogue, vitrine, confiance (notes, exactitude,
// fiabilité, badges), santé. Séparé de queries.ts pour ne pas alourdir l'existant.
// Toutes les règles métier vivent en base (migrations 0020 à 0022) ; ces hooks ne font que les appeler.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

// ============ RECHERCHE CATALOGUE (0020) ============
export type CatalogRow = {
  product_id: string; name: string; description: string | null; price_xaf: number | null; category: string;
  condition: "Neuf" | "Occasion"; images: string[]; created_at: string; listing_kind: string; is_showcased: boolean;
  shop_id: string; shop_name: string; shop_logo: string | null; shop_verified: boolean; owner_id: string;
  neighborhood: string | null; city: string | null; lat: number | null; lng: number | null;
  effective_status: string; confirmed_at: string | null; stock_qty: number | null; sale_unit: string | null;
  sponsored: boolean; relevance: number; distance_km: number | null;
};

export type CatalogFilters = {
  q?: string; category?: string | null; city?: string | null; neighborhood?: string | null;
  lat?: number | null; lng?: number | null; radiusKm?: number | null; onlyAvailable?: boolean; maxPrice?: number | null;
};

const CATALOG_PAGE = 24;

/** Recherche serveur : tout produit actif est trouvable, même en rupture ou non confirmé. */
export function useCatalogSearch(filters: CatalogFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["catalog-search", filters],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("catalog_search", {
        p_query: filters.q?.trim() || null,
        p_category: filters.category ?? null,
        p_city: filters.city ?? null,
        p_neighborhood: filters.neighborhood ?? null,
        p_lat: filters.lat ?? null,
        p_lng: filters.lng ?? null,
        p_radius_km: filters.radiusKm ?? null,
        p_only_available: !!filters.onlyAvailable,
        p_max_price: filters.maxPrice ?? null,
        p_limit: CATALOG_PAGE,
        p_offset: pageParam * CATALOG_PAGE,
      });
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
    getNextPageParam: (last, all) => (last.length < CATALOG_PAGE ? undefined : all.length),
  });
}

/** Journalise la demande (anonymisée côté base ; les requêtes de santé sont ignorées par le serveur). */
export async function logSearchDemand(query: string, results: number, neighborhood?: string | null, city?: string | null) {
  try {
    await supabase.rpc("log_search_demand", {
      p_query: query, p_catalog_item: null, p_neighborhood: neighborhood ?? null, p_city: city ?? null, p_results: results,
    });
  } catch { /* la journalisation ne doit jamais gêner la recherche */ }
}

// ============ VITRINE (0020) ============
export type ShowcaseUsage = { showcased: number; showcase_limit: number; catalog_items: number; catalog_cap: number; next_slot_expiry: string | null };

export function useShowcaseUsage(shopId: string | undefined) {
  return useQuery({
    queryKey: ["showcase-usage", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("shop_showcase_usage", { p_shop_id: shopId! });
      if (error) throw error;
      return ((data as ShowcaseUsage[] | null)?.[0] ?? null) as ShowcaseUsage | null;
    },
  });
}

export function useSetShowcase(shopId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { productId: string; on: boolean }) => {
      const { error } = await supabase.rpc("set_showcase", { p_product_id: input.productId, p_on: input.on });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["showcase-usage", shopId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-infinite"] });
    },
  });
}

export function useBuyShowcaseSlot(shopId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("buy_showcase_slot", { p_shop_id: shopId! });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["showcase-usage", shopId] });
      qc.invalidateQueries({ queryKey: ["my-transactions"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// ============ CONFIANCE (0021) ============
export type ShopTrust = {
  avg: number | null; ratingsCount: number;
  accuracyPct: number | null; reports90d: number; reporters90d: number;
  reliability: "normal" | "watch" | "unreliable" | "boost_suspended";
  reliabilityNote: string | null;
};

export function useShopTrust(shopId: string | undefined) {
  return useQuery({
    queryKey: ["shop-trust", shopId],
    enabled: !!shopId,
    queryFn: async (): Promise<ShopTrust> => {
      const [rating, acc, shop, cfg] = await Promise.all([
        supabase.from("shop_ratings").select("avg_rating, ratings_count").eq("shop_id", shopId!).maybeSingle(),
        supabase.from("shop_accuracy_stats").select("accuracy_pct, reports_90d, reporters_90d").eq("shop_id", shopId!).maybeSingle(),
        supabase.from("shops").select("reliability_status, reliability_note").eq("id", shopId!).maybeSingle(),
        supabase.from("app_config").select("key, value").in("key", ["accuracy_min_reports", "accuracy_min_reporters"]),
      ]);
      const c = new Map((cfg.data ?? []).map((r: any) => [r.key, Number(r.value)]));
      const minReports = c.get("accuracy_min_reports") ?? 5;
      const minReporters = c.get("accuracy_min_reporters") ?? 3;
      const reports = acc.data?.reports_90d ?? 0;
      const reporters = acc.data?.reporters_90d ?? 0;
      return {
        avg: rating.data?.avg_rating != null ? Number(rating.data.avg_rating) : null,
        ratingsCount: rating.data?.ratings_count ?? 0,
        // Un taux n'est affiché qu'avec assez de signalements et de signalants distincts.
        accuracyPct: reports >= minReports && reporters >= minReporters && acc.data?.accuracy_pct != null ? Number(acc.data.accuracy_pct) : null,
        reports90d: reports,
        reporters90d: reporters,
        reliability: ((shop.data as any)?.reliability_status ?? "normal") as ShopTrust["reliability"],
        reliabilityNote: (shop.data as any)?.reliability_note ?? null,
      };
    },
  });
}

export type ShopReviewRow = {
  id: string; rating: number; comment: string | null; evidence: "received" | "report" | "contact" | "route";
  created_at: string; user_id: string; profiles: { name: string | null; avatar_url: string | null } | null;
};

export function useShopReviewsV2(shopId: string | undefined) {
  return useQuery({
    queryKey: ["shop-reviews-v2", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, evidence, created_at, user_id, profiles(name, avatar_url)")
        .eq("shop_id", shopId!)
        .eq("status", "visible")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ShopReviewRow[];
    },
  });
}

export function useSubmitShopReview(shopId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { rating: number; comment?: string }) => {
      const { error } = await supabase.rpc("submit_shop_review", {
        p_shop_id: shopId!, p_rating: input.rating, p_comment: input.comment?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const k of ["shop-trust", "shop-reviews-v2", "shop-ratings", "reviews", "rating-prompts"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export function useDeleteMyShopReview(shopId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_my_shop_review", { p_shop_id: shopId! });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const k of ["shop-trust", "shop-reviews-v2", "shop-ratings", "reviews"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

/** Enregistre un contact ou une demande d'itinéraire (preuve légère qui autorise ensuite à noter). */
export async function recordInteraction(shopId: string, productId: string | null, kind: "route" | "contact") {
  try {
    await supabase.rpc("record_interaction", { p_shop_id: shopId, p_product_id: productId, p_kind: kind });
  } catch { /* jamais bloquant */ }
}

export type RatingPrompt = { trace_id: string; shop_id: string; product_id: string | null; shop_name: string; product_name: string | null; kind: string; created_at: string };

export function useRatingPrompts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["rating-prompts", session?.user?.id],
    enabled: !!session?.user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pending_rating_prompts");
      if (error) throw error;
      return (data ?? []) as RatingPrompt[];
    },
  });
}

export function useDismissRatingPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (traceId: string) => {
      const { error } = await supabase.rpc("dismiss_rating_prompt", { p_trace_id: traceId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rating-prompts"] }),
  });
}

export function useContributorBadge(userId: string | undefined) {
  return useQuery({
    queryKey: ["contributor-badge", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contributor_badges").select("level, contributions").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as { level: "none" | "bronze" | "silver" | "gold"; contributions: number } | null;
    },
  });
}

export function useAppealReliability(shopId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase.rpc("appeal_reliability", { p_shop_id: shopId!, p_message: message });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appeals", shopId] }),
  });
}

export function useMyAppeals(shopId: string | undefined) {
  return useQuery({
    queryKey: ["my-appeals", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase.from("reliability_appeals").select("*").eq("shop_id", shopId!).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---- Administration : avis, fiabilité, contestations ----
export function useAdminReviewAnomalies() {
  return useQuery({
    queryKey: ["admin-review-anomalies"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_review_anomalies");
      if (error) throw error;
      return (data ?? []) as { shop_id: string; shop_name: string; reviews_30d: number; young_account_share: number }[];
    },
  });
}

export function useAdminShopReviews(shopId: string | undefined) {
  return useQuery({
    queryKey: ["admin-shop-reviews", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews").select("id, rating, comment, evidence, weight, status, created_at, profiles(name)")
        .eq("shop_id", shopId!).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminSetReviewStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reviewId: string; status: "visible" | "hidden" | "removed" }) => {
      const { error } = await supabase.rpc("admin_set_shop_review_status", { p_review_id: input.reviewId, p_status: input.status });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const k of ["admin-shop-reviews", "shop-trust", "shop-reviews-v2", "admin-review-anomalies"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export function useAdminReliabilityShops() {
  return useQuery({
    queryKey: ["admin-reliability-shops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shops").select("id, name, reliability_status, reliability_note, reliability_manual, reliability_review_after")
        .neq("reliability_status", "normal").order("reliability_updated_at", { ascending: false, nullsFirst: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminSetReliability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { shopId: string; status: "normal" | "watch" | "unreliable" | "boost_suspended"; note?: string }) => {
      const { error } = await supabase.rpc("admin_set_reliability", { p_shop_id: input.shopId, p_status: input.status, p_note: input.note ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reliability-shops"] }),
  });
}

export function useAdminAppeals() {
  return useQuery({
    queryKey: ["admin-appeals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reliability_appeals").select("id, shop_id, message, status, created_at, shops(name)")
        .eq("status", "open").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useAdminResolveAppeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { appealId: string; accept: boolean; note?: string }) => {
      const { error } = await supabase.rpc("admin_resolve_appeal", { p_appeal_id: input.appealId, p_accept: input.accept, p_note: input.note ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-appeals"] });
      qc.invalidateQueries({ queryKey: ["admin-reliability-shops"] });
    },
  });
}

// ============ SANTÉ (0022) ============
export type HealthFacility = {
  shop_id: string; name: string; city: string | null; neighborhood: string | null; landmark: string | null;
  lat: number | null; lng: number | null; hours: unknown; facility_type: string; verified_at: string | null; on_duty_now: boolean;
};

export function useHealthFacilities() {
  return useQuery({
    queryKey: ["health-facilities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("health_facilities_public").select("*").order("on_duty_now", { ascending: false }).order("name");
      if (error) throw error;
      return (data ?? []) as HealthFacility[];
    },
  });
}

export function useMyHealthProfile(shopId: string | undefined) {
  return useQuery({
    queryKey: ["my-health-profile", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase.from("health_profiles").select("*").eq("shop_id", shopId!).maybeSingle();
      if (error) throw error;
      return data as null | { shop_id: string; facility_type: string; authorization_ref: string; responsible_name: string; status: string; review_note: string | null; expires_at: string | null };
    },
  });
}

export function useSubmitHealthProfile(shopId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { facilityType: string; authorizationRef: string; responsibleName: string }) => {
      const { error } = await supabase.rpc("submit_health_profile", {
        p_shop: shopId!, p_facility_type: input.facilityType, p_authorization_ref: input.authorizationRef, p_responsible_name: input.responsibleName,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-health-profile", shopId] }),
  });
}

export function useDutyPeriods(shopId: string | undefined) {
  return useQuery({
    queryKey: ["duty-periods", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase.from("health_duty_periods").select("*").eq("shop_id", shopId!).gte("ends_at", new Date().toISOString()).order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddDutyPeriod(shopId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { startsAt: string; endsAt: string; note?: string }) => {
      const { error } = await supabase.from("health_duty_periods").insert({ shop_id: shopId!, starts_at: input.startsAt, ends_at: input.endsAt, note: input.note || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["duty-periods", shopId] }); qc.invalidateQueries({ queryKey: ["health-facilities"] }); },
  });
}

export function useDeleteDutyPeriod(shopId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("health_duty_periods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["duty-periods", shopId] }); qc.invalidateQueries({ queryKey: ["health-facilities"] }); },
  });
}

export function useHealthConfig() {
  return useQuery({
    queryKey: ["health-config"],
    queryFn: async () => {
      const { data } = await supabase.from("app_config").select("key, value").in("key", ["health_s2_enabled", "health_show_prices"]);
      const m = new Map((data ?? []).map((r: any) => [r.key, String(r.value)]));
      return { s2Enabled: m.get("health_s2_enabled") === "1", showPrices: m.get("health_show_prices") === "1" };
    },
  });
}

// ---- Administration santé ----
export function useAdminHealthProfiles(status: string) {
  return useQuery({
    queryKey: ["admin-health-profiles", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_profiles").select("*, shops(name, city, neighborhood)").eq("status", status).order("updated_at", { ascending: true }).limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useAdminSetHealthStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { shopId: string; status: "verified" | "rejected" | "suspended"; note?: string }) => {
      const { error } = await supabase.rpc("admin_set_health_status", { p_shop: input.shopId, p_status: input.status, p_note: input.note ?? null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-health-profiles"] }); qc.invalidateQueries({ queryKey: ["health-facilities"] }); },
  });
}

export function useAdminDrugs() {
  return useQuery({
    queryKey: ["admin-drugs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drug_reference").select("*, catalog_items(name_fr, slug)").order("dci").limit(300);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useAdminAddDrug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nameFr: string; dci: string; dosage: string; forme: string; rxStatus: "prescription" | "otc_listed" | "controlled" }) => {
      const slug = input.nameFr.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data: item, error: e1 } = await supabase
        .from("catalog_items").insert({ category_id: "sante-pharmacie", name_fr: input.nameFr, name_en: input.nameFr, slug }).select("id").single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("drug_reference").insert({
        catalog_item_id: item.id, dci: input.dci, dosage: input.dosage || null, forme: input.forme || null, rx_status: input.rxStatus,
      });
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-drugs"] }),
  });
}

export function useAdminSetConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; value: string }) => {
      const { error } = await supabase.rpc("admin_update_config", { p_key: input.key, p_value: Number(input.value) });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-config"] }); qc.invalidateQueries({ queryKey: ["health-config"] }); },
  });
}
