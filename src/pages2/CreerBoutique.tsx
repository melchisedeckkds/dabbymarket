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
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { Pepite } from "@/components/pepite";
import { ArrowLeft, Camera, Check, ImagePlus, Loader2, Store, Sparkles, MapPin } from "lucide-react";
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
  const { t } = useApp();
  const navigate = useNavigate();
  const createShop = useCreateShop();
  const [step, setStep] = useState<"form" | "products">("form");
  const [shopId, setShopId] = useState<string | null>(null);

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

  const icons = CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.mode;

  const progress = useMemo(() => {
    let n = 0;
    if (name) n++;
    if (desc) n++;
    if (cat) n++;
    if (logoMode === "upload" ? logoFile : emoji) n++;
    if (coords) n++;
    return Math.round((n / 5) * 100);
  }, [name, desc, cat, logoMode, logoFile, emoji, coords]);

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
    setSubmitting(true);
    try {
      let logo_url: string | undefined;
      if (logoMode === "upload" && logoFile) {
        logo_url = await uploadImage("shop-logos", session.user.id, logoFile);
      }
      const shop = await createShop.mutateAsync({
        name, description: desc, category: cat, logo_url, lat: coords?.lat, lng: coords?.lng,
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

  if (step === "products" && shopId) {
    return <AddProductsStep shopId={shopId} onDone={() => navigate("/compte")} />;
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/compte" className="group grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40">
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Store size={13} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/80">Nouvelle boutique</span>
            </div>
            <h1 className="truncate text-base font-black">{t("creerBoutique_title")}</h1>
          </div>
        </div>
      </div>

      {/* Progress premium */}
      <div className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-md">
          <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-black uppercase tracking-wider text-muted-foreground">
              <Sparkles size={12} className="text-primary" /> {t("creerBoutique_progress")}
            </span>
            <span className="text-lg font-black text-primary">{progress}%</span>
          </div>
          <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-accent/80 shadow-inner">
            <div
              className="shine relative h-full gold-gradient transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="relative mt-1.5 text-[11px] italic text-muted-foreground">{t("creerBoutique_freeNotice")}</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4">
        {/* Logo */}
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t("creerBoutique_logo")}</p>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-accent p-1 text-xs font-black">
            <button
              type="button"
              onClick={() => setLogoMode("default")}
              className={cn("rounded-lg py-2 transition-all", logoMode === "default" ? "gold-gradient text-background shadow" : "text-muted-foreground")}
            >
              {t("creerBoutique_iconTab")}
            </button>
            <button
              type="button"
              onClick={() => setLogoMode("upload")}
              className={cn("rounded-lg py-2 transition-all", logoMode === "upload" ? "gold-gradient text-background shadow" : "text-muted-foreground")}
            >
              {t("creerBoutique_galleryTab")}
            </button>
          </div>

          {logoMode === "default" ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 -m-0.5 rounded-3xl bg-gradient-to-br from-primary to-yellow-400 blur opacity-70" />
                <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-3xl gold-gradient text-4xl shadow-lg ring-2 ring-background">{emoji}</div>
              </div>
              <div className="grid flex-1 grid-cols-5 gap-1.5">
                {icons.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "grid aspect-square place-items-center rounded-xl border-2 text-xl transition-all active:scale-95",
                      emoji === e
                        ? "border-primary bg-primary/15 shadow-md scale-105"
                        : "border-border bg-background hover:border-primary/40",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-background p-3 transition-all hover:border-primary/50 hover:bg-primary/5">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-accent">
                {logoPreview ? (
                  <img src={logoPreview} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus size={26} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 text-xs">
                <p className="font-black">{logoPreview ? t("creerBoutique_photoImported") : t("creerBoutique_importFromGallery")}</p>
                <p className="mt-0.5 text-muted-foreground">{t("creerBoutique_imageHint")}</p>
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
              <option key={c.id} value={c.id}>{t(c.key)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("creerBoutique_location")}>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className={cn(
              "input flex items-center gap-2 text-left transition-all",
              coords && "border-primary bg-primary/5",
            )}
          >
            {locating ? (
              <Loader2 size={16} className="animate-spin text-primary" />
            ) : coords ? (
              <Check size={16} className="text-primary" />
            ) : (
              <MapPin size={16} className="text-primary" />
            )}
            <span className={coords ? "font-bold" : ""}>
              {coords ? `${t("creerBoutique_locationSaved")} (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})` : t("creerBoutique_useMyLocation")}
            </span>
          </button>
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="shine flex w-full items-center justify-center gap-2 rounded-2xl gold-gradient py-4 text-sm font-black text-background shadow-xl shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />}
          {t("creerBoutique_submit")}
        </button>
      </form>

      <style>{`.input{width:100%;border-radius:0.85rem;border:2px solid var(--color-border);background:var(--color-card);padding:0.75rem 0.9rem;font-size:0.9rem;outline:none;color:var(--color-foreground);transition:all .2s}
      .input:focus{border-color:var(--color-primary);box-shadow:0 0 0 4px color-mix(in oklab,var(--color-primary) 12%,transparent)}`}</style>
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
          images = await uploadImages("product-images", data.user.id, photos.map((p) => p.file));
        }
      }
      await publishProduct.mutateAsync({
        shop_id: shopId, name, description: desc, price_xaf: Number(price) || 0,
        category: "mode", condition, images,
      });
      toast.success(`${t("creerBoutique_productCreated")} -${15} ${t("pepites")}`);
      setAdded((n) => n + 1);
      setName(""); setPrice(""); setDesc(""); setPhotos([]);
    } catch (err: any) {
      toast.error(t("produit_insufficientPepites"), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onDone} className="group grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/80">Étape 2 / 2</span>
            </div>
            <h1 className="truncate text-base font-black">{t("creerBoutique_addProductsTitle")}</h1>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
            <Pepite size={12} /> {profile?.pepites_balance ?? 0}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="relative overflow-hidden rounded-3xl border border-[color:var(--verified)]/40 bg-gradient-to-br from-[color:var(--verified)]/10 via-card to-card p-5 text-center shadow-lg">
          <span className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[color:var(--verified)]/25 blur-2xl" />
          <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--verified)] shadow-lg shadow-[color:var(--verified)]/30">
            <Check size={26} className="text-background" />
          </div>
          <h2 className="relative mt-3 text-lg font-black">{t("creerBoutique_shopCreatedTitle")}</h2>
          <p className="relative mt-1 text-xs text-muted-foreground">
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
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-accent p-1 text-xs font-black">
              {(["Neuf", "Occasion"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={cn("rounded-lg py-2 transition-all", condition === c ? "bg-background text-foreground shadow" : "text-muted-foreground")}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("creerBoutique_description")}>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="input" />
          </Field>
          <button
            onClick={createNew}
            disabled={submitting}
            className="shine flex w-full items-center justify-center gap-2 rounded-2xl gold-gradient py-3.5 text-sm font-black text-background shadow-xl shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {t("creerBoutique_publish")} — {PUBLISH_COST} <Pepite size={13} />
          </button>
          <button onClick={onDone} className="w-full rounded-2xl border-2 border-border bg-card py-3 text-sm font-black shadow-sm transition-all hover:border-primary/40">
            {t("creerBoutique_finish")}
          </button>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-3 text-[11px] leading-relaxed">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" />
          <p>{t("creerBoutique_boostHint")}</p>
        </div>
      </div>

      <style>{`.input{width:100%;border-radius:0.85rem;border:2px solid var(--color-border);background:var(--color-card);padding:0.75rem 0.9rem;font-size:0.9rem;outline:none;color:var(--color-foreground);transition:all .2s}
      .input:focus{border-color:var(--color-primary);box-shadow:0 0 0 4px color-mix(in oklab,var(--color-primary) 12%,transparent)}`}</style>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
