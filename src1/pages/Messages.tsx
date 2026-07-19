import { Link, useNavigate, useParams } from "react-router-dom";
import { SidebarNav } from "@/components/sidebar-nav";
import { BottomNav } from "@/components/bottom-nav";
import { ConversationListSkeleton, MessagesSkeleton } from "@/components/skeletons";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Send, CheckCircle2, ShieldAlert, Loader2, MessageCircle, X } from "lucide-react";
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
        <div className={cn("w-full lg:block lg:w-[340px] lg:shrink-0 lg:border-r lg:border-border", id && "hidden")}>
          <ConversationList activeId={id} />
          <div className="lg:hidden">
            <BottomNav />
          </div>
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
    <div className="hidden h-full flex-col items-center justify-center gap-2 text-muted-foreground lg:flex">
      <MessageCircle size={36} />
      <p className="text-sm">{t("messages_selectConversation")}</p>
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
      <div className="px-4 pt-4 lg:pt-5">
        <h1 className="text-lg font-bold">{t("messages_title")}</h1>
      </div>
      {isLoading ? (
        <ConversationListSkeleton />
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl">💬</div>
          <p className="text-sm text-muted-foreground">{t("messages_empty")}</p>
          <Link to="/" className="rounded-xl gold-gradient px-4 py-2.5 text-sm font-bold shine">
            {t("messages_discoverCta")}
          </Link>
        </div>
      ) : (
        <ul className="mt-2 flex-1 divide-y divide-border overflow-y-auto pb-24 lg:pb-4">
          {conversations.map((c: any) => {
            const shop = c.shops;
            const product = c.products;
            return (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/messages/${c.id}`)}
                  className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40", activeId === c.id && "bg-primary/10")}
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xl">
                    {shop?.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{shop?.name ?? "—"}</span>
                      {shop?.verified && <VerifiedBadge />}
                    </div>
                    {product && (
                      <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-accent px-1.5 py-0.5">
                        <span className="max-w-[180px] truncate text-[10.5px] text-muted-foreground">{product.name}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString(locale)}</span>
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
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur">
        <button onClick={() => navigate("/messages")} className="grid h-9 w-9 place-items-center rounded-full bg-card lg:hidden">
          <ArrowLeft size={18} />
        </button>
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-lg">
          {shop?.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{shop?.name ?? "—"}</span>
            {shop?.verified && <VerifiedBadge />}
          </div>
        </div>
      </header>

      {product && (
        <div className="border-b border-border bg-card px-3 py-2">
          <div className="flex items-center gap-2 rounded-xl bg-background px-2 py-1.5">
            {product.images?.[0] && <img src={product.images[0]} alt="" className="h-8 w-8 rounded-md object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{product.name}</p>
              <p className="text-[11px] text-primary">{formatXAF(product.price_xaf)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-accent/60 p-2 text-[11px] text-muted-foreground">
        <ShieldAlert size={14} className="shrink-0 text-primary" />
        <p>{t("messages_safetyTip")}</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading ? (
          <MessagesSkeleton />
        ) : (
          msgs.map((m: any) => {
            const mine = m.sender_id === session?.user.id;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div className={mine ? "max-w-[75%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-[75%] rounded-2xl rounded-bl-md bg-card px-3 py-2 text-sm"}>
                  {m.shared_lat != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${m.shared_lat},${m.shared_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 underline"
                    >
                      <MapPin size={14} /> {t("messages_locationShared")}
                    </a>
                  ) : (
                    m.text
                  )}
                  <div className={mine ? "mt-0.5 text-[10px] text-primary-foreground/70" : "mt-0.5 text-[10px] text-muted-foreground"}>
                    {new Date(m.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isBuyer && conv.order_confirmed && !reviewOpen && (
          <div className="mx-auto max-w-sm rounded-xl border border-[color:var(--verified)]/40 bg-[color:var(--verified)]/10 p-3 text-center text-xs text-[color:var(--verified)]">
            <CheckCircle2 size={16} className="mx-auto" />
            <p className="mt-1 font-semibold">{t("messages_orderReceivedTitle")}</p>
            <button onClick={() => setReviewOpen(true)} className="mt-2 rounded-lg bg-[color:var(--verified)] px-3 py-1.5 text-xs font-semibold text-background">
              {t("messages_leaveReview")}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:pb-2">
        {isBuyer && !conv.order_confirmed && (
          <button onClick={handleConfirmReceived} className="mb-2 w-full rounded-xl border border-primary/40 bg-primary/10 py-2 text-xs font-semibold text-primary">
            {t("messages_confirmReceived")}
          </button>
        )}
        <div className="flex items-center gap-2">
          <button onClick={sendLocation} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card" aria-label={t("messages_shareLocation")}>
            <MapPin size={18} />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("messages_writeMessage")}
            className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <button onClick={send} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-label={t("common_send")}>
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
          onSubmitted={() => {
            setReviewOpen(false);
            navigate(`/boutique/${shop.id}`);
          }}
        />
      )}
    </div>
  );
}

function ReviewModal({
  shopId,
  shopName,
  conversationId,
  onClose,
  onSubmitted,
}: {
  shopId: string;
  shopName: string;
  conversationId: string;
  onClose: () => void;
  onSubmitted: () => void;
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
    <div className="fixed inset-0 z-50 grid place-items-end bg-background/70 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-bold">{t("messages_reviewFor")} {shopName}</h2>
          <button onClick={onClose} aria-label={t("common_close")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent">
            <X size={14} />
          </button>
        </div>
        <div className="mt-3 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="text-3xl">
              <span className={n <= rating ? "text-primary" : "text-muted-foreground/40"}>★</span>
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t("messages_reviewPlaceholder")}
          className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none"
        />
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold">
            {t("common_cancel")}
          </button>
          <button onClick={submit} disabled={submitting} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {t("common_send")}
          </button>
        </div>
      </div>
    </div>
  );
}
