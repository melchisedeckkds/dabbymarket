// Liste contrôlée des quartiers par ville — évite les incohérences de
// saisie libre ("Bastos" / "bastos" / "Bastoss"...) tout en restant
// facile à étendre : ajouter une ville = ajouter une entrée ici.
//
// Yaoundé est prioritaire (lancement) ; l'architecture supporte déjà
// plusieurs villes pour une extension ultérieure (Douala, etc.).

export const CITIES = ["Yaoundé", "Douala"] as const;
export type City = (typeof CITIES)[number];

export const NEIGHBORHOODS: Record<City, string[]> = {
  "Yaoundé": [
    "Bastos", "Ngousso", "Nlongkak", "Mvog-Mbi", "Mvan", "Emombo",
    "Etoudi", "Nkolbisson", "Biyem-Assi", "Mimboman", "Essos",
    "Melen", "Ekounou", "Nsam", "Tsinga", "Elig-Essono", "Omnisport",
    "Centre-ville", "Briqueterie", "Messa", "Ngoa-Ekelle", "Odza",
    "Nkol-Eton", "Simbock", "Ahala", "Awae", "Efoulan",
  ],
  "Douala": [
    "Akwa", "Bonanjo", "Bonapriso", "Bépanda", "Deido", "New-Bell",
    "Bonamoussadi", "Makepe", "Ndogbong", "Kotto", "PK8", "PK14",
  ],
};

export function neighborhoodsFor(city: string): string[] {
  return NEIGHBORHOODS[city as City] ?? NEIGHBORHOODS["Yaoundé"];
}
