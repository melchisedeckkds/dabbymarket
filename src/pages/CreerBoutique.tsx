import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useCreateShop, usePublishProduct, uploadImage, uploadImages } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import { hapticSuccess } from "@/lib/haptics";
import { useApp } from "@/lib/app-store";
import { CATEGORIES } from "@/lib/categories";
import { CITIES, neighborhoodsFor } from "@/lib/neighborhoods";
import { defaultHours, DAY_ORDER, DAY_LABELS_FR, DAY_LABELS_EN, type ShopHours } from "@/lib/hours";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { Pepite } from "@/components/pepite";
import { ArrowLeft, Camera, Check, ImagePlus, Loader2, Store, MapPinOff, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, string[]> = {
  mode: ["👗", "👜", "👟", "🧵", "🥻"],
  electronique: ["📱", "💻", "🎧", "📷", "🔌"],
  alimentation: ["🥭", "🍞", "🍅", "🐟", "🍲"],
  beaute: ["💄", "💇🏾‍♀️", "💅", "🧴", "🌸"],
  maison: ["🛋️", "🪑", "🕯️", "🖼️", "🧺"],
  services: ["🛠️", "🧹", "🚚", "💈", "📐"],
};

const PUBLISH_COST = 15;

export default function CreerBoutiquePage() {
  const { session } = useAuth();
  const { t, lang } = useApp();
  const navigate = useNavigate();
  const createShop = useCreateShop();
  const [step, setStep] = useState<"type" | "form" | "products">("type");
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopType, setShopType] = useState<"physical" | "no_location">("physical");

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("mode");
  const [logoMode, setLogoMode] = useState<"default" | "upload">("default");
  const [emoji, setEmoji] = useState("🛍️");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [city, setCity] = useState<string>(CITIES[0]);
  const [neighborhood, setNeighborhood] = useState("");
  const [landmark, setLandmark] = useState("");
  const [shopPhotos, setShopPhotos] = useState<PickedPhoto[]>([]);
  const [deliveryZone, setDeliveryZone] = useState("");
  const [hours, setHours] = useState<ShopHours>(defaultHours());
  const [showHours, setShowHours] = useState(false);

  const icons = CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.mode;

  const progress = useMemo(() => {
    let n = 0;
    if (name) n++;
    if (desc) n++;
    if (cat) n++;
    if (logoMode === "upload" ? logoFile : emoji) n++;
    if (shopType === "no_location" || coords) n++;
    return Math.round((n / 5) * 100);
  }, [name, desc, cat, logoMode, logoFile, emoji, coords, shopType]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 800);
    setLogoFile(compressed);
    setLogoPreview(URL.createObjectURL(compressed));
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return toast.error(t("creerBoutique_locationUnavailableError"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success(t("creerBoutique_locationSuccessToast"));
      },
      () => {
        setLocating(false);
        toast.error(t("creerBoutique_locationErrorToast"), { description: t("creerBoutique_locationErrorDesc") });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !cat) return toast.error(t("creerBoutique_requiredError"));
    if (!session) return toast.error(t("creerBoutique_loginError"));
    if (shopType === "physical" && (!coords || !neighborhood)) return toast.error(t("creerBoutique_physicalRequiredError"));
    setSubmitting(true);
    try {
      let logo_url: string | undefined;
      if (logoMode === "upload" && logoFile) {
        logo_url = await uploadImage("shop-logos", session.user.id, logoFile);
      }
      let photos: string[] = [];
      if (shopType === "physical" && shopPhotos.length) {
        photos = await uploadImages("shop-logos", session.user.id, shopPhotos.map((p) => p.file));
      }
      const shop = await createShop.mutateAsync({
        name,
        description: desc,
        category: cat,
        logo_url,
        lat: shopType === "physical" ? coords?.lat : undefined,
        lng: shopType === "physical" ? coords?.lng : undefined,
        shop_type: shopType,
        city: shopType === "physical" ? city : undefined,
        neighborhood: shopType === "physical" ? neighborhood : undefined,
        landmark: shopType === "physical" ? landmark : undefined,
        photos: shopType === "physical" ? photos : undefined,
        delivery_zone: shopType === "no_location" ? deliveryZone : undefined,
        hours: shopType === "physical" && showHours ? hours : undefined,
      });
      setShopId(shop.id);
      hapticSuccess();
      toast.success(t("creerBoutique_createdSuccess"));
      setStep("products");
    } catch (err: any) {
      toast.error(t("creerBoutique_createFailed"), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "type") {
    return (
      <AppShell>
        <div className="flex items-center gap-2 px-4 pt-3">
          <Link to="/compte" className="grid h-9 w-9 place-items-center rounded-full bg-card">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">{t("creerBoutique_title")}</h1>
        </div>
        <div className="p-4">
          <p className="mb-4 text-sm text-muted-foreground">{t("creerBoutique_typeQuestion")}</p>
          <button
            type="button"
            onClick={() => { setShopType("physical"); setStep("form"); }}
            className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gold-gradient"><Store size={22} /></span>
            <span>
              <span className="block text-sm font-bold">{t("creerBoutique_typePhysical")}</span>
              <span className="block text-xs text-muted-foreground">{t("creerBoutique_typePhysicalDesc")}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setShopType("no_location"); setStep("form"); }}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent"><MapPinOff size={22} className="text-muted-foreground" /></span>
            <span>
              <span className="block text-sm font-bold">{t("creerBoutique_typeNoLocation")}</span>
              <span className="block text-xs text-muted-foreground">{t("creerBoutique_typeNoLocationDesc")}</span>
            </span>
          </button>
        </div>
      </AppShell>
    );
  }

  if (step === "products" && shopId) {
    return <AddProductsStep shopId={shopId} onDone={() => navigate("/compte")} />;
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <button type="button" onClick={() => setStep("type")} className="grid h-9 w-9 place-items-center rounded-full bg-card">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold">{t("creerBoutique_title")}</h1>
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">{t("creerBoutique_progress")}</span>
          <span className="font-bold text-primary">{progress}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-accent">
          <div className="h-full gold-gradient transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{t("creerBoutique_freeNotice")}</p>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4">
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("creerBoutique_logo")}</p>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-accent p-1 text-xs font-semibold">
            <button type="button" onClick={() => setLogoMode("default")} className={cn("rounded-lg py-1.5", logoMode === "default" ? "bg-background text-foreground" : "text-muted-foreground")}>
              {t("creerBoutique_iconTab")}
            </button>
            <button type="button" onClick={() => setLogoMode("upload")} className={cn("rounded-lg py-1.5", logoMode === "upload" ? "bg-background text-foreground" : "text-muted-foreground")}>
              {t("creerBoutique_galleryTab")}
            </button>
          </div>

          {logoMode === "default" ? (
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl gold-gradient text-3xl">{emoji}</div>
              <div className="grid flex-1 grid-cols-5 gap-1.5">
                {icons.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn("grid aspect-square place-items-center rounded-lg border text-xl transition-all", emoji === e ? "border-primary bg-primary/10 scale-105" : "border-border bg-background")}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-background">
                {logoPreview ? <img src={logoPreview} alt="logo" className="h-full w-full object-cover" /> : <ImagePlus size={22} className="text-muted-foreground" />}
              </div>
              <div className="flex-1 text-xs">
                <p className="font-semibold">{logoPreview ? t("creerBoutique_photoImported") : t("creerBoutique_importFromGallery")}</p>
                <p className="text-muted-foreground">{t("creerBoutique_imageHint")}</p>
              </div>
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          )}
        </div>

        <Field label={t("creerBoutique_name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={t("creerBoutique_namePlaceholder")} />
        </Field>
        <Field label={t("creerBoutique_description")}>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="input" placeholder={t("creerBoutique_descriptionPlaceholder")} />
        </Field>
        <Field label={t("creerBoutique_category")}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.key)}
              </option>
            ))}
          </select>
        </Field>
        {shopType === "physical" && (
          <>
            <Field label={t("creerBoutique_location")}>
              <button type="button" onClick={useMyLocation} disabled={locating} className="input flex items-center gap-2 text-left">
                {locating ? <Loader2 size={16} className="animate-spin text-primary" /> : <Camera size={16} className="text-primary" />}
                {coords ? `${t("creerBoutique_locationSaved")} (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})` : t("creerBoutique_useMyLocation")}
              </button>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("creerBoutique_city")}>
                <select value={city} onChange={(e) => { setCity(e.target.value); setNeighborhood(""); }} className="input">
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={t("creerBoutique_neighborhood")}>
                <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="input">
                  <option value="">{t("creerBoutique_neighborhoodPlaceholder")}</option>
                  {neighborhoodsFor(city).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t("creerBoutique_landmark")}>
              <input value={landmark} onChange={(e) => setLandmark(e.target.value)} className="input" placeholder={t("creerBoutique_landmarkPlaceholder")} />
            </Field>
            <Field label={t("creerBoutique_shopPhotos")}>
              <p className="mb-1.5 text-[11px] text-muted-foreground">{t("creerBoutique_shopPhotosHint")}</p>
              <PhotoPicker photos={shopPhotos} onChange={setShopPhotos} max={3} />
            </Field>
            <div className="rounded-2xl border border-border bg-card p-3">
              <button type="button" onClick={() => setShowHours((v) => !v)} className="flex w-full items-center gap-2 text-left text-xs font-semibold">
                <Clock size={15} className="text-primary" /> {t("creerBoutique_setHours")}
                <span className="ml-auto text-muted-foreground">{showHours ? "−" : "+"}</span>
              </button>
              {showHours && <HoursEditor hours={hours} onChange={setHours} lang={lang} />}
            </div>
          </>
        )}
        {shopType === "no_location" && (
          <Field label={t("creerBoutique_deliveryZone")}>
            <input value={deliveryZone} onChange={(e) => setDeliveryZone(e.target.value)} className="input" placeholder={t("creerBoutique_deliveryZonePlaceholder")} />
          </Field>
        )}

        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3.5 text-sm font-bold disabled:opacity-60">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {t("creerBoutique_submit")}
        </button>
      </form>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-border);background:var(--color-card);padding:0.65rem 0.85rem;font-size:0.9rem;outline:none;color:var(--color-foreground)}`}</style>
    </AppShell>
  );
}

function AddProductsStep({ shopId, onDone }: { shopId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const { t } = useApp();
  const publishProduct = usePublishProduct();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<"Neuf" | "Occasion">("Neuf");
  const [desc, setDesc] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [added, setAdded] = useState(0);

  async function createNew() {
    if (!name || !price) return toast.error(t("creerBoutique_nameAndPriceRequired"));
    setSubmitting(true);
    try {
      let images: string[] = [];
      if (photos.length) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          images = await uploadImages(
            "product-images",
            data.user.id,
            photos.map((p) => p.file),
          );
        }
      }
      await publishProduct.mutateAsync({
        shop_id: shopId,
        name,
        description: desc,
        price_xaf: Number(price) || 0,
        category: "mode",
        condition,
        images,
      });
      toast.success(`${t("creerBoutique_productCreated")} -${15} ${t("pepites")}`);
      setAdded((n) => n + 1);
      setName("");
      setPrice("");
      setDesc("");
      setPhotos([]);
    } catch (err: any) {
      toast.error(t("produit_insufficientPepites"), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <button onClick={onDone} className="grid h-9 w-9 place-items-center rounded-full bg-card">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold">{t("creerBoutique_addProductsTitle")}</h1>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
          <Pepite size={12} /> {profile?.pepites_balance ?? 0}
        </span>
      </div>

      <div className="p-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full gold-gradient">
            <Check size={22} />
          </div>
          <h2 className="mt-2 text-base font-bold">{t("creerBoutique_shopCreatedTitle")}</h2>
          <p className="text-xs text-muted-foreground">
            {added > 0 ? `${added} ${t("creerBoutique_addedProducts")}` : t("creerBoutique_addNow")}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <Field label={t("publier_photos")}>
            <PhotoPicker photos={photos} onChange={setPhotos} />
          </Field>
          <Field label={t("creerBoutique_productName")}>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={t("creerBoutique_productNamePlaceholder")} />
          </Field>
          <Field label={t("creerBoutique_price")}>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="input" placeholder="18500" />
          </Field>
          <Field label={t("creerBoutique_condition")}>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-accent p-1 text-xs font-semibold">
              {(["Neuf", "Occasion"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCondition(c)} className={cn("rounded-lg py-1.5", condition === c ? "bg-background text-foreground" : "text-muted-foreground")}>
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("creerBoutique_description")}>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="input" />
          </Field>
          <button onClick={createNew} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3 text-sm font-bold disabled:opacity-60">
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {t("creerBoutique_publish")} — {PUBLISH_COST} <Pepite size={13} />
          </button>
          <button onClick={onDone} className="w-full rounded-xl border border-border bg-card py-3 text-sm font-semibold">
            {t("creerBoutique_finish")}
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-[11px]">
          <p>
            {t("creerBoutique_boostHint")}
          </p>
        </div>
      </div>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-border);background:var(--color-card);padding:0.65rem 0.85rem;font-size:0.9rem;outline:none;color:var(--color-foreground)}`}</style>
    </AppShell>
  );
}

