import type { TranslationKey } from "./i18n";

export type Category = { id: string; key: TranslationKey; icon: string };

// Source unique des catégories — utilisée par Le Marché, La Carte, Publier
// et Créer Boutique. Toute nouvelle catégorie ne se déclare qu'ici.
export const CATEGORIES: Category[] = [
  { id: "mode", key: "marche_categoryMode", icon: "Shirt" },
  { id: "electronique", key: "marche_categoryElectronics", icon: "Smartphone" },
  { id: "alimentation", key: "marche_categoryFood", icon: "Utensils" },
  { id: "beaute", key: "marche_categoryBeauty", icon: "Sparkles" },
  { id: "maison", key: "marche_categoryHome", icon: "Sofa" },
  { id: "services", key: "marche_categoryServices", icon: "Wrench" },
];
