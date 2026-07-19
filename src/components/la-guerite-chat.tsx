import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShieldCheck, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShops, useProducts } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/lib/app-store";
import { useAuth } from "@/lib/auth";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { GuestPrompt } from "./guest-prompt";
import type { Lang } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string };

const HIDE_ON = ["/auth"];

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function buildSystemPrompt(shops: any[], products: any[], lang: Lang, languageInstruction: string) {
  const now = Date.now();
  const boosted = products.filter((p) => p.boosted_until && new Date(p.boosted_until).getTime() > now);

  const shopsLine = shops.map((s) => `- ${s.name} (${s.category})${s.verified ? " ✓" : ""}`).join("\n");
  const productsLine = products
    .map(
      (p) =>
        `- [${p.id}] ${p.name} — ${formatXAF(p.price_xaf)} — ${p.category} — ${p.condition}${boosted.some((b) => b.id === p.id) ? " ⚡BOOSTÉ" : ""}`,
    )
    .join("\n");

  return `Tu es **La Guérite**, l'assistante officielle et formelle de DabbyMarket, le marché numérique de proximité au Cameroun. Ton nom évoque le poste de garde à l'entrée du marché : tu accueilles, tu orientes, tu inspires confiance.

TON STYLE :
- Registre formel et professionnel, vouvoiement systématique ("vous", "votre")
- Ton courtois, posé, précis — pas de familiarité, pas d'expressions argotiques
- Emojis rares et sobres, utilisés seulement pour clarifier (⚡ pour un boost, ✓ pour vérifié)
- Réponses concises (2-5 phrases sauf demande explicite de détail), formulations complètes et soignées
- Français standard

TON RÔLE :
1. Orienter dans l'application (Le Marché, La Carte, Publier, Booster, Mon Compte)
2. Présenter les tendances du marché de façon factuelle
3. Recommander en priorité les produits signalés BOOSTÉS — mise en avant financée par les vendeurs
4. Ensuite, proposer les produits les plus pertinents pour la demande formulée
5. Orienter vers les boutiques appropriées selon la catégorie recherchée

BASE DE DONNÉES RÉELLE DU MARCHÉ (à l'instant) :

BOUTIQUES (${shops.length}) :
${shopsLine || "aucune boutique enregistrée pour l'instant"}

PRODUITS (${products.length}) :
${productsLine || "aucun produit enregistré pour l'instant"}

PRODUITS ACTUELLEMENT BOOSTÉS : ${boosted.length ? boosted.map((p) => p.name).join(", ") : "aucun pour l'instant — vous pouvez suggérer poliment à l'utilisateur de booster son produit pour gagner en visibilité"}

Ne mentionnez jamais un produit ou une boutique qui n'apparaît pas dans cette liste. Si la question sort du cadre du marché, ramenez la conversation avec courtoisie vers l'objet de DabbyMarket.

${languageInstruction}`;
}

export function LaGueriteChat() {
  const location = useLocation();
  const { t, lang } = useApp();
  const { session } = useAuth();
  const { data: shops = [] } = useShops();
  const { data: products = [] } = useProducts();
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
      const systemPrompt = buildSystemPrompt(shops, products, lang, t("laGuerite_languageInstruction"));
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
