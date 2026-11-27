import { MapContainer, Marker, useMap, useMapEvents, CircleMarker, Circle, Polyline } from "react-leaflet";
import L from "leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";
import { useEffect, useRef, useState } from "react";
import { STATUS_COLOR, escapeHtml, safeImageUrl, formatXAF, type EffectiveStatus } from "@/lib/availability";

export type MapStyle = "plan" | "streets";

// Fonds de carte : tuiles vectorielles OpenFreeMap (gratuit, sans clé, données © OpenStreetMap).
// Conformité (Lot 0) : plus aucune tuile CARTO, tile.openstreetmap.org, Esri ni OpenTopoMap.
// Pour passer plus tard à un hébergement propre (PMTiles), il suffit de changer ces deux adresses.
export const BASEMAP_STYLE_URL: Record<MapStyle, string> = {
  plan: "https://tiles.openfreemap.org/styles/positron",
  streets: "https://tiles.openfreemap.org/styles/liberty",
};

// Affiche le fond vectoriel (MapLibre) à l'intérieur de la carte Leaflet existante :
// marqueurs, bulles, itinéraire et cadrage restent inchangés.
const LM_EMOJI: Record<string, string> = {
  repere_routier: "⭕", station_service: "⛽", commerce: "🛒", institution: "🏛️", education: "🎓",
  sante: "➕", transport: "🚌", communautaire: "⛪", remarquable: "⭐", autre: "📍",
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const LM_COLOR: Record<string, string> = {
  repere_routier: "#7c5cff", station_service: "#e0412f", commerce: "#e08a00", institution: "#2f6fdb", education: "#1f9e8a",
  sante: "#d6336c", transport: "#3b82a0", communautaire: "#8e5bb5", remarquable: "#c99a06", autre: "#6b7280",
};

function landmarkIcon(lm: LandmarkPin, active: boolean, label: boolean) {
  const verified = lm.verification_status !== "unverified" && lm.verification_status !== "located";
  const color = LM_COLOR[lm.category_code] ?? "#6b7280";
  const size = active ? 38 : 32;
  const ring = active ? "#d4af37" : color;
  const html = `<div style="display:flex;align-items:center;gap:5px;transform:translate(-${size / 2}px,-${size / 2}px);pointer-events:auto">`
    + `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color}22;border:2.5px ${verified || active ? "solid" : "dashed"} ${ring};display:grid;place-items:center;font-size:${active ? 19 : 16}px;background-color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">${LM_EMOJI[lm.category_code] ?? "📍"}`
    + (verified ? `<span style="position:absolute;right:-4px;bottom:-4px;width:14px;height:14px;border-radius:50%;background:#2e9e5b;color:#fff;font-size:9px;line-height:14px;text-align:center;font-weight:900;border:1.5px solid #fff">✓</span>` : "")
    + `</div>`
    + (label ? `<span style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;font-weight:700;color:#1b1b1b;background:rgba(255,255,255,.93);padding:1px 7px;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.3)">${esc(lm.name)}</span>` : "")
    + `</div>`;
  return cachedIcon(html, [label ? 180 : size, size], [0, 0]);
}

// Repères DabbyMap : discrets de loin (seuls les plus importants), plus nombreux en zoomant ;
// les noms n'apparaissent qu'à fort zoom ou pour les repères majeurs.
function LandmarkMarkers({ landmarks, selectedId, onSelect }: { landmarks: LandmarkPin[]; selectedId: string | null; onSelect?: (id: string) => void }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return (
    <>
      {landmarks.map((lm) => (
        <Marker
          key={lm.id}
          position={[lm.lat, lm.lng]}
          icon={landmarkIcon(lm, selectedId === lm.id, selectedId === lm.id || zoom >= 17 || (zoom >= 16 && lm.importance >= 2) || (zoom >= 15 && lm.importance >= 4))}
          zIndexOffset={selectedId === lm.id ? 400 : -100}
          eventHandlers={{ click: () => onSelect?.(lm.id) }}
        />
      ))}
    </>
  );
}

export type FlyTarget = { lat: number; lng: number; zoom: number; nonce: number };

// Centre la carte sur un lieu choisi dans la recherche (quartier, repère…).
function FlyToTarget({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.9 });
  }, [target?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ViewportBridge({ onViewport }: { onViewport: (v: { lat: number; lng: number; radiusM: number; zoom: number }) => void }) {
  const map = useMap();
  const emit = () => {
    const c = map.getCenter();
    const radiusM = c.distanceTo(map.getBounds().getNorthEast());
    onViewport({ lat: c.lat, lng: c.lng, radiusM, zoom: map.getZoom() });
  };
  useEffect(() => { emit(); /* position initiale */ }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  useMapEvents({ moveend: emit, zoomend: emit });
  return null;
}

function VectorBasemap({ styleUrl }: { styleUrl: string }) {
  const map = useMap();
  useEffect(() => {
    const layer = (L as any).maplibreGL({ style: styleUrl, interactive: false });
    layer.addTo(map);
    return () => { try { map.removeLayer(layer); } catch { /* carte déjà détruite */ } };
  }, [map, styleUrl]);
  return null;
}

export type GeoPoint = { lat: number; lng: number; accuracy?: number };

export type ShopPin = {
  id: string;
  locationId?: string;
  name: string;
  category: string;
  verified: boolean;
  lat: number;
  lng: number;
  logo_url?: string | null;
  /** Dabby Disponibilité : produit le plus pertinent de la boutique (jamais affirmatif si périmé/contesté). */
  availability?: {
    status: EffectiveStatus;
    productName: string;
    price: number;
    rating?: number | null;
    ago: string;
    /** rang de pertinence (0 = meilleur) : sert à arbitrer les bulles quand la carte est chargée */
    rank: number;
    statusLabel: string;
    /** photo de l'article (facultative) : déclenche la bulle « photo » */
    image?: string | null;
  };
};

export type LandmarkPin = {
  id: string; name: string; category_code: string; lat: number; lng: number; importance: number; verification_status: string;
};

export type FlashPin = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  thumbnail?: string | null;
};

// Cache d'icônes : évite de recréer (et de ré-injecter dans le DOM) l'icône
// de chaque marqueur à chaque rendu quand son HTML n'a pas changé.
const iconCache = new Map<string, L.DivIcon>();
function cachedIcon(html: string, size: [number, number], anchor: [number, number]): L.DivIcon {
  const key = `${size.join("x")}|${html}`;
  let icon = iconCache.get(key);
  if (!icon) {
    if (iconCache.size > 800) iconCache.clear();
    icon = L.divIcon({ className: "dm-pin-wrap", html, iconSize: size, iconAnchor: anchor });
    iconCache.set(key, icon);
  }
  return icon;
}

function flashPin(pin: FlashPin, active: boolean) {
  const scale = active ? 1.12 : 1;
  const ring = active ? "#f2d675" : "#e8985e";
  const inner = pin.thumbnail
    ? `<img src="${safeImageUrl(pin.thumbnail)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span>⚡</span>`;
  const html = `
    <div class="dm-pin dm-pin--flash" style="transform:scale(${scale});">
      <div class="dm-pin-body" style="background:#2a1f14;color:#f5f5f5;border-color:${ring};border-style:dashed;overflow:hidden;width:34px;height:34px;">
        ${inner}
      </div>
      <div class="dm-pin-tail" style="border-top-color:${ring};"></div>
    </div>`;
  return cachedIcon(html, [36, 44], [18, 42]);
}

function shopPin(shop: ShopPin, active: boolean, showCallout: boolean) {
  const ring = active ? "#f2d675" : shop.verified ? "#d4af37" : "#8a8a8a";
  const bg = active ? "linear-gradient(135deg,#d4af37,#f2d675)" : "#1e1e1e";
  const color = active ? "#121212" : "#f5f5f5";
  const scale = active ? 1.1 : 1;
  // Les données utilisateur (nom, logo, produit) sont TOUJOURS échappées
  // avant d'être injectées dans le HTML du marqueur.
  const logo = safeImageUrl(shop.logo_url);
  const inner = logo
    ? `<img src="${logo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span>${escapeHtml(shop.name.charAt(0).toUpperCase())}</span>`;
  const av = shop.availability;
  const dot = av ? `<span class="dm-pin-status" style="background:${STATUS_COLOR[av.status]};"></span>` : "";
  const avImg = av ? safeImageUrl(av.image) : "";
  const callout =
    av && avImg && (showCallout || active)
      ? `<div class="dm-callout dm-callout--photo" style="border-color:${STATUS_COLOR[av.status]};">
           <span class="dm-callout-photo" style="border-color:${STATUS_COLOR[av.status]};"><img src="${avImg}" alt="" loading="lazy" /></span>
           <span class="dm-callout-text">
             <b>${escapeHtml(av.productName)}</b>
             <strong>${escapeHtml(formatXAF(av.price))}</strong>
             <i style="color:${STATUS_COLOR[av.status]};">● ${escapeHtml(av.statusLabel)}</i>
             <em>${escapeHtml(av.ago)}</em>
           </span>
         </div>`
      : av && (showCallout || active)
      ? `<div class="dm-callout" style="border-color:${STATUS_COLOR[av.status]}99;">
           <span class="dm-callout-dot" style="background:${STATUS_COLOR[av.status]};"></span>
           <span class="dm-callout-text">
             <b>${escapeHtml(av.productName)}</b>
             <i>${escapeHtml(av.statusLabel)} · ${escapeHtml(formatXAF(av.price))}${av.rating ? ` · ⭐ ${Number(av.rating).toFixed(1)}` : ""}</i>
             <em>${escapeHtml(av.ago)}</em>
           </span>
         </div>`
      : "";
  const html = `
    <div class="dm-pin" style="transform:scale(${scale});">
      ${callout}
      <div class="dm-pin-body" style="background:${bg};color:${color};border-color:${ring};overflow:hidden;">
        ${inner}
      </div>
      ${dot}
      <div class="dm-pin-tail" style="border-top-color:${ring};"></div>
      ${active ? '<div class="dm-pin-pulse"></div>' : ""}
    </div>`;
  return cachedIcon(html, [46, 56], [23, 54]);
}

function userPin() {
  const html = `
    <div class="dm-user-pin">
      <div class="dm-user-pulse"></div>
      <div class="dm-user-dot"></div>
    </div>`;
  return L.divIcon({
    className: "dm-user-wrap",
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitToShops({
  shops,
  flashPins,
  user,
  focus,
  countryCenter,
  routeActive,
}: {
  shops: ShopPin[];
  flashPins: FlashPin[];
  user: GeoPoint | null;
  focus: [number, number] | null;
  countryCenter: [number, number] | null;
  routeActive?: boolean;
}) {
  const map = useMap();
  const didInitialCountryFly = useRef(false);
  const lastFocus = useRef<[number, number] | null>(null);
  const lastKey = useRef("");

  useEffect(() => {
    if (routeActive) return; // FitToRoute prend le relais du cadrage
    // Cadrage recalculé seulement si le jeu de boutiques ou la position
    // change réellement : un simple rafraîchissement de données (avis,
    // disponibilités) ne doit pas arracher la carte à l'utilisateur.
    const key = `${shops.map((s) => s.locationId ?? s.id).join(",")}|${flashPins.map((f) => f.id).join(",")}|${user ? 1 : 0}`;
    if (focus && focus !== lastFocus.current) {
      lastFocus.current = focus;
      lastKey.current = key;
      map.flyTo(focus, Math.max(map.getZoom(), 15), { duration: 0.8 });
      return;
    }
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (user) {
      // Position réelle activée : on recentre sur l'utilisateur + boutiques
      // proches (c'est ce qui permet de voir ce qui est près de chez soi).
      const pts: [number, number][] = [...shops.map((s) => [s.lat, s.lng] as [number, number]), ...flashPins.map((f) => [f.lat, f.lng] as [number, number])];
      pts.push([user.lat, user.lng]);
      const b = L.latLngBounds(pts);
      map.fitBounds(b.pad(0.35), { animate: true });
      return;
    }
    if (!didInitialCountryFly.current && countryCenter) {
      // Première ouverture de la carte, pas encore de position précise
      // activée : on oriente directement vers le pays de l'utilisateur
      // (déduit de son numéro de téléphone à l'inscription).
      didInitialCountryFly.current = true;
      map.flyTo(countryCenter, 6, { duration: 1 });
      return;
    }
    const pts: [number, number][] = [...shops.map((s) => [s.lat, s.lng] as [number, number]), ...flashPins.map((f) => [f.lat, f.lng] as [number, number])];
    if (!pts.length) return;
    const b = L.latLngBounds(pts);
    map.fitBounds(b.pad(0.35), { animate: true });
  }, [shops, flashPins, user, focus, map, countryCenter, routeActive]);
  return null;
}

// Cadre la carte sur l'ensemble du tracé calculé — c'est la Carte de
// l'application elle-même qui guide, aucun lien externe n'est ouvert.
function FitToRoute({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!coordinates.length) return;
    map.fitBounds(L.latLngBounds(coordinates).pad(0.15), { animate: true });
  }, [coordinates, map]);
  return null;
}

// Expose l'instance Leaflet au parent (boutons zoom, recentrage) et signale
// un glissement manuel (l'utilisateur « décentre » la carte).
function MapBridge({ onReady, onUserDrag }: { onReady?: (m: L.Map) => void; onUserDrag?: () => void }) {
  const map = useMap();
  useEffect(() => { onReady?.(map); }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  useMapEvents({ dragstart: () => onUserDrag?.() });
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick?: () => void }) {
  useMapEvents({
    click: () => onMapClick?.(),
  });
  return null;
}

// Détecte un déplacement manuel de la carte (glisser ou zoomer à la
// main) pour proposer "Rechercher dans cette zone" — ignore les
// recentrages programmatiques (FitToShops/FitToRoute) en ne s'armant
// qu'après un vrai geste utilisateur.
function AreaSearchBridge({ onAreaChange }: { onAreaChange: (bounds: L.LatLngBounds | null) => void }) {
  const armed = useRef(false);
  useMapEvents({
    dragstart: () => { armed.current = true; },
    zoomstart: () => { armed.current = true; },
    moveend: (e) => {
      if (armed.current) onAreaChange(e.target.getBounds());
    },
  });
  return null;
}

// Choisit quelles boutiques affichent leur bulle de produit : uniquement
// à partir d'un certain zoom, une seule bulle par cellule d'écran, plafond
// de bulles, par ordre de pertinence — pour que la carte reste lisible et
// fluide avec beaucoup de boutiques rapprochées.
const CALLOUT_MIN_ZOOM = 14;
const CALLOUT_MAX = 14;
const CELL_W = 150;
const CELL_H = 64;

function CalloutPlanner({ shops, onPlan }: { shops: ShopPin[]; onPlan: (ids: Set<string>) => void }) {
  const map = useMap();
  const compute = () => {
    if (map.getZoom() < CALLOUT_MIN_ZOOM) return onPlan(new Set());
    const bounds = map.getBounds().pad(0.05);
    const candidates = shops
      .filter((s) => s.availability && bounds.contains([s.lat, s.lng]))
      .sort((a, b) => a.availability!.rank - b.availability!.rank);
    const taken = new Set<string>();
    const chosen = new Set<string>();
    for (const s of candidates) {
      if (chosen.size >= CALLOUT_MAX) break;
      const pt = map.latLngToContainerPoint([s.lat, s.lng]);
      const cell = `${Math.floor(pt.x / CELL_W)}:${Math.floor(pt.y / CELL_H)}`;
      if (taken.has(cell)) continue;
      taken.add(cell);
      chosen.add(s.locationId ?? s.id);
    }
    onPlan(chosen);
  };
  useEffect(compute, [shops, map]); // eslint-disable-line react-hooks/exhaustive-deps
  useMapEvents({ zoomend: compute, moveend: compute });
  return null;
}

export default function MapView({
  shops,
  flashPins = [],
  selectedId,
  onSelect,
  onSelectFlash,
  user,
  theme: _theme = "dark",
  focus = null,
  countryCenter = null,
  onMapClick,
  onAreaChange,
  route,
  routeApproximate,
  mapStyle = "plan",
  onMapReady,
  onUserDrag,
  landmarks,
  selectedLandmarkId = null,
  onSelectLandmark,
  onViewport,
  flyTarget = null,
  pilotZones,
}: {
  shops: ShopPin[];
  flashPins?: FlashPin[];
  selectedId: string | null;
  onSelect: (s: ShopPin) => void;
  onSelectFlash?: (f: FlashPin) => void;
  user: GeoPoint | null;
  theme?: "dark" | "light";
  focus?: [number, number] | null;
  countryCenter?: [number, number] | null;
  onMapClick?: () => void;
  onAreaChange?: (bounds: L.LatLngBounds | null) => void;
  /** Tracé d'itinéraire calculé en interne (OSRM) — dessiné directement
   * sur la carte de l'application, sans jamais quitter DabbyMarket. */
  route?: [number, number][];
  routeApproximate?: boolean;
  mapStyle?: MapStyle;
  onMapReady?: (m: L.Map) => void;
  onUserDrag?: () => void;
  landmarks?: LandmarkPin[];
  selectedLandmarkId?: string | null;
  onSelectLandmark?: (id: string) => void;
  onViewport?: (v: { lat: number; lng: number; radiusM: number; zoom: number }) => void;
  flyTarget?: FlyTarget | null;
  pilotZones?: { code: string; name: string; center_lat: number; center_lng: number; radius_m: number }[];
}) {
  const [calloutIds, setCalloutIds] = useState<Set<string>>(new Set());

  return (
    <MapContainer
      center={[3.87, 11.51]}
      zoom={12}
      zoomControl={false}
      attributionControl={false}
      className="absolute inset-0 h-full w-full"
    >
      <VectorBasemap styleUrl={BASEMAP_STYLE_URL[mapStyle] ?? BASEMAP_STYLE_URL.plan} />
      <MapBridge onReady={onMapReady} onUserDrag={onUserDrag} />
      <FitToShops shops={shops} flashPins={flashPins} user={user} focus={focus} countryCenter={countryCenter} routeActive={!!route?.length} />
      <MapClickHandler onMapClick={onMapClick} />
      {onViewport && <ViewportBridge onViewport={onViewport} />}
      <FlyToTarget target={flyTarget} />
      {pilotZones?.map((z) => (
        <Circle key={z.code} center={[z.center_lat, z.center_lng]} radius={z.radius_m} interactive={false}
          pathOptions={{ color: "#d4af37", weight: 2, dashArray: "6,8", fillColor: "#d4af37", fillOpacity: 0.05 }} />
      ))}
      {landmarks && landmarks.length > 0 && <LandmarkMarkers landmarks={landmarks} selectedId={selectedLandmarkId} onSelect={onSelectLandmark} />}
      <CalloutPlanner shops={shops} onPlan={setCalloutIds} />
      {onAreaChange && <AreaSearchBridge onAreaChange={onAreaChange} />}

      {route && route.length > 1 && (
        <>
          <FitToRoute coordinates={route} />
          <Polyline
            positions={route}
            pathOptions={
              routeApproximate
                ? { color: "#8a8a8a", weight: 4, opacity: 0.85, dashArray: "2,10" }
                : { color: "#d4af37", weight: 5, opacity: 0.9 }
            }
          />
        </>
      )}

      {user && (
        <>
          {typeof user.accuracy === "number" && user.accuracy < 5000 && (
            <CircleMarker
              center={[user.lat, user.lng]}
              radius={Math.min(40, Math.max(12, user.accuracy / 8))}
              pathOptions={{ color: "#d4af37", weight: 1, opacity: 0.4, fillColor: "#d4af37", fillOpacity: 0.08 }}
            />
          )}
          <Marker position={[user.lat, user.lng]} icon={userPin()} interactive={false} />
        </>
      )}

      {shops.map((s) => (
        <Marker
          key={s.locationId ?? s.id}
          position={[s.lat, s.lng]}
          icon={shopPin(s, selectedId === s.id, calloutIds.has(s.locationId ?? s.id))}
          zIndexOffset={selectedId === s.id ? 1000 : calloutIds.has(s.locationId ?? s.id) ? 500 : 0}
          eventHandlers={{ click: () => onSelect(s) }}
        />
      ))}

      {flashPins.map((f) => (
        <Marker
          key={`flash-${f.id}`}
          position={[f.lat, f.lng]}
          icon={flashPin(f, selectedId === f.id)}
          eventHandlers={{ click: () => onSelectFlash?.(f) }}
        />
      ))}
    </MapContainer>
  );
}
