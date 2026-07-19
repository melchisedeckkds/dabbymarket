export type CountryCode = { code: string; dial: string; flag: string; name: string; center: [number, number] };

// Une sélection large mais non exhaustive d'indicatifs téléphoniques,
// couvrant l'Afrique en priorité (marché principal de DabbyMarket) ainsi
// que les régions les plus courantes dans le reste du monde. Le Cameroun
// est mis en premier et sélectionné par défaut. "center" est une position
// approximative (capitale ou centre géographique) utilisée pour orienter
// automatiquement la Carte vers le pays de l'utilisateur à la connexion.
export const COUNTRY_CODES: CountryCode[] = [
  { code: "CM", dial: "+237", flag: "🇨🇲", name: "Cameroun", center: [3.87, 11.52] },
  { code: "NG", dial: "+234", flag: "🇳🇬", name: "Nigéria", center: [9.08, 8.68] },
  { code: "CI", dial: "+225", flag: "🇨🇮", name: "Côte d'Ivoire", center: [7.54, -5.55] },
  { code: "SN", dial: "+221", flag: "🇸🇳", name: "Sénégal", center: [14.5, -14.45] },
  { code: "GA", dial: "+241", flag: "🇬🇦", name: "Gabon", center: [-0.8, 11.61] },
  { code: "CD", dial: "+243", flag: "🇨🇩", name: "RD Congo", center: [-4.32, 15.32] },
  { code: "CG", dial: "+242", flag: "🇨🇬", name: "Congo", center: [-0.23, 15.83] },
  { code: "TD", dial: "+235", flag: "🇹🇩", name: "Tchad", center: [15.45, 18.73] },
  { code: "CF", dial: "+236", flag: "🇨🇫", name: "Centrafrique", center: [6.61, 20.94] },
  { code: "GQ", dial: "+240", flag: "🇬🇶", name: "Guinée équatoriale", center: [1.65, 10.27] },
  { code: "BJ", dial: "+229", flag: "🇧🇯", name: "Bénin", center: [9.31, 2.32] },
  { code: "TG", dial: "+228", flag: "🇹🇬", name: "Togo", center: [8.62, 0.82] },
  { code: "ML", dial: "+223", flag: "🇲🇱", name: "Mali", center: [17.57, -3.99] },
  { code: "BF", dial: "+226", flag: "🇧🇫", name: "Burkina Faso", center: [12.24, -1.56] },
  { code: "NE", dial: "+227", flag: "🇳🇪", name: "Niger", center: [17.61, 8.08] },
  { code: "GN", dial: "+224", flag: "🇬🇳", name: "Guinée", center: [9.95, -9.7] },
  { code: "GH", dial: "+233", flag: "🇬🇭", name: "Ghana", center: [7.95, -1.02] },
  { code: "KE", dial: "+254", flag: "🇰🇪", name: "Kenya", center: [-0.02, 37.91] },
  { code: "TZ", dial: "+255", flag: "🇹🇿", name: "Tanzanie", center: [-6.37, 34.89] },
  { code: "UG", dial: "+256", flag: "🇺🇬", name: "Ouganda", center: [1.37, 32.29] },
  { code: "RW", dial: "+250", flag: "🇷🇼", name: "Rwanda", center: [-1.94, 29.87] },
  { code: "ZA", dial: "+27", flag: "🇿🇦", name: "Afrique du Sud", center: [-30.56, 22.94] },
  { code: "EG", dial: "+20", flag: "🇪🇬", name: "Égypte", center: [26.82, 30.8] },
  { code: "MA", dial: "+212", flag: "🇲🇦", name: "Maroc", center: [31.79, -7.09] },
  { code: "DZ", dial: "+213", flag: "🇩🇿", name: "Algérie", center: [28.03, 1.66] },
  { code: "TN", dial: "+216", flag: "🇹🇳", name: "Tunisie", center: [33.89, 9.54] },
  { code: "FR", dial: "+33", flag: "🇫🇷", name: "France", center: [46.6, 2.21] },
  { code: "BE", dial: "+32", flag: "🇧🇪", name: "Belgique", center: [50.5, 4.47] },
  { code: "CH", dial: "+41", flag: "🇨🇭", name: "Suisse", center: [46.82, 8.23] },
  { code: "DE", dial: "+49", flag: "🇩🇪", name: "Allemagne", center: [51.17, 10.45] },
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "Royaume-Uni", center: [54.0, -2.0] },
  { code: "US", dial: "+1", flag: "🇺🇸", name: "États-Unis / Canada", center: [39.83, -98.58] },
  { code: "CA", dial: "+1", flag: "🇨🇦", name: "Canada", center: [56.13, -106.35] },
  { code: "IN", dial: "+91", flag: "🇮🇳", name: "Inde", center: [22.35, 78.67] },
  { code: "CN", dial: "+86", flag: "🇨🇳", name: "Chine", center: [35.86, 104.2] },
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "Émirats arabes unis", center: [23.42, 53.85] },
  { code: "SA", dial: "+966", flag: "🇸🇦", name: "Arabie saoudite", center: [23.89, 45.08] },
  { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brésil", center: [-14.24, -51.93] },
  { code: "OTHER", dial: "+", flag: "🌍", name: "Autre pays (tapez votre indicatif)", center: [3.87, 11.52] },
];

/** Retrouve le pays correspondant à un numéro de téléphone stocké (ex: "+237696430723"). */
export function getCountryFromPhone(phone: string | null | undefined): CountryCode | undefined {
  if (!phone) return undefined;
  // On teste les indicatifs du plus long au plus court pour éviter qu'un
  // indicatif court (+1, +7...) ne matche par erreur avant un plus précis.
  const sorted = [...COUNTRY_CODES].filter((c) => c.dial !== "+").sort((a, b) => b.dial.length - a.dial.length);
  return sorted.find((c) => phone.startsWith(c.dial));
}
