import { Link, useParams, useNavigate } from "react-router-dom";
import { Star, MapPin, ArrowLeft, MessageCircle, Store, Loader2, Eye, Compass, Clock as ClockIcon, Zap, Plus, X, History as Clock3, Flag } from "lucide-react";
import { useState } from "react";
import { VerifiedBadge, ConditionBadge } from "@/components/product-card";
import { ShopHeaderSkeleton } from "@/components/skeletons";
import { GuestPrompt } from "@/components/guest-prompt";
import { BoostPicker } from "@/components/boost-picker";
import { ReportDialog } from "@/components/report-dialog";
import { SponsoredBadge } from "@/components/sponsored-badge";
import { BottomNav } from "@/components/bottom-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { useShop, useShops, useProducts, useReviews, useStartConversation, useRecordView, useViewsCount, useActiveBoosts, useShopLocations, useAddShopLocation, useRelocateShopLocation, useCloseShopLocation, useIsFollowing, useToggleFollow } from "@/lib/queries";
import { neighborhoodsFor, CITIES } from "@/lib/neighborhoods";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { isOpenNow } from "@/lib/hours";
import { toast } from "sonner";

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export default function BoutiquePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t, lang } = useApp();
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const { data: shop, isLoading } = useShop(id);
  const { data: products = [] } = useProducts(id);
  const { data: reviews = [] } = useReviews(id);
  const { data: following = false } = useIsFollowing(id);
  const toggleFollow = useToggleFollow(id);
  const startConversation = useStartConversation();
  useRecordView("shop", id);
  const { data: viewsCount = 0 } = useViewsCount("shop", id);
  const [tab, setTab] = useState<"produits" | "avis" | "apropos" | "loc">("produits");
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [showBoostPicker, setShowBoostPicker] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const { data: activeShopBoosts = [] } = useActiveBoosts("shop", id);
  const { data: allShops = [] } = useShops();

  if (isLoading) {
    return <ShopHeaderSkeleton />;
  }

  if (!shop) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-background p-8 text-center text-sm text-muted-foreground">
        {t("boutique_notFound")}
        <div className="lg:hidden"><BottomNav /></div>
      </div>
    );
  }

  const avgRating = reviews.length ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const openNow = isOpenNow(shop?.hours);
  const wellRated = reviews.length >= 5 && Number(avgRating) >= 4.5;
  const nearby = shop && shop.shop_type !== "no_location" && shop.lat != null
    ? allShops
        .filter((s: any) => s.id !== shop.id && s.lat != null && s.lng != null)
        .map((s: any) => ({ ...s, distanceKm: haversineKm(shop, s) }))
        .filter((s: any) => s.distanceKm <= 0.25)
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
        .slice(0, 10)
    : [];

  async function handleContact() {
    if (!session) return setShowGuestPrompt(true);
    if (session.user.id === shop.owner_id) return toast.error(t("boutique_ownShopError"));
    const conv = await startConversation.mutateAsync({ sellerId: shop.owner_id, shopId: shop.id });
    navigate(`/messages/${conv.id}`);
  }

  function handleFollow() {
    if (!session) return setShowGuestPrompt(true);
    toggleFollow.mutate(following);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] bg-background lg:justify-center">
      <SidebarNav />
      <div className="flex min-h-screen w-full max-w-md flex-col bg-background pb-32 lg:max-w-2xl lg:border-x lg:border-border lg:pb-8">
      <div className="relative h-40 w-full bg-gradient-to-br from-primary/30 to-card">
        <Link to="/" className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/70 backdrop-blur" aria-label={t("common_back")}>
          <ArrowLeft size={18} />
        </Link>
        {session?.user?.id !== shop.owner_id && (
          <button
            onClick={() => (session ? setShowReportDialog(true) : setShowGuestPrompt(true))}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/70 text-muted-foreground backdrop-blur"
            aria-label={t("report_title")}
          >
            <Flag size={16} />
          </button>
        )}
      </div>

      <div className="-mt-10 px-4">
        <div className="flex items-end gap-3">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-background bg-card text-4xl">
            {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-bold">{shop.name}</h1>
              {shop.verified && <VerifiedBadge />}
              {activeShopBoosts.length > 0 && <SponsoredBadge />}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {avgRating && (
                <span className="flex items-center gap-0.5 text-foreground">
                  <Star size={13} className="fill-primary text-primary" />
                  <span className="font-semibold">{avgRating}</span>
                  <span className="text-muted-foreground">({reviews.length})</span>
                </span>
              )}
              {wellRated && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{t("boutique_wellRated")}</span>
              )}
              {openNow !== null && (
                <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", openNow ? "bg-[color:var(--verified)]/15 text-[color:var(--verified)]" : "bg-destructive/15 text-destructive")}>
                  <ClockIcon size={10} /> {openNow ? t("boutique_openNow") : t("boutique_closedNow")}
                </span>
              )}
              <span>•</span>
              <span>{t("common_since")} {new Date(shop.created_at).toLocaleDateString(locale, { month: "long", year: "numeric" })}</span>
            </div>
          </div>
        </div>
        {shop.description && <p className="mt-3 text-sm text-muted-foreground">{shop.description}</p>}

        <div className="mt-4 flex items-center gap-2 border-b border-border">
          {([
            ["produits", t("boutique_products")],
            ["avis", t("boutique_reviews")],
            ["apropos", t("boutique_about")],
            ["loc", t("boutique_location")],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn("relative px-1 pb-3 text-sm font-semibold transition-colors", tab === k ? "text-primary" : "text-muted-foreground")}
            >
              {label}
              {tab === k && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {tab === "produits" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {products.length === 0 && (
              <p className="col-span-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("boutique_noProducts")}
              </p>
            )}
            {products.map((p: any) => (
              <Link to={`/produit/${p.id}`} key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative aspect-square bg-accent">
                  {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />}
                  <span className="absolute left-2 top-2">
                    <ConditionBadge condition={p.condition} />
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-1 text-xs font-semibold">{p.name}</p>
                  <p className="mt-0.5 text-sm font-bold text-primary">{formatXAF(p.price_xaf)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === "avis" && (
          <div className="mt-4 space-y-3">
            {reviews.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("boutique_noReviews")}
              </p>
            )}
            {reviews.map((r: any) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{r.profiles?.name ?? "—"}</span>
                  <span className="flex items-center gap-0.5 text-xs">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} className={i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"} />
                    ))}
                  </span>
                </div>
                {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale)}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "apropos" && (
          <div className="mt-4 space-y-3">
            {shop.photos?.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {shop.photos.map((url: string, i: number) => (
                  <div key={url} className="aspect-square overflow-hidden rounded-xl bg-accent">
                    <img src={url} alt={["façade", "entrée", "intérieur"][i] ?? ""} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            <dl className="space-y-2 text-sm">
            {[
              [t("boutique_category"), shop.category],
              ...(shop.neighborhood ? [[t("boutique_neighborhood"), `${shop.neighborhood}, ${shop.city ?? "Yaoundé"}`]] : []),
              [t("boutique_since"), `${t("common_since")} ${new Date(shop.created_at).toLocaleDateString(locale)}`],
              [t("boutique_publishedProducts"), `${products.length}`],
              [t("boutique_views"), `${viewsCount}`],
              [t("boutique_status"), shop.verified ? t("boutique_statusVerified") : t("boutique_statusUnverified")],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
            </dl>
            {shop.landmark && (
              <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                <Compass size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>{shop.landmark}</span>
              </div>
            )}
            {nearby.length > 0 && (
              <div>
                <p className="mb-2 mt-4 text-sm font-semibold">
                  {t("boutique_discoverAround").replace("{n}", String(nearby.length))}
                </p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {nearby.map((s: any) => (
                    <Link key={s.id} to={`/boutique/${s.id}`} className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent text-sm">
                        {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                      </span>
                      <span className="text-xs font-semibold">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground">{Math.round(s.distanceKm * 1000)}m</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "loc" && (
          <div className="mt-4 space-y-3">
            {shop.shop_type === "no_location" ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">
                <MapPin size={24} className="mx-auto mb-2 text-muted-foreground" />
                {t("boutique_noLocationShop")}
                {shop.delivery_zone && <p className="mt-2 text-foreground">{t("boutique_deliveryZoneLabel")} : {shop.delivery_zone}</p>}
              </div>
            ) : (
              <>
                <div className="grid h-40 place-items-center rounded-2xl border border-border bg-card text-muted-foreground">
                  <div className="text-center">
                    <MapPin size={28} className="mx-auto text-primary" />
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {shop.lat != null ? t("boutique_locationSaved") : t("boutique_locationMissing")}
                    </p>
                    {shop.neighborhood && <p className="text-xs">{shop.neighborhood}, {shop.city ?? "Yaoundé"}</p>}
                  </div>
                </div>
                {shop.landmark && (
                  <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                    <Compass size={16} className="mt-0.5 shrink-0 text-primary" />
                    <span>{shop.landmark}</span>
                  </div>
                )}
                <Link to="/carte" className="block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
                  {t("boutique_viewOnMap")}
                </Link>
                <ShopLocationsManager shopId={shop.id} isOwner={session?.user?.id === shop.owner_id} />
              </>
            )}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md border-t border-border bg-background/95 p-3 backdrop-blur lg:bottom-0 lg:max-w-2xl">
        {session?.user?.id === shop.owner_id ? (
          <button
            onClick={() => setShowBoostPicker(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient shine py-3 text-sm font-bold"
          >
            <Zap size={16} /> {activeShopBoosts.length > 0 ? t("boost_active") : t("boutique_boostMine")}
          </button>
        ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleContact} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
            <MessageCircle size={16} /> {t("boutique_contact")}
          </button>
          <button
            onClick={handleFollow}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold",
              following ? "border-primary bg-primary/10 text-primary" : "border-border bg-card",
            )}
          >
            <Store size={16} /> {following ? t("boutique_following") : t("boutique_follow")}
          </button>
        </div>
        )}
      </div>

      <div className="lg:hidden"><BottomNav /></div>
      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
      <BoostPicker open={showBoostPicker} onClose={() => setShowBoostPicker(false)} targetType="shop" targetId={shop.id} />
      <ReportDialog open={showReportDialog} onClose={() => setShowReportDialog(false)} targetType="shop" targetId={shop.id} />
      </div>
    </div>
  );
}

// =========================================================
// Emplacements multiples (succursales) + historique de déménagement.
// Visible par tous (transparence des anciennes/nouvelles adresses) ;
// les actions d'ajout/déménagement/fermeture sont réservées au propriétaire.
// =========================================================
function ShopLocationsManager({ shopId, isOwner }: { shopId: string; isOwner: boolean }) {
  const { t } = useApp();
  const { data: locations = [] } = useShopLocations(shopId);
  const addLocation = useAddShopLocation();
  const relocate = useRelocateShopLocation();
  const closeLocation = useCloseShopLocation();
  const [mode, setMode] = useState<null | "add" | { relocateId: string }>(null);
  const [city, setCity] = useState<string>(CITIES[0]);
  const [neighborhood, setNeighborhood] = useState("");
  const [landmark, setLandmark] = useState("");
  const [label, setLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const current = locations.filter((l: any) => l.is_current);
  const history = locations.filter((l: any) => !l.is_current);

  function resetForm() {
    setMode(null);
    setNeighborhood("");
    setLandmark("");
    setLabel("");
    setCoords(null);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return toast.error(t("creerBoutique_locationUnavailableError"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error(t("creerBoutique_locationErrorToast"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit() {
    if (!coords || !neighborhood) return toast.error(t("creerBoutique_physicalRequiredError"));
    setSubmitting(true);
    try {
      if (mode === "add") {
        await addLocation.mutateAsync({ shopId, lat: coords.lat, lng: coords.lng, neighborhood, city, landmark, label: label || undefined });
        toast.success(t("boutique_locationAdded"));
      } else if (mode && "relocateId" in mode) {
        await relocate.mutateAsync({ locationId: mode.relocateId, shopId, lat: coords.lat, lng: coords.lng, neighborhood, city, landmark });
        toast.success(t("boutique_locationMoved"));
      }
      resetForm();
    } catch (e: any) {
      toast.error(t("boost_purchaseFailed"), { description: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {current.length > 1 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("boutique_ourAddresses")}</p>
          <div className="space-y-1.5">
            {current.map((l: any) => (
              <div key={l.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-2.5 text-xs">
                <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  {l.label && <p className="font-semibold">{l.label}</p>}
                  <p className="text-muted-foreground">{l.neighborhood}, {l.city}{l.landmark ? ` — ${l.landmark}` : ""}</p>
                </div>
                {isOwner && (
                  <button onClick={() => setMode({ relocateId: l.id })} className="shrink-0 text-[11px] font-semibold text-primary">
                    {t("boutique_relocate")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("boutique_addressHistory")}</p>
          <div className="space-y-1.5">
            {history.map((l: any) => (
              <div key={l.id} className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-background p-2.5 text-xs text-muted-foreground">
                <Clock3 size={13} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="line-through">{l.neighborhood}, {l.city}{l.landmark ? ` — ${l.landmark}` : ""}</p>
                  <p className="mt-0.5">
                    {t("boutique_relocatedOn")} {l.replaced_at ? new Date(l.replaced_at).toLocaleDateString() : ""}
                  </p>
                </div>
                {isOwner && current.length + history.length > 1 && !l.is_primary && (
                  <button onClick={() => closeLocation.mutate({ locationId: l.id, shopId })} className="shrink-0 text-destructive">
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwner && !mode && (
        <button onClick={() => setMode("add")} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-primary">
          <Plus size={14} /> {t("boutique_addLocation")}
        </button>
      )}

      {isOwner && mode && (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-3">
          <p className="text-xs font-bold">{mode === "add" ? t("boutique_addLocation") : t("boutique_relocate")}</p>
          {mode === "add" && (
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("boutique_locationLabelPlaceholder")} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
          )}
          <button onClick={useMyLocation} disabled={locating} className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
            {locating ? <Loader2 size={13} className="animate-spin text-primary" /> : <MapPin size={13} className="text-primary" />}
            {coords ? `${t("creerBoutique_locationSaved")} (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})` : t("creerBoutique_useMyLocation")}
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            <select value={city} onChange={(e) => { setCity(e.target.value); setNeighborhood(""); }} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
              <option value="">{t("creerBoutique_neighborhoodPlaceholder")}</option>
              {neighborhoodsFor(city).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder={t("creerBoutique_landmarkPlaceholder")} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold">{t("common_cancel")}</button>
            <button onClick={submit} disabled={submitting} className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
              {t("common_save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
