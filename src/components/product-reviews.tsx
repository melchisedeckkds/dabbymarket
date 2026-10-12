import { useMemo, useState } from "react";
import { Star, Flag, BadgeCheck, Loader2, Trash2, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { useDt } from "@/lib/availability-i18n";
import {
  useProductReviews, useProductRatingStats, useCatalogRating, useSubmitReview, useDeleteMyReview, useReplyToReview, type ProductReview,
} from "@/lib/availability-queries";
import { GuestPrompt } from "./guest-prompt";
import { ReportDialog } from "./report-dialog";
import { cn } from "@/lib/utils";

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} className={i < Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground"} />
      ))}
    </span>
  );
}

/**
 * Avis par article. Trois indicateurs DISTINCTS, jamais confondus :
 *  - la note de l'offre dans CETTE boutique (avis ci-dessous),
 *  - la note du produit de référence en général (toutes boutiques),
 *  - la réputation de la boutique (avis boutique existants, ailleurs).
 */
export function ProductReviews({ product }: { product: { id: string; shop_id: string; catalog_item_id?: string | null; shops?: { owner_id: string } | null } }) {
  const dt = useDt();
  const { lang } = useApp();
  const { session } = useAuth();
  const { data: reviews = [], isLoading } = useProductReviews(product.id);
  const { data: stats } = useProductRatingStats(product.id);
  const { data: catalogStats } = useCatalogRating(product.catalog_item_id);
  const submit = useSubmitReview();
  const del = useDeleteMyReview();
  const reply = useReplyToReview();
  const isOwner = !!session && product.shops?.owner_id === session.user.id;
  const mine = useMemo(() => reviews.find((r) => r.user_id === session?.user?.id), [reviews, session?.user?.id]);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [guest, setGuest] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const visible = reviews.filter((r) => r.status === "visible");

  function startEdit() {
    if (!session) return setGuest(true);
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? "");
    setEditing(true);
  }

  async function send() {
    if (rating < 1) return toast.error(dt("rv_pickRating"));
    try {
      await submit.mutateAsync({ productId: product.id, rating, comment });
      toast.success(dt("rv_published"));
      setEditing(false);
    } catch (e: any) {
      toast.error(dt("c_error"), { description: e.message });
    }
  }

  async function sendReply(r: ProductReview) {
    try {
      await reply.mutateAsync({ reviewId: r.id, productId: product.id, reply: replyText });
      setReplyFor(null);
      setReplyText("");
    } catch (e: any) {
      toast.error(dt("c_error"), { description: e.message });
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold">{dt("rv_title")}</h2>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{dt("rv_inShop")}</p>
          {stats ? (
            <div className="mt-1 flex items-center gap-1.5"><span className="text-lg font-bold">{stats.avg.toFixed(1)}</span><Stars value={stats.avg} /><span className="text-[11px] text-muted-foreground">({stats.count})</span></div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{dt("rv_none")}</p>
          )}
        </div>
        {catalogStats && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{dt("rv_general")}</p>
            <div className="mt-1 flex items-center gap-1.5"><span className="text-lg font-bold">{catalogStats.avg.toFixed(1)}</span><Stars value={catalogStats.avg} /></div>
            <p className="text-[10px] text-muted-foreground">{catalogStats.count} {dt("rv_reviews")} · {catalogStats.shops} {dt("rv_acrossShops")}</p>
          </div>
        )}
      </div>

      {!isOwner && !editing && (
        <button onClick={startEdit} className="w-full rounded-xl border border-primary/40 bg-primary/10 py-2.5 text-xs font-bold text-primary">
          {mine ? dt("rv_edit") : dt("rv_write")}
        </button>
      )}

      {editing && (
        <div className="space-y-2 rounded-2xl border border-primary/30 bg-card p-3">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n}/5`}>
                <Star size={26} className={n <= rating ? "fill-primary text-primary" : "text-muted-foreground"} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 600))}
            rows={3}
            placeholder={dt("rv_placeholder")}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <p className="text-[10px] text-muted-foreground">{dt("rv_rules")}</p>
          <div className="flex gap-2">
            {mine && (
              <button
                onClick={async () => { try { await del.mutateAsync(product.id); setEditing(false); } catch (e: any) { toast.error(dt("c_error"), { description: e.message }); } }}
                className="grid h-10 w-10 place-items-center rounded-xl border border-border text-destructive"
                aria-label={dt("rv_delete")}
              >
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold">{dt("m_cancel")}</button>
            <button onClick={send} disabled={submit.isPending} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl gold-gradient py-2.5 text-xs font-bold disabled:opacity-50">
              {submit.isPending && <Loader2 size={13} className="animate-spin" />} {dt("rv_send")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{dt("c_loading")}</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{dt("rv_none")}</p>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{r.profiles?.name ?? "—"}</span>
                <Stars value={r.rating} size={12} />
              </div>
              {r.declared_exchange && (
                <span title={dt("rv_declaredHint")} className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  <BadgeCheck size={11} /> {dt("rv_declared")}
                </span>
              )}
              {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{new Date(r.created_at).toLocaleDateString(locale)}</span>
                <span className="flex items-center gap-3">
                  {isOwner && (
                    <button onClick={() => { setReplyFor(replyFor === r.id ? null : r.id); setReplyText(r.merchant_reply ?? ""); }} className="font-semibold text-primary">{dt("rv_reply")}</button>
                  )}
                  {session && r.user_id !== session.user.id && (
                    <button onClick={() => setReportId(r.id)} aria-label={dt("rv_report")} className="text-muted-foreground"><Flag size={12} /></button>
                  )}
                </span>
              </div>
              {r.merchant_reply && (
                <div className="mt-2 flex gap-1.5 rounded-xl bg-background p-2 text-xs">
                  <CornerDownRight size={13} className="mt-0.5 shrink-0 text-primary" />
                  <div><p className="font-semibold">{dt("rv_replyOf")}</p><p className="text-muted-foreground">{r.merchant_reply}</p></div>
                </div>
              )}
              {replyFor === r.id && (
                <div className={cn("mt-2 flex gap-2")}>
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value.slice(0, 400))} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none" />
                  <button onClick={() => sendReply(r)} className="rounded-xl gold-gradient px-3 text-xs font-bold">{dt("rv_send")}</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <GuestPrompt open={guest} onClose={() => setGuest(false)} />
      {reportId && <ReportDialog open onClose={() => setReportId(null)} targetType="product_review" targetId={reportId} />}
    </section>
  );
}
