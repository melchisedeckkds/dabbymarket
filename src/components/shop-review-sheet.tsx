import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useV2 } from "@/lib/v2-i18n";
import { useSubmitShopReview, useDeleteMyShopReview } from "@/lib/v2-queries";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { cn } from "@/lib/utils";

/** Formulaire d'avis boutique. Les règles (preuve d'interaction, santé sans texte, anti-abus) sont appliquées par la base. */
export function ShopReviewSheet({
  open, onClose, shopId, shopName, isHealth, initialRating,
}: { open: boolean; onClose: () => void; shopId: string; shopName: string; isHealth?: boolean; initialRating?: number }) {
  const v = useV2();
  const [rating, setRating] = useState(initialRating ?? 0);
  const [comment, setComment] = useState("");
  const submit = useSubmitShopReview(shopId);
  const remove = useDeleteMyShopReview(shopId);
  useEscapeToClose(open, onClose);
  if (!open) return null;

  async function send() {
    try {
      await submit.mutateAsync({ rating, comment: isHealth ? undefined : comment });
      toast.success(v("tr_rate_thanks"));
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? v("common_error"));
    }
  }
  async function del() {
    try { await remove.mutateAsync(); onClose(); } catch (e: any) { toast.error(e.message ?? v("common_error")); }
  }

  return (
    <div className="fixed inset-0 z-[850] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
        <h2 className="text-base font-bold">{v("tr_rate_title", { shop: shopName })}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{v("tr_rate_sub")}</p>
        <div className="mt-3 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i}`}>
              <Star size={32} className={cn(i <= rating ? "fill-primary text-primary" : "text-muted-foreground/40")} />
            </button>
          ))}
        </div>
        {isHealth ? (
          <p className="mt-3 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] text-muted-foreground">{v("tr_rate_health_no_text")}</p>
        ) : (
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={600} placeholder={v("tr_rate_comment")}
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold">{v("common_cancel")}</button>
          <button onClick={send} disabled={!rating || submit.isPending} className="flex-1 rounded-xl gold-gradient py-2.5 text-sm font-bold disabled:opacity-50">{v("tr_rate_send")}</button>
        </div>
        <button onClick={del} className="mt-3 w-full text-center text-[11px] text-muted-foreground underline">{v("tr_rate_delete")}</button>
      </div>
    </div>
  );
}
