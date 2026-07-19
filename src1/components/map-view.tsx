import { MapContainer, TileLayer, Marker, useMap, useMapEvents, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";

export type GeoPoint = { lat: number; lng: number; accuracy?: number };

export type ShopPin = {
  id: string;
  name: string;
  category: string;
  verified: boolean;
  lat: number;
  lng: number;
};

function shopPin(shop: ShopPin, active: boolean) {
  const ring = active ? "#f2d675" : shop.verified ? "#d4af37" : "#8a8a8a";
  const bg = active ? "linear-gradient(135deg,#d4af37,#f2d675)" : "#1e1e1e";
  const color = active ? "#121212" : "#f5f5f5";
  const scale = active ? 1.1 : 1;
  const html = `
    <div class="dm-pin" style="transform:scale(${scale});">
      <div class="dm-pin-body" style="background:${bg};color:${color};border-color:${ring};">
        <span>${shop.name.charAt(0).toUpperCase()}</span>
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

function FitToShops({ shops, user, focus }: { shops: ShopPin[]; user: GeoPoint | null; focus: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.flyTo(focus, 15, { duration: 0.9 });
      return;
    }
    const pts: [number, number][] = shops.map((s) => [s.lat, s.lng]);
    if (user) pts.push([user.lat, user.lng]);
    if (!pts.length) return;
    const b = L.latLngBounds(pts);
    map.fitBounds(b.pad(0.35), { animate: true });
  }, [shops, user, focus, map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick?: () => void }) {
  useMapEvents({
    click: () => onMapClick?.(),
  });
  return null;
}

export default function MapView({
  shops,
  selectedId,
  onSelect,
  user,
  theme = "dark",
  focus = null,
  onMapClick,
}: {
  shops: ShopPin[];
  selectedId: string | null;
  onSelect: (s: ShopPin) => void;
  user: GeoPoint | null;
  theme?: "dark" | "light";
  focus?: [number, number] | null;
  onMapClick?: () => void;
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
      <FitToShops shops={shops} user={user} focus={focus} />
      <MapClickHandler onMapClick={onMapClick} />

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
          key={s.id}
          position={[s.lat, s.lng]}
          icon={shopPin(s, selectedId === s.id)}
          eventHandlers={{ click: () => onSelect(s) }}
        />
      ))}
    </MapContainer>
  );
}
