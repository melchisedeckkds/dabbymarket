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
import { ArrowLeft, Sparkles, Loader2, Store, Check, Wallet, Send, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const COST = 15;

export default function PublierPage() {
  const [params] = useSearchParams();
  const type = params.get("type");
  if (type === "post" || type === "vitrine") return <PublishPost isVitrine={type === "vitrine"} />;
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
  const balance = profile?.pepites_balance ?? 0;
  const canAfford = balance >= COST;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price) return toast.error(t("publier_nameAndPriceRequired"));
    if (!activeShop) return toast.error(t("publier_needShopError"));
    setSubmitting(true);
    try {
      let images: string[] = [];
      if (photos.length && session) {
        images = await uploadImages("product-images", session.user.id, photos.map((p) => p.file));
      }
      await publishProduct.mutateAsync({
        shop_id: activeShop, name, description: desc,
        price_xaf: Number(price) || 0, category: cat, condition, images,
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
        <div className="p-6">
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-8 text-center shadow-lg">
            <span className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
            <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl gold-gradient text-3xl shadow-xl shadow-primary/25">
              🏪
            </div>
            <h1 className="relative mt-4 text-lg font-black">{t("publier_needShopTitle")}</h1>
            <p className="relative mt-1 text-sm text-muted-foreground">{t("publier_needShopDesc")}</p>
            <Link to="/creer-boutique" className="shine relative mt-5 inline-flex items-center gap-2 rounded-2xl gold-gradient px-5 py-3 text-sm font-black text-background shadow-lg shadow-primary/25">
              <Store size={15} /> {t("publier_createShop")}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (published) {
    return (
      <AppShell>
        <div className="p-4">
          <div className="relative overflow-hidden rounded-3xl border border-[color:var(--verified)]/40 bg-gradient-to-br from-[color:var(--verified)]/10 via-card to-card p-8 text-center shadow-lg">
            <span className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[color:var(--verified)]/25 blur-2xl" />
            <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--verified)] shadow-xl shadow-[color:var(--verified)]/30">
              <Check size={28} className="text-background" />
            </div>
            <h1 className="relative mt-4 text-xl font-black">{t("publier_publishedTitle")}</h1>
            <p className="relative mt-1 text-sm text-muted-foreground">{t("publier_publishedDesc")}</p>
            <Link to="/" className="relative mt-5 block rounded-2xl border-2 border-border bg-card py-3 text-sm font-black transition-all hover:border-primary/40">
              {t("publier_backToMarche")}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/" className="group grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40">
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/80">Nouveau produit</span>
            </div>
            <h1 className="truncate text-base font-black">{t("publier_title")}</h1>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4">
        {myShops.length > 1 && (
          <Field label={t("publier_shop")}>
            <select value={activeShop} onChange={(e) => setShopId(e.target.value)} className="input">
              {myShops.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
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
          <div className="relative">
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="input pr-16" placeholder="18500" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-muted-foreground">FCFA</span>
          </div>
        </Field>
        <Field label={t("creerBoutique_description")}>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="input" placeholder="..." />
        </Field>
        <Field label={t("creerBoutique_category")}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{t(c.key)}</option>
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
                className={cn(
                  "flex-1 rounded-2xl border-2 py-3 text-sm font-black transition-all active:scale-[0.98]",
                  condition === c
                    ? "border-primary bg-primary/15 text-primary shadow-md shadow-primary/10"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        {/* Coût premium */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-md">
          <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/15 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl gold-gradient shadow-md shadow-primary/20">
                <Wallet size={16} className="text-background" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t("publier_cost")}</p>
                <p className="text-lg font-black text-primary">{COST} <span className="text-sm font-bold text-muted-foreground">{t("pepites")}</span></p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t("publier_currentBalance")}</p>
              <p className={cn("inline-flex items-center gap-1 text-base font-black", canAfford ? "text-foreground" : "text-destructive")}>
                {balance} <Pepite size={13} />
              </p>
            </div>
          </div>
          {!canAfford && (
            <Link to="/recharge" className="relative mt-3 block rounded-xl border border-primary/40 bg-primary/10 py-2 text-center text-[11px] font-black text-primary transition-all hover:bg-primary hover:text-primary-foreground">
              Recharger mes Pépites →
            </Link>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="shine flex w-full items-center justify-center gap-2 rounded-2xl gold-gradient py-4 text-sm font-black text-background shadow-xl shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          {t("publier_publish")}
        </button>
      </form>

      <style>{`.input{width:100%;border-radius:0.85rem;border:2px solid var(--color-border);background:var(--color-card);padding:0.75rem 0.9rem;font-size:0.9rem;outline:none;color:var(--color-foreground);transition:all .2s}
      .input:focus{border-color:var(--color-primary);box-shadow:0 0 0 4px color-mix(in oklab,var(--color-primary) 12%,transparent)}`}</style>
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
      if (file && session) image_url = await uploadImage("post-images", session.user.id, file);
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
        <div className="p-4">
          <div className="relative overflow-hidden rounded-3xl border border-[color:var(--verified)]/40 bg-gradient-to-br from-[color:var(--verified)]/10 via-card to-card p-8 text-center shadow-lg">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--verified)] shadow-xl shadow-[color:var(--verified)]/30">
              <Check size={28} className="text-background" />
            </div>
            <h1 className="mt-4 text-xl font-black">{t("publier_postPublished")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("publier_postPublishedDesc")}</p>
            <Link to="/" className="mt-5 block rounded-2xl border-2 border-border bg-card py-3 text-sm font-black transition-all hover:border-primary/40">
              {t("publier_backToMarche")}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/" className="group grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/80">Publication</span>
            </div>
            <h1 className="truncate text-base font-black">{isVitrine ? t("publier_vitrineTitle") : t("publier_postTitle")}</h1>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4">
        <label className="group grid aspect-[16/10] w-full cursor-pointer place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-gradient-to-br from-card to-accent/30 text-muted-foreground transition-all hover:border-primary/50 hover:shadow-lg">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 shadow-inner transition-all group-hover:bg-primary/20 group-hover:scale-110">
                <ImagePlus size={26} className="text-primary" />
              </div>
              <p className="mt-3 text-xs font-black">{t("publier_addImageOptional")}</p>
            </div>
          )}
          <input type="file" accept="image/*" onChange={onFile} className="hidden" />
        </label>

        <Field label={t("publier_yourMessage")}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="input" placeholder={t("publier_messagePlaceholder")} />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="shine flex w-full items-center justify-center gap-2 rounded-2xl gold-gradient py-4 text-sm font-black text-background shadow-xl shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          {t("publier_publishFree")}
        </button>
      </form>

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
