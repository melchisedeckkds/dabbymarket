import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useMyShops, usePublishProduct, useCreatePost, uploadImage, uploadImages } from "@/lib/queries";
import { Pepite } from "@/components/pepite";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { compressImage } from "@/lib/image";
import { hapticSuccess } from "@/lib/haptics";
import { useApp } from "@/lib/app-store";
import { CATEGORIES } from "@/lib/categories";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COST = 15;

export default function PublierPage() {
  const [params] = useSearchParams();
  const type = params.get("type"); // "post" | "vitrine" | null (produit par défaut)

  if (type === "post" || type === "vitrine") {
    return <PublishPost isVitrine={type === "vitrine"} />;
  }
  return <PublishProductForm />;
}

function PublishProductForm() {
  const { session, profile } = useAuth();
  const { t } = useApp();
  const { data: myShops = [], isLoading: loadingShops } = useMyShops();
  const publishProduct = usePublishProduct();

  const [shopId, setShopId] = useState<string>("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("mode");
  const [condition, setCondition] = useState<"Neuf" | "Occasion">("Neuf");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);

  const activeShop = shopId || myShops[0]?.id || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price) return toast.error(t("publier_nameAndPriceRequired"));
    if (!activeShop) return toast.error(t("publier_needShopError"));
    setSubmitting(true);
    try {
      let images: string[] = [];
      if (photos.length && session) {
        images = await uploadImages(
          "product-images",
          session.user.id,
          photos.map((p) => p.file),
        );
      }
      await publishProduct.mutateAsync({
        shop_id: activeShop,
        name,
        description: desc,
        price_xaf: Number(price) || 0,
        category: cat,
        condition,
        images,
      });
      hapticSuccess();
      toast.success(t("publier_publishedTitle"));
      setPublished(true);
    } catch (err: any) {
      toast.error(t("publier_publishedTitle"), { description: err.message ?? t("produit_insufficientPepites") });
    } finally {
      setSubmitting(false);
    }
  }

  if (!loadingShops && myShops.length === 0) {
    return (
      <AppShell>
        <div className="space-y-4 p-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full gold-gradient text-2xl">🏪</div>
          <h1 className="text-lg font-bold">{t("publier_needShopTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("publier_needShopDesc")}</p>
          <Link to="/creer-boutique" className="block rounded-xl gold-gradient py-3 text-sm font-bold">
            {t("publier_createShop")}
          </Link>
        </div>
      </AppShell>
    );
  }

  if (published) {
    return (
      <AppShell>
        <div className="space-y-4 p-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full gold-gradient text-2xl">✓</div>
          <h1 className="text-xl font-bold">{t("publier_publishedTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("publier_publishedDesc")}</p>
          <Link to="/" className="block rounded-xl border border-border bg-card py-3 text-sm font-semibold">
            {t("publier_backToMarche")}
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
        <h1 className="text-lg font-bold">{t("publier_title")}</h1>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4">
        {myShops.length > 1 && (
          <Field label={t("publier_shop")}>
            <select value={activeShop} onChange={(e) => setShopId(e.target.value)} className="input">
              {myShops.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t("publier_photos")}>
          <PhotoPicker photos={photos} onChange={setPhotos} />
        </Field>

        <Field label={t("creerBoutique_productName")}>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={t("creerBoutique_productNamePlaceholder")} />
        </Field>
        <Field label={t("creerBoutique_price")}>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="input" placeholder="18500" />
        </Field>
        <Field label={t("creerBoutique_description")}>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="input" placeholder="..." />
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
        <Field label={t("creerBoutique_condition")}>
          <div className="flex gap-2">
            {(["Neuf", "Occasion"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCondition(c)}
                className={cn("flex-1 rounded-xl border py-2.5 text-sm font-semibold", condition === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("publier_cost")}</span>
            <span className="inline-flex items-center gap-1 font-bold text-primary">
              {COST} <Pepite size={14} />
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("publier_currentBalance")}</span>
            <span className="inline-flex items-center gap-1 font-semibold">
              {profile?.pepites_balance ?? 0} <Pepite size={12} />
            </span>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3.5 text-sm font-bold disabled:opacity-60">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {t("publier_publish")}
        </button>
      </form>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-border);background:var(--color-card);padding:0.65rem 0.85rem;font-size:0.9rem;outline:none;color:var(--color-foreground)}
      .input:focus{border-color:var(--color-primary)}`}</style>
    </AppShell>
  );
}

function PublishPost({ isVitrine }: { isVitrine: boolean }) {
  const { session } = useAuth();
  const { t } = useApp();
  const createPost = useCreatePost();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const compressed = await compressImage(f);
    setFile(compressed);
    setPreview(URL.createObjectURL(compressed));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return toast.error(t("publier_textRequired"));
    setSubmitting(true);
    try {
      let image_url: string | undefined;
      if (file && session) {
        image_url = await uploadImage("post-images", session.user.id, file);
      }
      await createPost.mutateAsync({ text, image_url });
      setPublished(true);
      hapticSuccess();
      toast.success(t("publier_postPublished"));
    } catch (err: any) {
      toast.error(t("publier_publishedTitle"), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (published) {
    return (
      <AppShell>
        <div className="space-y-4 p-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full gold-gradient text-2xl">✓</div>
          <h1 className="text-xl font-bold">{t("publier_postPublished")}</h1>
          <p className="text-sm text-muted-foreground">{t("publier_postPublishedDesc")}</p>
          <Link to="/" className="block rounded-xl border border-border bg-card py-3 text-sm font-semibold">
            {t("publier_backToMarche")}
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
        <h1 className="text-lg font-bold">{isVitrine ? t("publier_vitrineTitle") : t("publier_postTitle")}</h1>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4">
        <label className="grid aspect-[16/10] w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card text-muted-foreground">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="text-center">
              <Sparkles size={26} className="mx-auto" />
              <p className="mt-1 text-xs font-medium">{t("publier_addImageOptional")}</p>
            </div>
          )}
          <input type="file" accept="image/*" onChange={onFile} className="hidden" />
        </label>

        <Field label={t("publier_yourMessage")}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="input" placeholder={t("publier_messagePlaceholder")} />
        </Field>

        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3.5 text-sm font-bold disabled:opacity-60">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {t("publier_publishFree")}
        </button>
      </form>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-border);background:var(--color-card);padding:0.65rem 0.85rem;font-size:0.9rem;outline:none;color:var(--color-foreground)}`}</style>
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
