import { Link, useNavigate, useParams } from "react-router-dom";
import { SidebarNav } from "@/components/sidebar-nav";
import { BottomNav } from "@/components/bottom-nav";
import { ConversationListSkeleton, MessagesSkeleton } from "@/components/skeletons";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Send, CheckCircle2, ShieldAlert, Loader2, MessageCircle, X, Star } from "lucide-react";
import { VerifiedBadge } from "@/components/product-card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { useConversations, useMessages, useSendMessage, useConfirmOrderReceived, useAddReview, useMarkConversationRead } from "@/lib/queries";
import { hapticSuccess } from "@/lib/haptics";

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

export default function MessagesPage() {
  const { id } = useParams<{ id?: string }>();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] bg-background lg:justify-center">
      <SidebarNav />
      <div className="flex min-h-screen w-full flex-1 lg:max-w-4xl lg:border-x lg:border-border">
        <div className={cn("w-full lg:block lg:w-[360px] lg:shrink-0 lg:border-r lg:border-border", id && "hidden")}>
          <ConversationList activeId={id} />
          <div className="lg:hidden"><BottomNav /></div>
        </div>
        <div className={cn("w-full lg:flex lg:flex-1 lg:flex-col", !id && "hidden lg:flex")}>
          {id ? <Conversation id={id} /> : <EmptyDesktopState />}
        </div>
      </div>
    </div>
  );
}

function EmptyDesktopState() {
  const { t } = useApp();
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-3 text-muted-foreground lg:flex">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 shadow-inner">
        <MessageCircle size={30} className="text-primary" />
      </div>
      <p className="text-sm font-medium">{t("messages_selectConversation")}</p>
    </div>
  );
}

