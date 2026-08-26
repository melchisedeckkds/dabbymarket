import { useEffect } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

// ============ BOUTIQUES ============
export function useShops() {
  return useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useShop(id: string | undefined) {
  return useQuery({
    queryKey: ["shop", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
}

// Moyenne + nombre d'avis par boutique, pour affichage/tri compact
// (cartes produits/articles, Carte, listes) sans recharger tous les avis.
export function useShopRatingsMap(shopIds: string[]) {
  const ids = [...new Set(shopIds)].filter(Boolean).sort();
  return useQuery({
    queryKey: ["shop-ratings", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_ratings").select("*").in("shop_id", ids);
      if (error) throw error;
      const map = new Map<string, { avg: number; count: number }>();
      (data ?? []).forEach((r: any) => map.set(r.shop_id, { avg: Number(r.avg_rating), count: r.ratings_count }));
      return map;
    },
  });
}

// Ensemble des cibles (produits ou boutiques) actuellement boostées pour
// un type de boost précis — utilisé pour l'encart "mis en avant" et le
// bonus de rang plafonné (jamais un réordonnancement libre).
export function useActiveBoostIds(targetType: "product" | "shop", boostType: string) {
  return useQuery({
    queryKey: ["active-boost-ids", targetType, boostType],
    queryFn: async () => {
      const { data, error } = await supabase.from("active_boosts").select("target_id").eq("target_type", targetType).eq("boost_type", boostType);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.target_id as string));
    },
    staleTime: 60 * 1000,
  });
}

// Applique un bonus de rang plafonné (jamais un réordonnancement libre) :
// chaque élément boosté remonte d'au plus `cap` places dans le classement
// organique déjà calculé — il ne peut jamais dépasser un résultat
// nettement plus pertinent ou plus proche situé plus de `cap` places devant.
export function applyRankCap<T extends { id: string }>(sorted: T[], boostedIds: Set<string>, cap: number): T[] {
  const arr = [...sorted];
  sorted.forEach((item) => {
    if (!boostedIds.has(item.id)) return;
    const idx = arr.findIndex((x) => x.id === item.id);
    if (idx <= 0) return;
    const newIdx = Math.max(0, idx - cap);
    const [moved] = arr.splice(idx, 1);
    arr.splice(newIdx, 0, moved);
  });
  return arr;
}

// ============ EMPLACEMENTS MULTIPLES (succursales + historique) ============
// Une boutique physique peut avoir plusieurs emplacements actifs
// (succursales) et un historique de déménagements — voir 0015.

export function useActiveShopLocations() {
  return useQuery({
    queryKey: ["active-shop-locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("active_shop_locations").select("*");
      if (error) throw error;
      return data;
    },
  });
}

// Tous les emplacements d'une boutique (actifs ET historiques), pour la
// page boutique — affiche les succursales en cours et l'historique des
// anciennes adresses.
export function useShopLocations(shopId: string | undefined) {
  return useQuery({
    queryKey: ["shop-locations", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_locations").select("*").eq("shop_id", shopId!).order("moved_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddShopLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { shopId: string; lat: number; lng: number; neighborhood: string; city: string; landmark?: string; label?: string }) => {
      const { data, error } = await supabase.rpc("add_shop_location", {
        p_shop_id: input.shopId, p_lat: input.lat, p_lng: input.lng,
        p_neighborhood: input.neighborhood, p_city: input.city, p_landmark: input.landmark ?? null, p_label: input.label ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["shop-locations", vars.shopId] });
      qc.invalidateQueries({ queryKey: ["active-shop-locations"] });
    },
  });
}

export function useRelocateShopLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { locationId: string; shopId: string; lat: number; lng: number; neighborhood: string; city: string; landmark?: string }) => {
      const { data, error } = await supabase.rpc("relocate_shop_location", {
        p_location_id: input.locationId, p_lat: input.lat, p_lng: input.lng,
        p_neighborhood: input.neighborhood, p_city: input.city, p_landmark: input.landmark ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["shop-locations", vars.shopId] });
      qc.invalidateQueries({ queryKey: ["active-shop-locations"] });
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["shop", vars.shopId] });
    },
  });
}

