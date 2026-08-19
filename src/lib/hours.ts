// Horaires d'ouverture d'une boutique physique, et calcul du statut
// "ouverte / fermée" à l'instant présent — utilisé par le filtre
// "Ouvert maintenant" de la Carte et par le badge sur la fiche boutique.

export type DayHours = { open: string; close: string; closed: boolean };
export type ShopHours = {
  alwaysOpen: boolean;
  days: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DayHours>;
};

const DAY_KEYS: (keyof ShopHours["days"])[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function defaultHours(): ShopHours {
  const day: DayHours = { open: "08:00", close: "18:00", closed: false };
  return {
    alwaysOpen: false,
    days: { mon: { ...day }, tue: { ...day }, wed: { ...day }, thu: { ...day }, fri: { ...day }, sat: { ...day }, sun: { ...day, closed: true } },
  };
}

/**
 * Retourne true si la boutique est ouverte à l'instant présent (heure
 * locale de l'appareil). Retourne null si aucune donnée d'horaires
 * n'est renseignée — le badge ne doit alors rien afficher plutôt que
 * de deviner.
 */
export function isOpenNow(hours: ShopHours | null | undefined): boolean | null {
  if (!hours) return null;
  if (hours.alwaysOpen) return true;
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const today = hours.days?.[dayKey];
  if (!today || today.closed) return false;
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (closeMin <= openMin) return minutesNow >= openMin || minutesNow < closeMin; // horaires de nuit
  return minutesNow >= openMin && minutesNow < closeMin;
}

export const DAY_LABELS_FR: Record<keyof ShopHours["days"], string> = {
  mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi", fri: "Vendredi", sat: "Samedi", sun: "Dimanche",
};
export const DAY_LABELS_EN: Record<keyof ShopHours["days"], string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};
export const DAY_ORDER: (keyof ShopHours["days"])[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