function ConversationList({ activeId }: { activeId?: string }) {
  const navigate = useNavigate();
  const { t, lang } = useApp();
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const { data: conversations = [], isLoading } = useConversations();

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/85 px-4 pt-4 pb-3 backdrop-blur-xl lg:pt-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg gold-gradient text-background shadow-md shadow-primary/20">
            <MessageCircle size={15} />
          </span>
          <h1 className="text-lg font-black tracking-tight">{t("messages_title")}</h1>
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-muted-foreground">
            {conversations.length}
          </span>
        </div>
      </div>
      {isLoading ? (
        <ConversationListSkeleton />
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-2xl shadow-inner">💬</div>
          <p className="text-sm text-muted-foreground">{t("messages_empty")}</p>
          <Link to="/" className="shine rounded-2xl gold-gradient px-5 py-2.5 text-sm font-black text-background shadow-lg shadow-primary/25">
            {t("messages_discoverCta")}
          </Link>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border/60 overflow-y-auto pb-24 lg:pb-4">
          {conversations.map((c: any) => {
            const shop = c.shops;
            const product = c.products;
            const active = activeId === c.id;
            return (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/messages/${c.id}`)}
                  className={cn(
                    "group relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all",
                    active ? "bg-gradient-to-r from-primary/15 to-transparent" : "hover:bg-accent/50",
                  )}
                >
                  {active && <span className="absolute left-0 top-0 h-full w-1 gold-gradient" />}
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-accent text-xl ring-2 ring-background shadow-sm">
                    {shop?.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{shop?.name ?? "—"}</span>
                      {shop?.verified && <VerifiedBadge />}
                    </div>
                    {product && (
                      <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-1.5 py-0.5">
                        <span className="max-w-[180px] truncate text-[10.5px] font-medium text-primary">{product.name}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Conversation({ id }: { id: string }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t, lang } = useApp();
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const { data: conversations = [] } = useConversations();
  const conv = conversations.find((c: any) => c.id === id);
  const { data: msgs = [], isLoading } = useMessages(id);
  const sendMessage = useSendMessage();
  const confirmReceived = useConfirmOrderReceived();
  const markRead = useMarkConversationRead();
  const [text, setText] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    if (id) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, msgs.length]);

  if (!conv) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mb-2 animate-spin text-primary" />
        {t("messages_loadingConversation")}
      </div>
    );
  }

  const shop = conv.shops;
  const product = conv.products;
  const isBuyer = session?.user.id === conv.buyer_id;

  function send() {
    if (!text.trim()) return;
    sendMessage.mutate({ conversationId: id, text });
    setText("");
  }

  function sendLocation() {
    if (!("geolocation" in navigator)) return toast.error(t("messages_locationUnavailable"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendMessage.mutate({ conversationId: id, sharedLat: pos.coords.latitude, sharedLng: pos.coords.longitude });
        toast.success(t("messages_locationSent"));
      },
      () => toast.error(t("messages_locationSendFailed")),
    );
  }

  async function handleConfirmReceived() {
    await confirmReceived.mutateAsync(id);
    hapticSuccess();
    toast.success(t("messages_confirmReceivedToast"));
  }

  return (
    <div className="flex h-screen flex-col bg-background lg:h-full">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur-xl">
        <button onClick={() => navigate("/messages")} className="group grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40 lg:hidden">
          <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
        </button>
        <div className="relative">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-accent text-lg ring-2 ring-primary/20">
            {shop?.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[color:var(--verified)] ring-2 ring-background" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black">{shop?.name ?? "—"}</span>
            {shop?.verified && <VerifiedBadge />}
          </div>
          <p className="text-[10px] font-medium text-[color:var(--verified)]">● En ligne</p>
        </div>
      </header>

      {product && (
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 to-transparent px-3 py-2">
          <div className="flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-background/70 px-2.5 py-2 shadow-sm backdrop-blur">
            {product.images?.[0] && <img src={product.images[0]} alt="" className="h-10 w-10 rounded-lg object-cover shadow-sm" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black">{product.name}</p>
              <p className="text-[11px] font-bold text-primary">{formatXAF(product.price_xaf)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-3 mt-3 flex items-center gap-2 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 to-transparent p-2.5 text-[11px] text-muted-foreground shadow-sm">
        <ShieldAlert size={14} className="shrink-0 text-primary" />
        <p>{t("messages_safetyTip")}</p>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {isLoading ? (
          <MessagesSkeleton />
        ) : (
          msgs.map((m: any) => {
            const mine = m.sender_id === session?.user.id;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    mine
                      ? "max-w-[75%] rounded-2xl rounded-br-md gold-gradient px-3.5 py-2.5 text-sm font-medium text-background shadow-md shadow-primary/15"
                      : "max-w-[75%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-sm shadow-sm"
                  }
                >
                  {m.shared_lat != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${m.shared_lat},${m.shared_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-black underline"
                    >
                      <MapPin size={14} /> {t("messages_locationShared")}
                    </a>
                  ) : (
                    m.text
                  )}
                  <div className={cn("mt-1 text-[10px] font-medium", mine ? "text-background/70" : "text-muted-foreground")}>
                    {new Date(m.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isBuyer && conv.order_confirmed && !reviewOpen && (
          <div className="mx-auto max-w-sm rounded-2xl border border-[color:var(--verified)]/40 bg-gradient-to-br from-[color:var(--verified)]/10 via-card to-card p-4 text-center shadow-md">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--verified)] shadow-md">
              <CheckCircle2 size={18} className="text-background" />
            </div>
            <p className="mt-2 text-xs font-black text-[color:var(--verified)]">{t("messages_orderReceivedTitle")}</p>
            <button
              onClick={() => setReviewOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--verified)] px-4 py-2 text-xs font-black text-background shadow-md transition-transform hover:scale-105"
            >
              <Star size={12} /> {t("messages_leaveReview")}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-border/60 bg-background/95 p-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl lg:pb-2.5">
        {isBuyer && !conv.order_confirmed && (
          <button
            onClick={handleConfirmReceived}
            className="mb-2 w-full rounded-xl border-2 border-primary/40 bg-primary/10 py-2 text-xs font-black text-primary transition-all hover:bg-primary hover:text-primary-foreground"
          >
            <CheckCircle2 size={13} className="mr-1 inline" /> {t("messages_confirmReceived")}
          </button>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={sendLocation}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40 hover:text-primary"
            aria-label={t("messages_shareLocation")}
          >
            <MapPin size={17} />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("messages_writeMessage")}
            className="flex-1 rounded-full border-2 border-border bg-card px-4 py-2.5 text-sm font-medium outline-none transition-all focus:border-primary focus:shadow-lg focus:shadow-primary/10"
          />
          <button
            onClick={send}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full gold-gradient text-background shadow-md shadow-primary/20 transition-transform hover:scale-105 active:scale-95"
            aria-label={t("common_send")}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {reviewOpen && shop && (
        <ReviewModal
          shopId={shop.id}
          shopName={shop.name}
          conversationId={id}
          onClose={() => setReviewOpen(false)}
          onSubmitted={() => { setReviewOpen(false); navigate(`/boutique/${shop.id}`); }}
        />
      )}
    </div>
  );
}

function ReviewModal({
  shopId, shopName, conversationId, onClose, onSubmitted,
}: {
  shopId: string; shopName: string; conversationId: string;
  onClose: () => void; onSubmitted: () => void;
}) {
  const { t } = useApp();
  const addReview = useAddReview();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEscapeToClose(true, onClose);

  async function submit() {
    setSubmitting(true);
    try {
      await addReview.mutateAsync({ shopId, conversationId, rating, comment });
      hapticSuccess();
      toast.success(t("messages_reviewPublished"));
      onSubmitted();
    } catch (err: any) {
      toast.error(t("messages_reviewFailed"), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-background/70 backdrop-blur-md sm:place-items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl"
      >
        <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative mb-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">Votre avis</p>
            <h2 className="text-base font-black">{shopName}</h2>
          </div>
          <button onClick={onClose} aria-label={t("common_close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:border-primary/30">
            <X size={14} />
          </button>
        </div>

        <div className="relative mt-3 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="text-4xl transition-transform hover:scale-125">
              <span className={n <= rating ? "text-primary drop-shadow-[0_2px_6px_rgba(212,175,55,0.5)]" : "text-muted-foreground/30"}>★</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs font-bold text-muted-foreground">
          {rating === 5 ? "✨ Excellent" : rating === 4 ? "😊 Très bien" : rating === 3 ? "🙂 Correct" : rating === 2 ? "😕 Passable" : "😞 Insatisfaisant"}
        </p>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t("messages_reviewPlaceholder")}
          className="relative mt-4 w-full rounded-2xl border-2 border-border bg-background p-3 text-sm outline-none transition-all focus:border-primary focus:shadow-lg focus:shadow-primary/10"
        />
        <div className="relative mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border-2 border-border bg-background py-3 text-sm font-black transition-all hover:border-primary/40">
            {t("common_cancel")}
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="shine flex-1 rounded-2xl gold-gradient py-3 text-sm font-black text-background shadow-lg shadow-primary/25 disabled:opacity-60"
          >
            {t("common_send")}
          </button>
        </div>
      </div>
    </div>
  );
}
