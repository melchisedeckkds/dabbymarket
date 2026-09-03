import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import {
  useFlashListing,
  useMarkFlashStatus,
  useExtendFlashListing,
  useStartConversation,
  useSendMessage,
  useAppConfig,
  useRecordView,
  useViewsCount,
} from "@/lib/queries";
import { useApp } from "@/lib/app-store";
import { ReportDialog } from "@/components/report-dialog";
import { BoostPicker } from "@/components/boost-picker";
import { GuestPrompt } from "@/components/guest-prompt";
import { Pepite } from "@/components/pepite";
import { FLASH_DURATIONS, FLASH_CONDITION_LABEL_KEYS, formatFlashRemaining, type FlashCondition } from "@/lib/flash";
import { ArrowLeft, Flag, MapPin, MessageCircle, Eye, Zap, Loader2, CheckCircle2, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatXAF(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

export default function FlashListingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t } = useApp();
  const { data: listing, isLoading } = useFlashListing(id);
  const { data: config } = useAppConfig();
  const markStatus = useMarkFlashStatus();
  const extend = useExtendFlashListing();
  const startConversation = useStartConversation();
  const sendMessage = useSendMessage();
  useRecordView("flash_listing", listing?.status === "active" ? id : undefined);
  const { data: viewsCount = 0 } = useViewsCount("flash_listing", id);

  const [activePhoto, setActivePhoto] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [showBoost, setShowBoost] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [contacting, setContacting] = useState(false);

  if (isLoading) {
    return (
      <AppShell>
        <div className="grid h-64 place-items-center">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!listing || (listing.status !== "active" && session?.user.id !== listing.seller_id)) {
    return (
      <AppShell>
        <div className="space-y-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("flash_notFound")}</p>
          <Link to="/" className="inline-block rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold">
            {t("flash_backToMarche")}
          </Link>
        </div>
      </AppShell>
    );
  }

  const isOwner = session?.user.id === listing.seller_id;
  const seller = (listing as any).profiles;
  const photos: string[] = listing.images ?? [];

  async function handleContact() {
    if (!session) return setShowGuestPrompt(true);
    if (isOwner) return;
    setContacting(true);
    try {
      const conv = await startConversation.mutateAsync({ sellerId: listing!.seller_id });
      await sendMessage.mutateAsync({
        conversationId: conv.id,
        text: `⚡ ${t("flash_title")} — ${listing!.title} (${formatXAF(listing!.price_xaf)}) : ${window.location.origin}/flash/${listing!.id}`,
      });
      navigate(`/messages/${conv.id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setContacting(false);
    }
  }

  async function handleMarkStatus(status: "sold" | "removed") {
    try {
      await markStatus.mutateAsync({ flashId: listing!.id, status });
      toast.success(status === "sold" ? t("flash_soldToast") : t("flash_removedToast"));
    } catch (err: any) {
      toast.error(t("flash_actionFailed"), { description: err.message });
    }
  }

  async function handleExtend(hours: number) {
    try {
      await extend.mutateAsync({ flashId: listing!.id, extraHours: hours });
      toast.success(t("flash_extendedToast"));
    } catch (err: any) {
      toast.error(t("flash_actionFailed"), { description: err.message });
    }
  }

  const remaining = formatFlashRemaining(listing.expires_at, {
    expired: t("flash_expired"),
    hoursLeft: (n) => `${n} ${t("flash_hoursLeft")}`,
    daysLeft: (n) => `${n} ${t("flash_daysLeft")}`,
  });

  const statusLabel: Record<string, string> = {
    sold: t("flash_statusSold"),
    removed: t("flash_statusRemoved"),
    expired: t("flash_statusExpired"),
    suspended: t("flash_statusSuspended"),
  };

  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-card">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="flex items-center gap-1.5 text-lg font-bold">
          <Zap size={16} className="text-primary" /> {t("flash_title")}
        </h1>
        {!isOwner && (
          <button
            onClick={() => (session ? setShowReport(true) : setShowGuestPrompt(true))}
            aria-label={t("report_title")}
            className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-card text-muted-foreground"
          >
            <Flag size={16} />
          </button>
        )}
      </div>

      <div className="p-4">
        {listing.status !== "active" && (
          <div className="mb-3 rounded-xl border border-border bg-accent px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
            {statusLabel[listing.status] ?? listing.status}
          </div>
        )}

        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-accent">
          {photos[activePhoto] ? (
            <img src={photos[activePhoto]} alt={listing.title} className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-4xl">⚡</span>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
            ⚡ {t("flash_title")}
          </span>
        </div>
        {photos.length > 1 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            {photos.map((p, i) => (
              <button
                key={p}
                onClick={() => setActivePhoto(i)}
                className={cn("h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2", activePhoto === i ? "border-primary" : "border-transparent")}
              >
                <img src={p} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold">{listing.title}</h2>
          <span className="shrink-0 text-lg font-bold text-primary">{formatXAF(listing.price_xaf)}</span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {listing.negotiable && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold">{t("flash_negotiablePill")}</span>
          )}
          {listing.condition && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold">
              {t(FLASH_CONDITION_LABEL_KEYS[listing.condition as FlashCondition] ?? "flash_conditionGood")}
            </span>
          )}
          {listing.status === "active" && (
            <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <Clock size={11} /> {t("flash_expiresIn")} {remaining}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin size={13} /> {listing.neighborhood}, {listing.city}
          {listing.landmark ? ` — ${listing.landmark}` : ""}
          <span className="ml-auto flex items-center gap-1"><Eye size={12} /> {viewsCount}</span>
        </div>

        {listing.description && <p className="mt-3 text-sm text-foreground/90">{listing.description}</p>}

        <Link to={`/profil/${listing.seller_id}`} className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-lg">
            {seller?.avatar_url ? <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">{t("flash_seller")}</p>
            <p className="truncate text-sm font-semibold">{seller?.name ?? "—"}</p>
          </div>
        </Link>

        {!isOwner ? (
          <button
            onClick={handleContact}
            disabled={contacting || listing.status !== "active"}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3.5 text-sm font-bold disabled:opacity-60"
          >
            {contacting ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
            {t("flash_contact")}
          </button>
        ) : (
          <div className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("flash_manage")}</p>

            {listing.status === "active" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleMarkStatus("sold")} className="flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--verified)] py-2.5 text-xs font-bold text-background">
                    <CheckCircle2 size={14} /> {t("flash_markSold")}
                  </button>
                  <button onClick={() => handleMarkStatus("removed")} className="flex items-center justify-center gap-1.5 rounded-xl border border-destructive py-2.5 text-xs font-bold text-destructive">
                    <Trash2 size={14} /> {t("flash_remove")}
                  </button>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t("flash_extendTitle")}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {FLASH_DURATIONS.map((d) => (
                      <button
                        key={d.hours}
                        onClick={() => handleExtend(d.hours)}
                        disabled={extend.isPending}
                        className="rounded-xl border border-border bg-background p-2 text-center disabled:opacity-50"
                      >
                        <p className="text-[11px] font-semibold">{t(d.labelKey)}</p>
                        <p className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-primary">
                          <Pepite size={10} /> {Number(config?.[d.configKey] ?? 0)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowBoost(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl gold-gradient shine py-2.5 text-xs font-bold"
                >
                  <Zap size={13} /> {t("flash_boost")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!isOwner && listing && (
        <ReportDialog open={showReport} onClose={() => setShowReport(false)} targetType="flash_listing" targetId={listing.id} />
      )}
      {isOwner && listing && (
        <BoostPicker open={showBoost} onClose={() => setShowBoost(false)} targetType="flash_listing" targetId={listing.id} />
      )}
      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
    </AppShell>
  );
}
