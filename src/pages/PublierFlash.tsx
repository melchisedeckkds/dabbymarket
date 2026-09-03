import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { usePublishFlashListing, useAppConfig, uploadImages } from "@/lib/queries";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { Pepite } from "@/components/pepite";
import { hapticSuccess } from "@/lib/haptics";
import { useApp } from "@/lib/app-store";
import { CATEGORIES } from "@/lib/categories";
import { CITIES, neighborhoodsFor } from "@/lib/neighborhoods";
import { FLASH_DURATIONS, FLASH_CONDITIONS, FLASH_CONDITION_LABEL_KEYS, CATEGORIES_WITHOUT_CONDITION, type FlashDurationHours, type FlashCondition } from "@/lib/flash";
import { ArrowLeft, Loader2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PublierFlashPage() {
  const { session, profile } = useAuth();
  const { t } = useApp();
  const navigate = useNavigate();
  const publish = usePublishFlashListing();
  const { data: config } = useAppConfig();

  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("mode");
  const [condition, setCondition] = useState<FlashCondition>("Bon état");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [city, setCity] = useState<string>(CITIES[0]);
  const [neighborhood, setNeighborhood] = useState("");
  const [landmark, setLandmark] = useState("");
  const [duration, setDuration] = useState<FlashDurationHours>(48);
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);

  const isFirstListing = profile?.welcome_bonus_status === "pending";
  const showCondition = !CATEGORIES_WITHOUT_CONDITION.has(category);

  const cost = useMemo(() => {
    if (isFirstListing) return 0;
    const tier = FLASH_DURATIONS.find((d) => d.hours === duration);
    return Number(config?.[tier?.configKey ?? ""] ?? 0);
  }, [isFirstListing, duration, config]);

  const neighborhoodOptions = neighborhoodsFor(city);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !price || !category) return toast.error(t("flash_missingFields"));
    if (!neighborhood) return toast.error(t("flash_neighborhoodRequired"));
    if (photos.length === 0) return toast.error(t("flash_needPhoto"));
    setSubmitting(true);
    try {
      const images = await uploadImages(
        "flash-images",
        session!.user.id,
        photos.map((p) => p.file),
      );
      await publish.mutateAsync({
        title: title.trim(),
        description,
        category,
        condition: showCondition ? condition : null,
        price_xaf: Number(price) || 0,
        negotiable,
        images,
        city,
        neighborhood,
        landmark,
        duration_hours: isFirstListing ? 48 : duration,
      });
      hapticSuccess();
      toast.success(t("flash_publishedTitle"));
      setPublished(true);
    } catch (err: any) {
      toast.error(t("flash_actionFailed"), { description: err.message ?? t("flash_insufficientPepites") });
    } finally {
      setSubmitting(false);
    }
  }

  if (published) {
    return (
      <AppShell>
        <div className="space-y-4 p-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full gold-gradient text-2xl">⚡</div>
          <h1 className="text-xl font-bold">{t("flash_publishedTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("flash_publishedDesc")}</p>
          <Link to="/" className="block rounded-xl border border-border bg-card py-3 text-sm font-semibold">
            {t("flash_backToMarche")}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-card">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="flex items-center gap-1.5 text-lg font-bold">
            <Zap size={18} className="text-primary" /> {t("flash_title")}
          </h1>
          <p className="text-[11px] text-muted-foreground">{t("flash_publishSubtitle")}</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4">
        {isFirstListing && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary">
            <Zap size={14} /> {t("flash_freeFirstListing")}
          </div>
        )}

        <Field label={t("flash_photos")}>
          <PhotoPicker photos={photos} onChange={setPhotos} max={5} />
        </Field>

        <Field label={t("flash_titleLabel")}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder={t("flash_titlePlaceholder")} />
        </Field>

        <Field label={t("flash_category")}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.key)}
              </option>
            ))}
          </select>
        </Field>

        {showCondition && (
          <Field label={t("flash_condition")}>
            <div className="grid grid-cols-3 gap-1.5">
              {FLASH_CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={cn(
                    "rounded-xl border py-2 text-[11px] font-semibold",
                    condition === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {t(FLASH_CONDITION_LABEL_KEYS[c])}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label={t("flash_description")}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input" placeholder={t("flash_descriptionPlaceholder")} />
        </Field>

        <Field label={t("flash_price")}>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="input" placeholder="15000" />
        </Field>

        <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} className="h-4 w-4 accent-[color:var(--color-primary)]" />
          <span className="text-sm font-medium">{t("flash_negotiable")}</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("flash_city")}>
            <select
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setNeighborhood("");
              }}
              className="input"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("flash_neighborhood")}>
            <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="input">
              <option value="">—</option>
              {neighborhoodOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t("flash_landmark")}>
          <input value={landmark} onChange={(e) => setLandmark(e.target.value)} className="input" placeholder={t("flash_landmarkPlaceholder")} />
        </Field>

        <div className="flex items-start gap-2 rounded-xl border border-[color:var(--verified)]/30 bg-[color:var(--verified)]/10 p-2.5 text-[11px] text-muted-foreground">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[color:var(--verified)]" />
          <span>{t("flash_locationPrivacyNote")}</span>
        </div>

        {!isFirstListing && (
          <Field label={t("flash_duration")}>
            <div className="grid grid-cols-3 gap-1.5">
              {FLASH_DURATIONS.map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  onClick={() => setDuration(d.hours)}
                  className={cn(
                    "rounded-xl border p-2 text-center transition-colors",
                    duration === d.hours ? "border-primary bg-primary/15" : "border-border bg-background",
                  )}
                >
                  <p className="text-xs font-semibold">{t(d.labelKey)}</p>
                  <p className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-primary">
                    <Pepite size={10} /> {Number(config?.[d.configKey] ?? 0)}
                  </p>
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("flash_cost")}</span>
            <span className="inline-flex items-center gap-1 font-bold text-primary">
              {cost === 0 ? t("flash_free") : (
                <>
                  {cost} <Pepite size={14} />
                </>
              )}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("flash_currentBalance")}</span>
            <span className="inline-flex items-center gap-1 font-semibold">
              {profile?.pepites_balance ?? 0} <Pepite size={12} />
            </span>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3.5 text-sm font-bold disabled:opacity-60">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {t("flash_publish")}
        </button>
      </form>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-border);background:var(--color-card);padding:0.65rem 0.85rem;font-size:0.9rem;outline:none;color:var(--color-foreground)}
      .input:focus{border-color:var(--color-primary)}`}</style>
    </AppShell>
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
