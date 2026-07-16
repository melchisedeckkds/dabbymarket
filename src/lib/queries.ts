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

export function useCreateShop() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; description: string; category: string; logo_url?: string; lat?: number; lng?: number }) => {
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

const PUBLISH_COST = 15;
const BOOST_PRODUCT_COST = 80;
const BOOST_SHOP_COST = 120;

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
      // 1) débiter les Pépites via la fonction RPC sécurisée
      const { error: spendError } = await supabase.rpc("spend_pepites", {
        p_amount: PUBLISH_COST,
        p_type: "publish",
      });
      if (spendError) throw spendError;
      // 2) créer le produit
      const { data, error } = await supabase.from("products").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });
}

export function useBoostProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { error: spendError } = await supabase.rpc("spend_pepites", {
        p_amount: BOOST_PRODUCT_COST,
        p_type: "boost_product",
      });
      if (spendError) throw spendError;
      const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("products").update({ boosted_until: until }).eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useBoostShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_shopId: string) => {
      const { error } = await supabase.rpc("spend_pepites", {
        p_amount: BOOST_SHOP_COST,
        p_type: "boost_shop",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shops"] }),
  });
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
