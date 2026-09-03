// DabbyMarket — Vente Flash : constantes et utilitaires partagés entre
// PublierFlash, FlashListing, Carte et Compte. Source unique pour éviter
// que chaque écran redéfinisse ses propres paliers de durée.

import type { TranslationKey } from "./i18n";

export type FlashDurationHours = 24 | 48 | 168;

export const FLASH_DURATIONS: { hours: FlashDurationHours; configKey: string; labelKey: TranslationKey }[] = [
  { hours: 24, configKey: "flash_price_24h", labelKey: "flash_duration24h" },
  { hours: 48, configKey: "flash_price_48h", labelKey: "flash_duration48h" },
  { hours: 168, configKey: "flash_price_7d", labelKey: "flash_duration7d" },
];

// L'état ne s'applique pas à tout : un plat cuisiné ou une prestation de
// service n'ont pas de "condition" au sens d'un bien d'occasion.
export const CATEGORIES_WITHOUT_CONDITION = new Set(["alimentation", "services"]);

export const FLASH_CONDITIONS = ["Neuf", "Comme neuf", "Très bon état", "Bon état", "État moyen"] as const;
export type FlashCondition = (typeof FLASH_CONDITIONS)[number];

export const FLASH_CONDITION_LABEL_KEYS: Record<FlashCondition, TranslationKey> = {
  "Neuf": "flash_conditionNew",
  "Comme neuf": "flash_conditionLikeNew",
  "Très bon état": "flash_conditionVeryGood",
  "Bon état": "flash_conditionGood",
  "État moyen": "flash_conditionFair",
};

// Centres de ville approximatifs, réutilisés comme point de départ pour
// dériver une position de quartier — voir approxCoordsForNeighborhood.
const CITY_CENTERS: Record<string, [number, number]> = {
  "Yaoundé": [3.87, 11.51],
  "Douala": [4.0511, 9.7085],
};

// Hash déterministe simple (FNV-1a) — pas besoin de cryptographie ici,
// juste d'une valeur stable et bien répartie pour dériver un point.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Position approximative pour l'affichage carte d'une Vente Flash.
 *
 * Choix de confidentialité assumé (voir livrable, section sécurité) : on
 * ne demande JAMAIS la position GPS exacte du vendeur pour une Vente
 * Flash. La carte affiche un point stable dérivé du (ville, quartier),
 * avec une légère variation par annonce pour éviter que toutes les
 * annonces d'un même quartier se superposent exactement au même pixel.
 * Si un acheteur a besoin d'un point de rendez-vous précis, le vendeur
 * peut le partager en messagerie via le partage de position déjà
 * existant (shared_lat/shared_lng) — jamais sur la carte publique.
 */
export function approxCoordsForNeighborhood(city: string, neighborhood: string, seed: string): { lat: number; lng: number } {
  const [baseLat, baseLng] = CITY_CENTERS[city] ?? CITY_CENTERS["Yaoundé"];
  const hNeighborhood = hashString(`${city}|${neighborhood}`);
  // Décalage de quartier : jusqu'à ~2.2 km du centre-ville, stable pour
  // toutes les annonces d'un même quartier (permet un vrai regroupement
  // visuel par quartier sur la carte).
  const neighborhoodOffsetLat = ((hNeighborhood % 2000) / 2000 - 0.5) * 0.04;
  const neighborhoodOffsetLng = (((hNeighborhood >>> 8) % 2000) / 2000 - 0.5) * 0.04;
  // Variation par annonce : jusqu'à ~150 m, pour ne pas empiler tous les
  // pins d'un même quartier au même endroit exact.
  const hListing = hashString(seed);
  const listingOffsetLat = ((hListing % 1000) / 1000 - 0.5) * 0.0027;
  const listingOffsetLng = (((hListing >>> 8) % 1000) / 1000 - 0.5) * 0.0027;
  return {
    lat: baseLat + neighborhoodOffsetLat + listingOffsetLat,
    lng: baseLng + neighborhoodOffsetLng + listingOffsetLng,
  };
}

export function formatFlashRemaining(expiresAt: string, labels: { expired: string; hoursLeft: (n: number) => string; daysLeft: (n: number) => string }): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return labels.expired;
  const hours = Math.ceil(ms / (1000 * 60 * 60));
  if (hours >= 24) return labels.daysLeft(Math.ceil(hours / 24));
  return labels.hoursLeft(hours);
}
