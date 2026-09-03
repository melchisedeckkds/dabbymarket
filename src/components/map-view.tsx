import { MapContainer, TileLayer, Marker, useMap, useMapEvents, CircleMarker, Polyline } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";

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
};

export type FlashPin = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  thumbnail?: string | null;
};

function flashPin(pin: FlashPin, active: boolean) {
  const scale = active ? 1.12 : 1;
  const ring = active ? "#f2d675" : "#e8985e";
  const inner = pin.thumbnail
    ? `<img src="${pin.thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span>⚡</span>`;
  const html = `
    <div class="dm-pin dm-pin--flash" style="transform:scale(${scale});">
      <div class="dm-pin-body" style="background:#2a1f14;color:#f5f5f5;border-color:${ring};border-style:dashed;overflow:hidden;width:34px;height:34px;">
        ${inner}
      </div>
      <div class="dm-pin-tail" style="border-top-color:${ring};"></div>
    </div>`;
  return L.divIcon({
    className: "dm-pin-wrap",
    html,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
  });
}

function shopPin(shop: ShopPin, active: boolean) {
  const ring = active ? "#f2d675" : shop.verified ? "#d4af37" : "#8a8a8a";
  const bg = active ? "linear-gradient(135deg,#d4af37,#f2d675)" : "#1e1e1e";
  const color = active ? "#121212" : "#f5f5f5";
  const scale = active ? 1.1 : 1;
  const inner = shop.logo_url
    ? `<img src="${shop.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span>${shop.name.charAt(0).toUpperCase()}</span>`;
  const html = `
    <div class="dm-pin" style="transform:scale(${scale});">
      <div class="dm-pin-body" style="background:${bg};color:${color};border-color:${ring};overflow:hidden;">
        ${inner}
      </div>
      <div class="dm-pin-tail" style="border-top-color:${ring};"></div>
      ${active ? '<div class="dm-pin-pulse"></div>' : ""}
    </div>`;
  return L.divIcon({
    className: "dm-pin-wrap",
    html,
    iconSize: [46, 56],
    iconAnchor: [23, 54],
  });
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

  useEffect(() => {
    if (routeActive) return; // FitToRoute prend le relais du cadrage
    if (focus) {
      map.flyTo(focus, 15, { duration: 0.9 });
      return;
    }
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
}) {
  const tileUrl = useMemo(
    () =>
      theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    [theme],
  );

  return (
    <MapContainer
      center={[3.87, 11.51]}
      zoom={12}
      zoomControl={false}
      attributionControl={false}
      className="absolute inset-0 h-full w-full"
    >
      <TileLayer url={tileUrl} attribution="&copy; OpenStreetMap &copy; CARTO" />
      <FitToShops shops={shops} flashPins={flashPins} user={user} focus={focus} countryCenter={countryCenter} routeActive={!!route?.length} />
      <MapClickHandler onMapClick={onMapClick} />
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
          icon={shopPin(s, selectedId === s.id)}
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