export function useCloseShopLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { locationId: string; shopId: string }) => {
      const { error } = await supabase.rpc("close_shop_location", { p_location_id: input.locationId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["shop-locations", vars.shopId] });
      qc.invalidateQueries({ queryKey: ["active-shop-locations"] });
    },
  });
}

export function useUpdateShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      shopId: string; logo_url?: string; name?: string; description?: string;
      shop_type?: "physical" | "no_location"; neighborhood?: string; city?: string; landmark?: string;
      photos?: string[]; delivery_zone?: string; hours?: any; lat?: number; lng?: number;
    }) => {
      const { shopId, ...patch } = input;
      const { error } = await supabase.from("shops").update(patch).eq("id", shopId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["shop", vars.shopId] });
      qc.invalidateQueries({ queryKey: ["my-shops"] });
    },
  });
}

export function useCreateShop() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      name: string; description: string; category: string; logo_url?: string; lat?: number; lng?: number;
      shop_type?: "physical" | "no_location"; neighborhood?: string; city?: string; landmark?: string;
      photos?: string[]; delivery_zone?: string; hours?: any;
    }) => {
      if (!session?.user?.id) throw new Error("Connecte-toi d'abord");
      const { data, error } = await supabase
        .from("shops")
        .insert({ ...input, owner_id: session.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shops"] }),
  });
}

export function useMyShops() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-shops", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("*").eq("owner_id", session!.user.id);
      if (error) throw error;
      return data;
    },
  });
}