function HoursEditor({ hours, onChange, lang }: { hours: ShopHours; onChange: (h: ShopHours) => void; lang: string }) {
  const labels = lang === "en" ? DAY_LABELS_EN : DAY_LABELS_FR;
  function setDay(day: keyof ShopHours["days"], patch: Partial<ShopHours["days"][typeof day]>) {
    onChange({ ...hours, days: { ...hours.days, [day]: { ...hours.days[day], ...patch } } });
  }
  return (
    <div className="mt-3 space-y-2">
      <label className="flex items-center justify-between rounded-xl bg-accent px-3 py-2 text-xs font-semibold">
        {lang === "en" ? "Always open" : "Toujours ouvert"}
        <input type="checkbox" checked={hours.alwaysOpen} onChange={(e) => onChange({ ...hours, alwaysOpen: e.target.checked })} />
      </label>
      {!hours.alwaysOpen && (
        <div className="space-y-1.5">
          {DAY_ORDER.map((d) => (
            <div key={d} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 font-medium">{labels[d]}</span>
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={!hours.days[d].closed} onChange={(e) => setDay(d, { closed: !e.target.checked })} />
                {lang === "en" ? "open" : "ouvert"}
              </label>
              {!hours.days[d].closed && (
                <>
                  <input type="time" value={hours.days[d].open} onChange={(e) => setDay(d, { open: e.target.value })} className="rounded-lg border border-border bg-background px-1.5 py-1 text-[11px]" />
                  <span>–</span>
                  <input type="time" value={hours.days[d].close} onChange={(e) => setDay(d, { close: e.target.value })} className="rounded-lg border border-border bg-background px-1.5 py-1 text-[11px]" />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
