import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Star, MessageCircle, PackageSearch, ChevronDown, Layers, X, Navigation,
  Crosshair, Search, ShieldCheck, Loader2, MapPin, Clock,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { VerifiedBadge } from "@/components/product-card";
import { useApp } from "@/lib/app-store";
import { CATEGORIES } from "@/lib/categories";
import { useAuth } from "@/lib/auth";
import { useShops, useProducts, useReviews, useStartConversation, useSendMessage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { COUNTRY_CODES, getCountryFromPhone } from "@/lib/country-codes";
import { GuestPrompt } from "@/components/guest-prompt";
import { toast } from "sonner";

const MapView = lazy(() => import("@/components/map-view"));

type GeoPoint = { lat: number; lng: number; accuracy?: number };
type GeoStatus = "idle" | "asking" | "granted" | "denied";

function haversineKm(a: GeoPoint, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function useGeolocation() {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");

  function requestLocation(): Promise<GeoPoint | null> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) {
        setGeoStatus("denied");
        resolve(null);
        return;
      }
      setGeoStatus("asking");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setLocation(p);
          setGeoStatus("granted");
          resolve(p);
        },
        () => {
          setGeoStatus("denied");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  return { location, geoStatus, requestLocation };
}

export default function CartePage() {
  const { theme, t } = useApp();
  const { profile } = useAuth();
  const { location, geoStatus, requestLocation } = useGeolocation();
  const { data: shops = [], isLoading } = useShops();
  const [selected, setSelected] = useState<any | null>(null);
  const [routeFor, setRouteFor] = useState<any | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [distMax, setDistMax] = useState(20);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [showLocateSheet, setShowLocateSheet] = useState(false);
  useEscapeToClose(showLocateSheet, () => setShowLocateSheet(false));
  useEscapeToClose(!!selected, () => setSelected(null));

  // Oriente la carte vers le pays de l'utilisateur (déduit de son numéro de
  // téléphone) dès l'ouverture, avant même qu'il n'active sa position
  // précise — voir la fonction FitToShops dans map-view.tsx.
  const countryCenter = getCountryFromPhone(profile?.phone)?.center ?? COUNTRY_CODES[0].center;

  useEffect(() => setMounted(true), []);

  const shopsWithDistance = useMemo(
    () =>
      shops
        .filter((s: any) => s.lat != null && s.lng != null)
        .map((s: any) => ({ ...s, distanceKm: location ? haversineKm(location, s) : null })),
    [shops, location],
  );

  const filtered = useMemo(
    () =>
      shopsWithDistance.filter((s: any) => {
        if (cat && s.category !== cat) return false;
        if (s.distanceKm != null && s.distanceKm > distMax) return false;
        if (query && !`${s.name}`.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [shopsWithDistance, cat, distMax, query],
  );

  const handleLocate = async () => {
    if (geoStatus === "granted" && location) {
      setFocus([location.lat, location.lng]);
      toast.success(t("carte_locationCentered"));
      return;
    }
    setShowLocateSheet(true);
  };

  const confirmLocate = async () => {
    setShowLocateSheet(false);
    const p = await requestLocation();
    if (p) {
      setFocus([p.lat, p.lng]);
      toast.success(t("carte_locationValidated"), { description: t("carte_locationValidatedDesc") });
    } else {
      toast.error(t("carte_locationUnavailable"), { description: t("carte_locationUnavailableDesc") });
    }
  };

  return (
    <AppShell hideTopBar>
      <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
        {mounted && !isLoading ? (
          <Suspense fallback={<MapSkeleton />}>
            <MapView
              shops={filtered}
              selectedId={selected?.id ?? null}
              onSelect={(s: any) => {
                setSelected(s);
                setFocus([s.lat, s.lng]);
              }}
              user={location}
              theme={theme}
              focus={focus}
              countryCenter={countryCenter}
              onMapClick={() => setSelected(null)}
            />
          </Suspense>
        ) : (
          <MapSkeleton />
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[350] h-40 bg-gradient-to-b from-background/85 via-background/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[350] h-32 bg-gradient-to-t from-background/70 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] space-y-2 p-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
            <Search size={16} className="text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("carte_searchPlaceholder")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label={t("common_close")} className="text-muted-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="pointer-events-auto flex gap-2 overflow-x-auto no-scrollbar">
            <FilterChip active={cat !== null}>
              <select value={cat ?? ""} onChange={(e) => setCat(e.target.value || null)} className="bg-transparent text-xs font-semibold outline-none">
                <option value="">{t("carte_allCategories")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t(c.key)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </FilterChip>
            <FilterChip active={distMax < 20}>
              <Layers size={13} />
              <select value={distMax} onChange={(e) => setDistMax(Number(e.target.value))} className="bg-transparent text-xs font-semibold outline-none">
                {[1, 3, 5, 10, 20].map((d) => (
                  <option key={d} value={d}>
                    ≤ {d} km
                  </option>
                ))}
              </select>
            </FilterChip>
          </div>
        </div>

        <button
          onClick={handleLocate}
          aria-label={t("carte_locate")}
          className={cn(
            "absolute right-4 z-[500] grid h-12 w-12 place-items-center rounded-full border border-border bg-card shadow-xl transition-all active:scale-95",
            selected || routeFor ? "bottom-[19rem]" : "bottom-40",
            geoStatus === "granted" && "border-primary text-primary",
          )}
        >
          {geoStatus === "asking" ? <Loader2 size={20} className="animate-spin" /> : <Crosshair size={20} className={geoStatus === "granted" ? "text-primary" : ""} />}
        </button>

        {!selected && !routeFor && filtered.length > 0 && (
          <div className="absolute inset-x-0 bottom-3 z-[450] animate-in fade-in slide-in-from-bottom-4">
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto no-scrollbar px-3 pb-2">
              {filtered.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelected(s);
                    setFocus([s.lat, s.lng]);
                  }}
                  className="dm-shop-card snap-center shrink-0 basis-[78%] overflow-hidden rounded-2xl border border-border bg-card/95 p-3 text-left shadow-xl backdrop-blur active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-2xl">
                      {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-sm font-bold">{s.name}</span>
                        {s.verified && <VerifiedBadge />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {s.distanceKm != null && <span>{s.distanceKm.toFixed(1)} km</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && !routeFor && (
          <ShopSheet shop={selected} onClose={() => setSelected(null)} onRoute={(s) => setRouteFor(s)} userLocation={location} />
        )}
        {routeFor && <RouteSheet shop={routeFor} userLocation={location} onClose={() => setRouteFor(null)} />}

        {showLocateSheet && (
          <div
            className="absolute inset-0 z-[700] flex items-end bg-background/70 backdrop-blur-sm animate-in fade-in"
            onClick={() => setShowLocateSheet(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full animate-in slide-in-from-bottom rounded-t-3xl border-t border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            >
              <button
                onClick={() => setShowLocateSheet(false)}
                aria-label={t("common_close")}
                className="mx-auto mb-1 block h-1.5 w-12 rounded-full bg-muted-foreground/40"
              />
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gold-gradient shine">
                <MapPin size={26} />
              </div>
              <h3 className="mt-3 text-center text-base font-bold">{t("carte_locationTitle")}</h3>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {t("carte_locationDesc")}
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[color:var(--verified)]/40 bg-[color:var(--verified)]/10 p-2.5 text-[11px]">
                <ShieldCheck size={14} className="shrink-0 text-[color:var(--verified)]" />
                <span>{t("carte_locationRevoke")}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setShowLocateSheet(false)} className="rounded-xl border border-border bg-background py-2.5 text-sm font-semibold">
                  {t("carte_later")}
                </button>
                <button onClick={confirmLocate} className="rounded-xl gold-gradient py-2.5 text-sm font-bold shine">
                  {t("carte_allow")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function MapSkeleton() {
  const { t } = useApp();
  return (
    <div className="absolute inset-0 grid place-items-center bg-card">
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={20} className="animate-spin text-primary" />
        {t("carte_loadingMap")}
      </div>
    </div>
  );
}

function FilterChip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur transition-all",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/95 text-foreground",
      )}
    >
      {children}
    </div>
  );
}

function ShopSheet({
  shop,
  onClose,
  onRoute,
  userLocation,
}: {
  shop: any;
  onClose: () => void;
  onRoute: (s: any) => void;
  userLocation: GeoPoint | null;
}) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t } = useApp();
  const { data: products = [] } = useProducts(shop.id);
  const { data: reviews = [] } = useReviews(shop.id);
  const startConversation = useStartConversation();
  const sendMessage = useSendMessage();
  const previews = products.slice(0, 3);
  const avgRating = reviews.length ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  useEscapeToClose(true, onClose);

  async function handleContact() {
    if (!session) return setShowGuestPrompt(true);
    if (session.user.id === shop.owner_id) return toast.error(t("carte_ownShop"));
    const conv = await startConversation.mutateAsync({ sellerId: shop.owner_id, shopId: shop.id });
    navigate(`/messages/${conv.id}`);
  }

  async function handleDeliveryRequest() {
    if (!session) return setShowGuestPrompt(true);
    if (!userLocation) return toast.error(t("carte_enableLocationFirst"));
    const conv = await startConversation.mutateAsync({ sellerId: shop.owner_id, shopId: shop.id });
    await sendMessage.mutateAsync({
      conversationId: conv.id,
      text: t("carte_deliveryMessage"),
      sharedLat: userLocation.lat,
      sharedLng: userLocation.lng,
    });
    toast.success(t("carte_positionSent"));
    navigate(`/messages/${conv.id}`);
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-[500] max-h-[75vh] animate-in slide-in-from-bottom-6 overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
      <button onClick={onClose} aria-label={t("common_close")} className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-muted-foreground/40" />
      <button
        onClick={onClose}
        aria-label={t("common_close")}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
      >
        <X size={16} />
      </button>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl gold-gradient text-2xl shadow-lg shadow-primary/20">
            {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
          </div>
          {shop.verified && (
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--verified)] text-background text-[10px]">✓</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-bold">{shop.name}</h3>
            {shop.verified && <VerifiedBadge />}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {avgRating && (
              <span className="flex items-center gap-0.5 text-foreground">
                <Star size={12} className="fill-primary text-primary" />
                <span className="font-semibold">{avgRating}</span>
              </span>
            )}
            {shop.distanceKm != null && (
              <>
                <span>•</span>
                <span>{shop.distanceKm.toFixed(1)} km</span>
              </>
            )}
          </div>
        </div>
      </div>

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {previews.map((p: any) => (
            <Link to={`/produit/${p.id}`} key={p.id} className="aspect-square overflow-hidden rounded-lg bg-accent">
              {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" /> : null}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button onClick={handleContact} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground">
          <MessageCircle size={14} /> {t("carte_contact")}
        </button>
        <button onClick={() => onRoute(shop)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-semibold hover:bg-accent">
          <Navigation size={14} /> {t("carte_route")}
        </button>
        <button onClick={handleDeliveryRequest} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-semibold hover:bg-accent">
          <PackageSearch size={14} /> {t("carte_delivery")}
        </button>
      </div>

      <Link to={`/boutique/${shop.id}`} className="mt-3 block rounded-xl border border-border bg-background py-2.5 text-center text-xs font-semibold">
        {t("carte_viewShop")}
      </Link>
      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
    </div>
  );
}

function RouteSheet({ shop, userLocation, onClose }: { shop: any; userLocation: GeoPoint | null; onClose: () => void }) {
  useEffect(() => {
    // Ouvre un vrai calcul d'itinéraire dans Google Maps (nouvel onglet),
    // avec la position réelle de l'utilisateur comme origine si disponible.
    const dest = `${shop.lat},${shop.lng}`;
    const url = userLocation
      ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${dest}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
