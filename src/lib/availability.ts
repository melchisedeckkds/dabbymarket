// DabbyMarket — Dabby Disponibilité : types et utilitaires partagés.
// Source unique des états, couleurs et formats de fraîcheur, utilisée par
// la Carte, la fiche boutique, la fiche produit, les Trouvailles, le
// chatbot et l'espace marchand.

export type DeclaredStatus = "unknown" | "available" | "limited" | "out";
export type EffectiveStatus = "available" | "limited" | "to_reconfirm" | "contested" | "out" | "unknown";

// Couleurs en valeurs fixes : réutilisées dans du HTML de marqueur Leaflet
// (hors portée des variables CSS de Tailwind).
export const STATUS_COLOR: Record<EffectiveStatus, string> = {
  available: "#4caf50",
  limited: "#e0a030",
  to_reconfirm: "#9a9a9a",
  contested: "#e57373",
  out: "#d32f2f",
  unknown: "#6b6b6b",
};

export const STATUS_ORDER: EffectiveStatus[] = ["available", "limited", "to_reconfirm", "contested", "out", "unknown"];

/** Vrai si le statut permet d'affirmer « disponible » (jamais pour un statut périmé ou contesté). */
export function isAffirmative(s: EffectiveStatus | string | null | undefined): boolean {
  return s === "available" || s === "limited";
}

export function formatXAF(n: number): string {
  return `${Number(n).toLocaleString("fr-FR")} FCFA`;
}

/** « il y a 12 min » — la fraîcheur est toujours affichée avec le statut. */
export function formatAgo(iso: string | null | undefined, lang: "fr" | "en" = "fr"): string {
  if (!iso) return lang === "en" ? "never confirmed" : "jamais confirmé";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return lang === "en" ? "just now" : "à l'instant";
  if (min < 60) return lang === "en" ? `${min} min ago` : `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return lang === "en" ? `${h} h ago` : `il y a ${h} h`;
  const d = Math.round(h / 24);
  return lang === "en" ? `${d} d ago` : `il y a ${d} j`;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Échappement HTML pour tout texte utilisateur injecté dans un marqueur Leaflet (divIcon). */
export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** URL d'image sûre pour un attribut src (http/https/data:image uniquement). */
export function safeImageUrl(u: unknown): string {
  const s = String(u ?? "");
  return /^(https?:\/\/|data:image\/)/i.test(s) ? escapeHtml(s) : "";
}

export type AvailabilityRow = {
  product_id: string;
  shop_id: string;
  location_id: string;
  shop_name: string;
  logo_url: string | null;
  verified: boolean;
  owner_id: string;
  hours: any;
  lat: number;
  lng: number;
  neighborhood: string | null;
  city: string | null;
  product_name: string;
  price_xaf: number;
  category: string;
  catalog_item_id: string | null;
  image: string | null;
  effective_status: EffectiveStatus;
  declared_status: DeclaredStatus;
  confirmed_at: string | null;
  stock_qty: number | null;
  sale_unit: string | null;
  rating_avg: number | null;
  rating_count: number;
  likes_count: number;
  found_reports: number;
  relevance: number;
  distance_km: number | null;
};

export type ReliabilityLevel = "insufficient" | "low" | "medium" | "high";

/** Même normalisation que dm_norm() côté SQL : minuscules, sans accents, virgule décimale -> point. */
export function normText(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "o")
    .replace(/æ/g, "a")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}
