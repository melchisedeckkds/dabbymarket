// DabbyMap — accès aux données des repères (fonctions SQL de la migration 0024).
// Toutes les LECTURES retombent sur une liste vide si la migration n'est pas appliquée :
// l'application existante continue de fonctionner comme avant.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export type Landmark = {
  id: string;
  name: string;
  category_code: string;
  lat: number;
  lng: number;
  importance: number;
  verification_status: "unverified" | "located" | "verified" | "claimed_verified" | "institutional";
  access_hint: string | null;
  distance_m?: number;
  thumbnail_path?: string | null;
};

export const CATEGORY_EMOJI: Record<string, string> = {
  repere_routier: "⭕", station_service: "⛽", commerce: "🛒", institution: "🏛️", education: "🎓",
  sante: "➕", transport: "🚌", communautaire: "⛪", remarquable: "⭐", autre: "📍",
};
export const CATEGORY_CODES = Object.keys(CATEGORY_EMOJI);

export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from("landmark-photos").getPublicUrl(path).data.publicUrl;
}

/** Plus on zoome, plus on affiche de repères (évite de saturer la carte). */
export function minImportanceForZoom(zoom: number): number {
  if (zoom >= 17) return 1;
  if (zoom >= 16) return 2;
  if (zoom >= 15) return 3;
  if (zoom >= 14) return 4;
  return 5;
}
export const LANDMARK_MIN_ZOOM = 13;

export type Viewport = { lat: number; lng: number; radiusM: number; zoom: number };

export function useNearbyLandmarks(viewport: Viewport | null, enabled: boolean) {
  const minImp = viewport ? minImportanceForZoom(viewport.zoom) : 5;
  const active = enabled && !!viewport && viewport.zoom >= LANDMARK_MIN_ZOOM;
  const lat = viewport ? Math.round(viewport.lat * 500) / 500 : 0;
  const lng = viewport ? Math.round(viewport.lng * 500) / 500 : 0;
  const radius = viewport ? Math.min(6000, Math.max(300, Math.ceil(viewport.radiusM / 250) * 250)) : 0;
  return useQuery({
    queryKey: ["landmarks-nearby", lat, lng, radius, minImp],
    enabled: active,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<Landmark[]> => {
      const { data, error } = await supabase.rpc("map_nearby", {
        p_lat: lat, p_lng: lng, p_radius_m: radius, p_min_importance: minImp, p_limit: 80,
      });
      if (error) return [];
      return (data ?? []) as Landmark[];
    },
  });
}

export async function searchLandmarks(q: string, lat?: number, lng?: number): Promise<(Landmark & { matched_alias?: string | null })[]> {
  const { data, error } = await supabase.rpc("map_search", { p_query: q, p_lat: lat ?? null, p_lng: lng ?? null, p_limit: 5 });
  if (error) return [];
  return (data ?? []) as any[];
}

export type Zone = { code: string; name: string; kind: "city" | "district" | "pilot"; center_lat: number; center_lng: number; radius_m: number };

/** Quartiers / villes trouvés par nom (positions réelles de la table geo_zones, jamais inventées). */
export async function searchZones(q: string): Promise<Zone[]> {
  const { data, error } = await supabase.rpc("map_search_zones", { p_query: q, p_limit: 4 });
  if (error) return [];
  return (data ?? []) as Zone[];
}

/** Zones pilotes à entourer sur la carte. */
export function usePilotZones() {
  return useQuery({
    queryKey: ["pilot-zones"],
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<Zone[]> => {
      const { data, error } = await supabase.from("geo_zones").select("code,name,kind,center_lat,center_lng,radius_m").eq("kind", "pilot").eq("is_active", true);
      return error ? [] : ((data ?? []) as Zone[]);
    },
  });
}

/** Droits de cartographe de l'utilisateur connecté (administrateur ou agent). */
export function useMapperRole() {
  const { session, profile } = useAuth();
  const uid = session?.user?.id;
  return useQuery({
    queryKey: ["mapper-role", uid],
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("mapper_permissions").select("permission_code").eq("user_id", uid!).eq("is_active", true);
      const rows = error ? [] : data ?? [];
      return { isAgent: rows.length > 0 || !!profile?.is_admin };
    },
  });
}

async function contributionOutcome(id: string): Promise<"approved" | "pending"> {
  const { data } = await supabase.from("landmark_contributions").select("status").eq("id", id).maybeSingle();
  return data?.status === "approved" ? "approved" : "pending";
}

