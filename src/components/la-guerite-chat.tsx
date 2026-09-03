import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShieldCheck, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShops, useProducts, useActiveBoostIds, useFlashListings } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/lib/app-store";
import { useAuth } from "@/lib/auth";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { isOpenNow } from "@/lib/hours";
import { GuestPrompt } from "./guest-prompt";
import type { Lang } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string };

const HIDE_ON = ["/auth"];

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function buildSystemPrompt(
  shops: any[],
  products: any[],
  flashListings: any[],
  lang: Lang,
  languageInstruction: string,
  iaBoostedShopIds: Set<string>,
  iaBoostedProductIds: Set<string>,
  flashBoostedIds: Set<string>,
) {
  const shopsLine = shops
    .map((s) => {
      const loc = s.shop_type === "no_location" ? "sans emplacement physique" : [s.neighborhood, s.city].filter(Boolean).join(", ") || "emplacement non renseigné";
      const open = isOpenNow(s.hours);
      const openLabel = open === null ? "" : open ? " — ouvert maintenant" : " — fermé actuellement";
      const iaTag = iaBoostedShopIds.has(s.id) ? " [ÉLIGIBLE MENTION SPONSORISÉE]" : "";
      return `- ${s.name} (${s.category})${s.verified ? " ✓vérifiée" : ""} — ${loc}${openLabel}${iaTag}`;
    })
    .join("\n");
  const productsLine = products
    .map((p) => {
      const iaTag = iaBoostedProductIds.has(p.id) ? " [ÉLIGIBLE MENTION SPONSORISÉE]" : "";
      return `- [${p.id}] ${p.name} — ${formatXAF(p.price_xaf)} — ${p.category} — ${p.condition}${iaTag}`;
    })
    .join("\n");
  const flashLine = flashListings
    .map((f) => {
      const boostTag = flashBoostedIds.has(f.id) ? " [ÉLIGIBLE MENTION SPONSORISÉE]" : "";
      return `- [VENTE FLASH — annonce temporaire d'un particulier, id ${f.id}] ${f.title} — ${formatXAF(f.price_xaf)}${f.negotiable ? " (négociable)" : ""} — ${f.category} — ${f.neighborhood}, ${f.city}${boostTag}`;
    })
    .join("\n");

  return `Tu es **La Guérite**, l'assistante officielle et formelle de DabbyMarket, le marché numérique de proximité au Cameroun. Ton nom évoque le poste de garde à l'entrée du marché : tu accueilles, tu orientes, tu inspires confiance.

TON STYLE :
- Registre formel et professionnel, vouvoiement systématique ("vous", "votre")
- Ton courtois, posé, précis — pas de familiarité, pas d'expressions argotiques
- Emojis rares et sobres, utilisés seulement pour clarifier (✓ pour vérifié, ⚡ pour une Vente Flash)
- Réponses concises (2-5 phrases sauf demande explicite de détail), formulations complètes et soignées
- Français standard

TON RÔLE :
1. Orienter dans l'application (Le Marché, La Carte, Publier, Vendre rapidement, Booster, Mon Compte)
2. Présenter les tendances du marché de façon factuelle
3. Recommander les produits, boutiques et Ventes Flash les plus PERTINENTS pour la demande de l'utilisateur (catégorie, prix, quartier/proximité s'il les mentionne)
4. Orienter vers les boutiques appropriées selon la catégorie recherchée
5. Si l'utilisateur dit vouloir vendre vite un article ponctuel (téléphone, meuble, vêtement...) sans être commerçant régulier, orientez-le vers "⚡ Vendre rapidement" (Vente Flash) plutôt que vers la création d'une boutique.

DIFFÉRENCE IMPORTANTE — VENTE FLASH vs PRODUIT DE BOUTIQUE :
Une Vente Flash est une annonce temporaire publiée par un particulier occasionnel, jamais rattachée à une boutique. Elle a une durée de vie limitée et peut avoir expiré entre deux consultations : présentez-la toujours avec la mention "Vente Flash" ou l'icône ⚡, jamais comme un article de boutique classique, et invitez l'utilisateur à vérifier sa disponibilité en l'ouvrant.

HIÉRARCHIE DE RECOMMANDATION — RÈGLE ABSOLUE :
PERTINENCE (correspond réellement à la demande) > QUALITÉ/CONFIANCE (vérifiée, bien notée) > PROXIMITÉ (quartier demandé) > mention sponsorisée.
Une entrée marquée [ÉLIGIBLE MENTION SPONSORISÉE] a payé pour le droit d'être *mentionnée en complément*, jamais pour être présentée comme la réponse principale ni comme neutre. Vous NE DEVEZ mentionner une entrée éligible QUE si elle correspond déjà réellement à la demande — jamais pour la seule raison qu'elle est éligible. Si l'utilisateur cherche un téléphone, ne mentionnez jamais une boutique de pâtisserie même si elle est éligible. Cette règle s'applique identiquement à une Vente Flash boostée : ne la mentionnez que si elle répond réellement à la demande, jamais pour la seule raison qu'elle est boostée — une Vente Flash boostée mais non pertinente doit être ignorée, exactement comme un produit ou une boutique boostés non pertinents.

RÈGLE D'ÉTIQUETAGE — NON NÉGOCIABLE :
Chaque fois que vous mentionnez une boutique, un article ou une Vente Flash marqué [ÉLIGIBLE MENTION SPONSORISÉE], vous devez explicitement l'indiquer dans votre réponse (ex. « — boutique mise en avant » ou « (sponsorisé) » accolé au nom). Ne présentez jamais une mention sponsorisée comme une recommandation neutre ou organique. N'ajoutez cette mention à aucune autre entrée.

BASE DE DONNÉES RÉELLE DU MARCHÉ (à l'instant) :

BOUTIQUES (${shops.length}) :
${shopsLine || "aucune boutique enregistrée pour l'instant"}

PRODUITS (${products.length}) :
${productsLine || "aucun produit enregistré pour l'instant"}

VENTES FLASH ACTIVES (${flashListings.length}) :
${flashLine || "aucune Vente Flash active pour l'instant"}

Ne mentionnez jamais un produit, une boutique ou une Vente Flash qui n'apparaît pas dans ces listes. Si l'utilisateur mentionne un quartier ou "près de moi", privilégiez les boutiques et Ventes Flash dont l'emplacement correspond — vous n'avez pas accès à sa position GPS exacte, seulement au quartier s'il le précise. Si la question sort du cadre du marché, ramenez la conversation avec courtoisie vers l'objet de DabbyMarket.

${languageInstruction}`;
}