// ============ PRODUITS ============
export function useProducts(shopId?: string) {
  return useQuery({
    queryKey: ["products", shopId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("products").select("*, shops(*)").order("created_at", { ascending: false });
      if (shopId) q = q.eq("shop_id", shopId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

const PRODUCTS_PAGE_SIZE = 24;

// Chargement progressif ("Charger plus") pour Le Marché — évite de tout
// charger d'un coup quand le nombre de produits grandit fortement.
export function useInfiniteProducts() {
  return useInfiniteQuery({
    queryKey: ["products-infinite"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PRODUCTS_PAGE_SIZE;
      const to = from + PRODUCTS_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("products")
        .select("*, shops(*)")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (lastPage, allPages) => (lastPage.length < PRODUCTS_PAGE_SIZE ? undefined : allPages.length),
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, shops(*)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
}

// ============ MODÈLE ÉCONOMIQUE v1 — config, packs, boosts ============
// Gratuit pour être découvert (création boutique, publication, quota
// d'articles actifs), payant uniquement pour la mise en avant (boosts).

export function useAppConfig() {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_config").select("*");
      if (error) throw error;
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => (map[r.key] = r.value));
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePepitePacks() {
  return useQuery({
    queryKey: ["pepite-packs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pepite_packs").select("*").eq("active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useBoostCatalog() {
  return useQuery({
    queryKey: ["boost-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("boost_catalog").select("*").eq("active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

// Boosts actuellement actifs pour une cible précise (affichage du/des
// badge(s) "sponsorisé" sur sa fiche, cumul de plusieurs types possible).
export function useActiveBoosts(targetType: "product" | "shop", targetId: string | undefined) {
  return useQuery({
    queryKey: ["active-boosts", targetType, targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase.from("active_boosts").select("*").eq("target_type", targetType).eq("target_id", targetId!);
      if (error) throw error;
      return data;
    },
  });
}

export function usePurchaseBoost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetType: "product" | "shop"; targetId: string; boostCatalogId: string }) => {
      const { data, error } = await supabase.rpc("purchase_boost", {
        p_target_type: input.targetType,
        p_target_id: input.targetId,
        p_boost_catalog_id: input.boostCatalogId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["active-boosts", vars.targetType, vars.targetId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });
}

export function usePurchaseHomeFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetType: "product" | "shop"; targetId: string }) => {
      const { data, error } = await supabase.rpc("purchase_home_feature", {
        p_target_type: input.targetType,
        p_target_id: input.targetId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });
}

// Nombre d'articles actifs d'une boutique, pour afficher clairement où
// elle se situe par rapport au quota gratuit (ex. "4/3 — 1 article payant").
export function useShopActiveListingCount(shopId: string | undefined) {
  return useQuery({
    queryKey: ["shop-active-listing-count", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { count, error } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("shop_id", shopId!).eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function usePublishProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      shop_id: string;
      name: string;
      description: string;
      price_xaf: number;
      category: string;
      condition: "Neuf" | "Occasion";
      images: string[];
    }) => {
      // Publier un article est gratuit dans la limite du quota (Modèle 1) ;
      // au-delà, la facturation récurrente (10 Pépites/mois par article
      // supplémentaire) est prélevée par une tâche planifiée mensuelle, pas
      // à la publication — voir bill_quota_overage() côté base de données.
      const { data, error } = await supabase.from("products").insert(input).select().single();
      if (error) throw error;
      // Verse le bonus de bienvenue si c'est le 1er article avec photo de
      // ce vendeur ; ne bloque jamais la publication si cet appel échoue.
      supabase.rpc("grant_welcome_bonus_if_eligible", { p_product_id: data.id }).then(({ error: bonusError }) => {
        if (bonusError) console.error("grant_welcome_bonus_if_eligible:", bonusError);
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["shop-active-listing-count"] });
    },
  });
}

/** @deprecated Remplacé par usePurchaseBoost({ targetType:"product", boostCatalogId:"article_24h"|"article_48h"|"article_7d" }). Conservé pour compatibilité ascendante immédiate de l'UI existante — achète le Boost Article 24h. */
export function useBoostProduct() {
  const purchase = usePurchaseBoost();
  return { ...purchase, mutateAsync: (productId: string) => purchase.mutateAsync({ targetType: "product", targetId: productId, boostCatalogId: "article_24h" }) };
}

/** @deprecated Remplacé par usePurchaseBoost({ targetType:"shop", boostCatalogId:"shop_3d"|"shop_7d"|"shop_30d" }). Conservé pour compatibilité ascendante immédiate de l'UI existante — achète le Boost Boutique 3 jours. */
export function useBoostShop() {
  const purchase = usePurchaseBoost();
  return { ...purchase, mutateAsync: (shopId: string) => purchase.mutateAsync({ targetType: "shop", targetId: shopId, boostCatalogId: "shop_3d" }) };
}

// ============ POSTS (feed) ============
export function usePosts() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*, profiles(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

const POSTS_PAGE_SIZE = 12;

// Version paginée pour le scroll infini du Marché (voir useInfiniteProducts)
export function useInfinitePosts() {
  return useInfiniteQuery({
    queryKey: ["posts-infinite"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * POSTS_PAGE_SIZE;
      const to = from + POSTS_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("posts")
        .select("*, profiles(*)")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (lastPage, allPages) => (lastPage.length < POSTS_PAGE_SIZE ? undefined : allPages.length),
  });
}

// Récupère une publication précise (lien profond depuis le profil), même
// si elle n'est pas encore chargée dans le fil paginé du Marché.
export function useSinglePost(postId: string | undefined) {
  return useQuery({
    queryKey: ["post", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*, profiles(*)").eq("id", postId).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { text: string; image_url?: string }) => {
      const { data, error } = await supabase.from("posts").insert({ ...input, author_id: session!.user.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}

// ============ COUPS DE CŒUR (likes) ============
export function useToggleLike() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({ productId, postId, liked }: { productId?: string; postId?: string; liked: boolean }) => {
      if (!session?.user?.id) throw new Error("Connecte-toi d'abord");
      if (liked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", session.user.id)
          .match(productId ? { product_id: productId } : { post_id: postId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({
          user_id: session.user.id,
          product_id: productId ?? null,
          post_id: postId ?? null,
        });
        if (error) throw error;
      }
    },
    onMutate: async ({ productId, postId, liked }) => {
      const key = ["likes", productId ?? postId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<any[]>(key);
      if (previous && session?.user?.id) {
        qc.setQueryData(
          key,
          liked ? previous.filter((l) => l.user_id !== session.user.id) : [...previous, { user_id: session.user.id, product_id: productId, post_id: postId }],
        );
      }
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context) qc.setQueryData(context.key, context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["likes"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useLikes(productId?: string, postId?: string) {
  return useQuery({
    queryKey: ["likes", productId ?? postId],
    enabled: !!(productId || postId),
    queryFn: async () => {
      let q = supabase.from("likes").select("*");
      q = productId ? q.eq("product_id", productId) : q.eq("post_id", postId!);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

// ============ COMMENTAIRES ============
export function useComments(productId?: string, postId?: string) {
  return useQuery({
    queryKey: ["comments", productId ?? postId],
    enabled: !!(productId || postId),
    queryFn: async () => {
      let q = supabase.from("comments").select("*, profiles(*)").order("created_at", { ascending: true });
      q = productId ? q.eq("product_id", productId) : q.eq("post_id", postId!);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({ productId, postId, text }: { productId?: string; postId?: string; text: string }) => {
      const { error } = await supabase.from("comments").insert({
        user_id: session!.user.id,
        product_id: productId ?? null,
        post_id: postId ?? null,
        text,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments"] }),
  });
}

// ============ PANIER D'ENVIE ============
export function useWishlist() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["wishlist", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("wishlist").select("*, products(*)").eq("user_id", session!.user.id);
      if (error) throw error;
      return data;
    },
  });
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({ productId, saved }: { productId: string; saved: boolean }) => {
      if (saved) {
        const { error } = await supabase.from("wishlist").delete().eq("user_id", session!.user.id).eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wishlist").insert({ user_id: session!.user.id, product_id: productId });
        if (error) throw error;
      }
    },
    onMutate: async ({ productId, saved }) => {
      const key = ["wishlist", session?.user?.id];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<any[]>(key);
      if (previous) {
        qc.setQueryData(key, saved ? previous.filter((w) => w.product_id !== productId) : [...previous, { product_id: productId, user_id: session?.user?.id }]);
      }
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context) qc.setQueryData(context.key, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });
}

// ============ MESSAGERIE ============
export function useConversations() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["conversations", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, shops(*), products(*)")
        .or(`buyer_id.eq.${session!.user.id},seller_id.eq.${session!.user.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({ sellerId, shopId, productId }: { sellerId: string; shopId?: string; productId?: string }) => {
      const { data, error } = await supabase
        .from("conversations")
        .upsert(
          { buyer_id: session!.user.id, seller_id: sellerId, shop_id: shopId, product_id: productId },
          { onConflict: "buyer_id,seller_id,product_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useMessages(conversationId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Temps réel : nouveaux messages poussés instantanément
  useSubscribeMessages(conversationId, qc);

  return query;
}

function useSubscribeMessages(conversationId: string | undefined, qc: QueryClient) {
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", conversationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);
}

export function useSendMessage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({
      conversationId,
      text,
      sharedLat,
      sharedLng,
    }: {
      conversationId: string;
      text?: string;
      sharedLat?: number;
      sharedLng?: number;
    }) => {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: session!.user.id,
        text,
        shared_lat: sharedLat,
        shared_lng: sharedLng,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["messages", vars.conversationId] }),
  });
}

export function useConfirmOrderReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc("confirm_order_received", { p_conversation_id: conversationId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

// ============ AVIS ============
export function useReviews(shopId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*, profiles(*)").eq("shop_id", shopId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useAddReview() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { shopId: string; conversationId: string; rating: number; comment: string }) => {
      const { error } = await supabase.from("reviews").insert({
        shop_id: input.shopId,
        conversation_id: input.conversationId,
        rating: input.rating,
        comment: input.comment,
        user_id: session!.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

// ============ PÉPITES — recharge réelle ============
export function useRequestRecharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { amount: number; method: "OrangeMoney" | "MTNMoMo" | "card"; reference: string }) => {
      const { data, error } = await supabase.rpc("request_recharge", {
        p_amount: input.amount,
        p_method: input.method,
        p_reference: input.reference,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-transactions"] }),
  });
}

export function useMyTransactions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-transactions", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pepites_transactions")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ============ ADMIN ============
export function usePendingRecharges() {
  return useQuery({
    queryKey: ["pending-recharges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pepites_transactions")
        .select("*, profiles(*)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useConfirmRecharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { transactionId: string; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc("confirm_recharge", {
        p_transaction_id: input.transactionId,
        p_approve: input.approve,
        p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-recharges"] }),
  });
}

export function useAdminShops() {
  return useQuery({
    queryKey: ["admin-shops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("*, profiles(name, phone)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSetShopBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { shopId: string; blocked: boolean; reason?: string }) => {
      const { error } = await supabase.rpc("admin_set_shop_blocked", {
        p_shop_id: input.shopId,
        p_blocked: input.blocked,
        p_reason: input.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shops"] });
      qc.invalidateQueries({ queryKey: ["shops"] });
    },
  });
}

export function useSetShopVerified() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { shopId: string; verified: boolean }) => {
      const { error } = await supabase.rpc("admin_set_shop_verified", { p_shop_id: input.shopId, p_verified: input.verified });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shops"] });
      qc.invalidateQueries({ queryKey: ["shops"] });
    },
  });
}

export function useAdminDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.rpc("admin_delete_post", { p_post_id: postId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useAdminDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.rpc("admin_delete_product", { p_product_id: productId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["admin-metrics"] });
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSuspendAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; suspended: boolean }) => {
      const { error } = await supabase.rpc("admin_suspend_account", { p_user_id: input.userId, p_suspended: input.suspended });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useAdminDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("admin_delete_account", { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-shops"] });
      qc.invalidateQueries({ queryKey: ["admin-metrics"] });
    },
  });
}

export function useAdjustPepites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; amount: number; note?: string }) => {
      const { error } = await supabase.rpc("admin_adjust_pepites", { p_user_id: input.userId, p_amount: input.amount, p_note: input.note ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

// ============ SIGNALEMENTS ============
export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, profiles(name, phone)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateReport() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { targetType: "shop" | "product" | "post" | "user"; targetId: string; reason: string }) => {
      const { error } = await supabase.from("reports").insert({
        reporter_id: session!.user.id,
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason,
      });
      if (error) throw error;
    },
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reportId: string; status: "resolved" | "dismissed" }) => {
      const { error } = await supabase.rpc("admin_resolve_report", { p_report_id: input.reportId, p_status: input.status });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

// ============ PROFILS PUBLICS ============
export function useUpdateProfile() {
  const qc = useQueryClient();
  const { session, refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async (input: { name?: string; avatar_url?: string }) => {
      const { error } = await supabase.from("profiles").update(input).eq("id", session!.user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUserShops(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-shops", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("*").eq("owner_id", userId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUserPosts(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-posts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*, profiles(*)").eq("author_id", userId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ============ SUGGESTIONS ============
export function useSuggestions() {
  return useQuery({
    queryKey: ["suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suggestions").select("*, profiles(*)").order("votes_count", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddSuggestion() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { type: "idee" | "bug" | "amelioration"; text: string }) => {
      const { error } = await supabase.from("suggestions").insert({ ...input, user_id: session!.user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suggestions"] }),
  });
}

export function useVoteSuggestion() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase.from("suggestion_votes").insert({ suggestion_id: suggestionId, user_id: session!.user.id });
      if (error) throw error;
      // Le compteur votes_count est mis à jour automatiquement par un trigger SQL (voir migration 0003)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suggestions"] }),
  });
}

// ============ MESSAGES NON LUS (précis) ============
export function useUnreadCount() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["unread-count", session?.user?.id],
    enabled: !!session?.user?.id,
    refetchInterval: 30000, // rafraîchi régulièrement pour rester à jour sans websocket dédié
    queryFn: async () => {
      const { data, error } = await supabase.rpc("unread_messages_count");
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unread-count"] }),
  });
}

// ============ UPLOAD D'IMAGES ============
export async function uploadImage(bucket: "shop-logos" | "product-images" | "avatars" | "post-images", userId: string, file: File) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImages(bucket: "shop-logos" | "product-images" | "avatars" | "post-images", userId: string, files: File[]) {
  const urls: string[] = [];
  for (const f of files) {
    urls.push(await uploadImage(bucket, userId, f));
  }
  return urls;
}

// ============ VUES (réelles, avec historique horodaté) ============
const seenThisSession = new Set<string>();

export function useRecordView(targetType: "product" | "shop", targetId: string | undefined) {
  useEffect(() => {
    if (!targetId) return;
    const key = `${targetType}:${targetId}`;
    if (seenThisSession.has(key)) return; // une seule vue comptée par session pour éviter le gonflement au refresh
    seenThisSession.add(key);
    supabase.rpc("record_view", { p_target_type: targetType, p_target_id: targetId }).then(() => {});
  }, [targetType, targetId]);
}

export function useViewsCount(targetType: "product" | "shop", targetId: string | undefined) {
  return useQuery({
    queryKey: ["views-count", targetType, targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { count } = await supabase
        .from("views")
        .select("id", { count: "exact", head: true })
        .eq("target_type", targetType)
        .eq("target_id", targetId!);
      return count ?? 0;
    },
  });
}

function last7DaysLabels() {
  const days = ["D", "L", "M", "M", "J", "V", "S"];
  const out: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ key: d.toISOString().slice(0, 10), label: days[d.getDay()] });
  }
  return out;
}

function bucketByDay(rows: { created_at: string }[]) {
  const days = last7DaysLabels();
  const counts = new Map(days.map((d) => [d.key, 0]));
  rows.forEach((r) => {
    const key = r.created_at.slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return { values: days.map((d) => counts.get(d.key) ?? 0), labels: days.map((d) => d.label) };
}

// Vues reçues (produits + boutique) sur 7 jours, pour un vendeur
export function useMyViews7d(shopIds: string[], productIds: string[]) {
  return useQuery({
    queryKey: ["my-views-7d", shopIds, productIds],
    enabled: shopIds.length > 0 || productIds.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const queries = [];
      if (shopIds.length) queries.push(supabase.from("views").select("created_at").eq("target_type", "shop").in("target_id", shopIds).gte("created_at", since));
      if (productIds.length) queries.push(supabase.from("views").select("created_at").eq("target_type", "product").in("target_id", productIds).gte("created_at", since));
      const results = await Promise.all(queries);
      const rows = results.flatMap((r) => r.data ?? []);
      return bucketByDay(rows);
    },
  });
}

// Pépites consommées sur 7 jours, marché entier (admin)
export function usePepites7d() {
  return useQuery({
    queryKey: ["pepites-7d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from("pepites_transactions").select("created_at, amount").lt("amount", 0).eq("status", "confirmed").gte("created_at", since);
      return bucketByDay(data ?? []);
    },
  });
}

// Vues totales sur 7 jours, marché entier (admin)
export function useViews7d() {
  return useQuery({
    queryKey: ["views-7d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from("views").select("created_at").gte("created_at", since);
      return bucketByDay(data ?? []);
    },
  });
}

// ============ TRANSFÉRER UN PRODUIT VERS UNE AUTRE DE SES BOUTIQUES ============
export function useMoveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, newShopId }: { productId: string; newShopId: string }) => {
      const { error } = await supabase.from("products").update({ shop_id: newShopId }).eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["my-shop-stats"] });
    },
  });
}
