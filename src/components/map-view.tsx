import { MapContainer, TileLayer, Marker, useMap, useMapEvents, CircleMarker, Polyline } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_COLOR, escapeHtml, safeImageUrl, formatXAF, type EffectiveStatus } from "@/lib/availability";

export type MapStyle = "plan" | "streets" | "satellite" | "relief";

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
  theme = "dark",
  focus = null,
  countryCenter = null,
  onMapClick,
  onAreaChange,
  route,
  routeApproximate,
  mapStyle = "plan",
  onMapReady,
  onUserDrag,
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
}) {
  // CARTO exige désormais une clé d'API sur ses fonds de carte gratuits
  // (depuis fin août 2026 — sans lien avec DabbyMarket, ça touche tous les
  // usages non-authentifiés de basemaps.cartocdn.com). La clé reste
  // gratuite (5M requêtes/mois) : on l'ajoute si elle est configurée, et on
  // dégrade proprement vers l'URL nue (filigrane visible mais carte
  // fonctionnelle) sinon, plutôt que de casser le rendu.
  const [calloutIds, setCalloutIds] = useState<Set<string>>(new Set());
  const cartoKey = import.meta.env.VITE_CARTO_API_KEY as string | undefined;
  const tileUrl = useMemo(() => {
    const base = theme === "dark" ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    return cartoKey ? `${base}?key=${cartoKey}` : base;
  }, [theme, cartoKey]);

  return (
    <MapContainer
      center={[3.87, 11.51]}
      zoom={12}
      zoomControl={false}
      attributionControl={false}
      className="absolute inset-0 h-full w-full"
    >
      {mapStyle === "plan" && <TileLayer key="plan" url={tileUrl} attribution="&copy; OpenStreetMap &copy; CARTO" maxZoom={19} />}
      {mapStyle === "streets" && <TileLayer key="streets" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={19} />}
      {mapStyle === "satellite" && (
        <>
          <TileLayer key="sat" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri" maxZoom={19} />
          <TileLayer key="sat-labels" url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" attribution="Esri" maxZoom={19} />
        </>
      )}
      {mapStyle === "relief" && <TileLayer key="relief" url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" subdomains="abc" attribution="&copy; OpenStreetMap, SRTM | OpenTopoMap" maxZoom={17} />}
      <MapBridge onReady={onMapReady} onUserDrag={onUserDrag} />
      <FitToShops shops={shops} flashPins={flashPins} user={user} focus={focus} countryCenter={countryCenter} routeActive={!!route?.length} />
      <MapClickHandler onMapClick={onMapClick} />
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