export function LaGueriteChat() {
  const location = useLocation();
  const { t, lang } = useApp();
  const { session } = useAuth();
  const { data: shops = [] } = useShops();
  const { data: products = [] } = useProducts();
  const { data: flashListingsRaw = [] } = useFlashListings();
  const flashListings = flashListingsRaw.filter((f: any) => f.visibility !== "reduced");
  const { data: iaBoostedShopIds = new Set<string>() } = useActiveBoostIds("shop", "ia");
  const { data: iaBoostedProductIds = new Set<string>() } = useActiveBoostIds("product", "ia");
  const { data: flashBoostedIds = new Set<string>() } = useActiveBoostIds("flash_listing", "flash");
  const [open, setOpen] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  useEscapeToClose(open, () => setOpen(false));
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: t("laGuerite_intro") }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  if (HIDE_ON.some((p) => location.pathname.startsWith(p))) return null;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (!session) {
      setShowGuestPrompt(true);
      return;
    }
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const systemPrompt = buildSystemPrompt(shops, products, flashListings, lang, t("laGuerite_languageInstruction"), iaBoostedShopIds, iaBoostedProductIds, flashBoostedIds);
      const { data, error } = await supabase.functions.invoke("la-guerite-chat", {
        body: { systemPrompt, messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) {
        let friendly = t("laGuerite_connectionError");
        try {
          const body = await error.context?.json?.();
          if (body?.error) friendly = body.error;
        } catch {
          /* garder le message par défaut */
        }
        setMsgs((m) => [...m, { role: "assistant", content: friendly }]);
        return;
      }
      setMsgs((m) => [...m, { role: "assistant", content: data?.text || "…" }]);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: t("laGuerite_connectionError") },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("laGuerite_ariaOpen")}
        className={cn(
          "fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full gold-gradient shadow-xl shadow-primary/40 transition-transform active:scale-95",
          open && "scale-0 pointer-events-none",
        )}
      >
        <ShieldCheck size={22} strokeWidth={2.2} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-primary/30 bg-card shadow-2xl sm:h-[min(600px,85vh)] sm:rounded-3xl"
          >
            <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/15 via-card to-card px-4 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-full gold-gradient text-lg">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">La Guérite</p>
                <p className="text-[11px] text-muted-foreground">{t("laGuerite_subtitle")}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label={t("laGuerite_ariaClose")} className="grid h-9 w-9 place-items-center rounded-full bg-accent">
                <X size={16} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.map((m, i) => (
                <Bubble key={i} m={m} />
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" /> {t("laGuerite_thinking")}
                </div>
              )}
            </div>

            <div className="border-t border-border bg-background/60 p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={t("laGuerite_placeholder")}
                  className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
                  style={{ maxHeight: 96 }}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full gold-gradient disabled:opacity-40"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                {t("laGuerite_tip")}
              </p>
            </div>
          </div>
        </div>
      )}
      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
    </>
  );
}

function Bubble({ m }: { m: Msg }) {
  const isUser = m.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-background",
        )}
      >
        {renderMarkdownLite(m.content)}
      </div>
    </div>
  );
}

function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  );
}