export function useContribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { type: "create" | "edit" | "report"; landmarkId?: string | null; changes: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc("map_contribute", { p_type: v.type, p_landmark: v.landmarkId ?? null, p_changes: v.changes });
      if (error) throw new Error(error.message);
      const outcome = await contributionOutcome(data as string);
      qc.invalidateQueries({ queryKey: ["landmarks-nearby"] });
      qc.invalidateQueries({ queryKey: ["agent-queue"] });
      return outcome;
    },
  });
}

export function useVerifyLandmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { landmarkId: string; result: "confirmed" | "moved" | "closed"; notes?: string }) => {
      const { error } = await supabase.rpc("map_verify", { p_landmark: v.landmarkId, p_type: "field_visit", p_result: v.result, p_notes: v.notes || null });
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["landmarks-nearby"] });
      qc.invalidateQueries({ queryKey: ["agent-toverify"] });
    },
  });
}

export type PendingContribution = {
  id: string;
  contribution_type: "create" | "edit" | "report";
  landmark_id: string | null;
  landmark_name?: string | null;
  proposed_changes: Record<string, any>;
  submitted_at: string;
};

export function useAgentQueue(enabled: boolean) {
  return useQuery({
    queryKey: ["agent-queue"],
    enabled,
    queryFn: async (): Promise<PendingContribution[]> => {
      const { data, error } = await supabase
        .from("landmark_contributions")
        .select("id,contribution_type,landmark_id,proposed_changes,submitted_at")
        .eq("status", "pending").order("submitted_at").limit(100);
      if (error) return [];
      const rows = (data ?? []) as PendingContribution[];
      const ids = [...new Set(rows.map((r) => r.landmark_id).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: lms } = await supabase.from("landmarks").select("id,name").in("id", ids);
        const names = new Map((lms ?? []).map((l: any) => [l.id, l.name]));
        rows.forEach((r) => { r.landmark_name = r.landmark_id ? names.get(r.landmark_id) ?? null : null; });
      }
      return rows;
    },
  });
}

export function useReviewContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc("map_review_contribution", { p_id: v.id, p_approve: v.approve, p_note: v.note || null });
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["agent-queue"] });
      qc.invalidateQueries({ queryKey: ["landmarks-nearby"] });
    },
  });
}

export function useToVerify(enabled: boolean) {
  return useQuery({
    queryKey: ["agent-toverify"],
    enabled,
    queryFn: async (): Promise<Landmark[]> => {
      const { data, error } = await supabase
        .from("landmarks").select("id,name,category_code,lat,lng,importance,verification_status,access_hint")
        .eq("verification_status", "unverified").eq("publication_status", "published")
        .order("importance", { ascending: false }).limit(100);
      if (error) return [];
      return (data ?? []) as Landmark[];
    },
  });
}

export function useLandmarkPhoto(landmarkId: string | null) {
  return useQuery({
    queryKey: ["landmark-photo", landmarkId],
    enabled: !!landmarkId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase.from("landmark_photos").select("storage_path")
        .eq("landmark_id", landmarkId!).eq("verification_status", "approved").order("created_at").limit(1);
      return data?.[0]?.storage_path ?? null;
    },
  });
}

// ---- Photos : compression sur le téléphone (WebP ~800 px + miniature ~160 px) ----
async function toWebp(file: File, maxSide: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
  if (!blob) throw new Error("compression impossible");
  return blob;
}

export function useUploadLandmarkPhoto() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (v: { landmarkId: string; file: File; autoApprove?: boolean }) => {
      const uid = session?.user?.id;
      if (!uid) throw new Error("Connexion requise");
      const [full, thumb] = await Promise.all([toWebp(v.file, 800, 0.78), toWebp(v.file, 160, 0.7)]);
      const base = `${uid}/${v.landmarkId}-${Date.now()}`;
      const opts = { contentType: "image/webp", upsert: false };
      const a = await supabase.storage.from("landmark-photos").upload(`${base}.webp`, full, opts);
      if (a.error) throw new Error(a.error.message);
      const b = await supabase.storage.from("landmark-photos").upload(`${base}_t.webp`, thumb, opts);
      if (b.error) throw new Error(b.error.message);
      const { data: row, error } = await supabase.from("landmark_photos").insert({
        landmark_id: v.landmarkId, storage_path: `${base}.webp`, thumbnail_path: `${base}_t.webp`, author_id: uid,
      }).select("id").single();
      if (error) throw new Error(error.message);
      // Un agent autorisé valide directement sa propre photo (la fonction vérifie ses droits).
      if (v.autoApprove && row?.id) await supabase.rpc("map_review_photo", { p_photo: row.id, p_approve: true });
    },
  });
}
