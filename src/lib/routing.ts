// Calcul d'itinéraire 100% autonome, sans quitter l'application et sans
// dépendance payante : utilise OSRM (Open Source Routing Machine) sur
// le réseau routier OpenStreetMap.
//
// ⚠️ Le serveur utilisé ici (router.project-osrm.org) est le serveur de
// démonstration public, gratuit, mais à usage raisonnable uniquement
// (limite officielle : ~1 requête/seconde, aucune garantie de
// disponibilité). C'est suffisant pour un lancement, mais pas garanti
// pour un usage à grande échelle — voir le guide de mise à jour pour la
// recommandation d'auto-hébergement (toujours open source, gratuit à
// coût d'un petit serveur).

export type RoutePoint = { lat: number; lng: number };
export type RouteProfile = "foot" | "driving" | "bike";

export type RouteStep = {
  instruction: string;
  distanceM: number;
};

export type RouteResult = {
  coordinates: [number, number][]; // [lat, lng] — prêt pour un <Polyline> Leaflet
  distanceM: number;
  durationS: number;
  steps: RouteStep[];
  approximate: false;
};

export type ApproximateRoute = {
  coordinates: [number, number][];
  distanceM: number;
  durationS: null;
  steps: [];
  approximate: true;
};

const OSRM_BASE = "https://router.project-osrm.org/route/v1";

function haversineM(a: RoutePoint, b: RoutePoint) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Traduit les instructions OSRM (anglais technique) en phrases simples FR/EN.
function describeStep(step: any, lang: "fr" | "en"): string {
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier;
  const road = step.name || (lang === "fr" ? "la route" : "the road");
  const dict: Record<string, Record<string, string>> = {
    fr: {
      depart: `Partez sur ${road}`,
      arrive: "Vous êtes arrivé",
      turn: `Tournez ${modifierFr(modifier)} sur ${road}`,
      "new name": `Continuez sur ${road}`,
      continue: `Continuez sur ${road}`,
      merge: `Rejoignez ${road}`,
      roundabout: `Prenez le rond-point vers ${road}`,
      fork: `Restez ${modifierFr(modifier)} vers ${road}`,
    },
    en: {
      depart: `Head out on ${road}`,
      arrive: "You have arrived",
      turn: `Turn ${modifier ?? ""} onto ${road}`,
      "new name": `Continue on ${road}`,
      continue: `Continue on ${road}`,
      merge: `Merge onto ${road}`,
      roundabout: `Take the roundabout onto ${road}`,
      fork: `Keep ${modifier ?? ""} onto ${road}`,
    },
  };
  return dict[lang][type] ?? (lang === "fr" ? `Continuez sur ${road}` : `Continue on ${road}`);
}
function modifierFr(m?: string) {
  const map: Record<string, string> = { left: "à gauche", right: "à droite", "slight left": "légèrement à gauche", "slight right": "légèrement à droite", "sharp left": "fortement à gauche", "sharp right": "fortement à droite", straight: "tout droit", uturn: "demi-tour" };
  return m ? map[m] ?? "" : "";
}

/**
 * Calcule un itinéraire réel le long du réseau routier, en restant dans
 * l'application (aucun lien externe). En cas d'échec (réseau, zone non
 * couverte par les données OpenStreetMap locales, serveur de démo
 * indisponible), retombe sur une ligne directe entre les deux points —
 * jamais un écran vide ou une erreur bloquante.
 */
export async function fetchRoute(from: RoutePoint, to: RoutePoint, profile: RouteProfile, lang: "fr" | "en" = "fr"): Promise<RouteResult | ApproximateRoute> {
  try {
    const url = `${OSRM_BASE}/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) throw new Error("no route");
    const coordinates: [number, number][] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
    const steps: RouteStep[] = (route.legs?.[0]?.steps ?? []).map((s: any) => ({
      instruction: describeStep(s, lang),
      distanceM: s.distance,
    }));
    return { coordinates, distanceM: route.distance, durationS: route.duration, steps, approximate: false };
  } catch {
    // Repli : ligne directe. On l'annonce clairement à l'utilisateur
    // (voir RouteSheet) plutôt que de faire croire à un vrai itinéraire.
    return {
      coordinates: [[from.lat, from.lng], [to.lat, to.lng]],
      distanceM: haversineM(from, to),
      durationS: null,
      steps: [],
      approximate: true,
    };
  }
}
