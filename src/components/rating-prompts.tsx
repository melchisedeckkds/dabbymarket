import { useState } from "react";
import { X } from "lucide-react";
import { useV2 } from "@/lib/v2-i18n";
import { useRatingPrompts, useDismissRatingPrompt } from "@/lib/v2-queries";
import { ShopReviewSheet } from "@/components/shop-review-sheet";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/** Invitation discrète à noter une boutique contactée ou visitée récemment. Un seul prompt à la fois. */
export function RatingPrompts() {
  const v = useV2();
  const { data = [] } = useRatingPrompts();
  const dismiss = useDismissRatingPrompt();
  const [rating, setRating] = useState<{ shopId: string; name: string } | null>(null);
  const p = data[0];
  if (!p && !rating) return null;

  async function reportExactness(found: boolean) {
    if (!p) return;
    if (p.product_id) {
      const { error } = await supabase.rpc("report_availability", { p_product_id: p.product_id, p_kind: found ? "found" : "out_of_stock", p_price: null });
      if (error) toast.error(error.message);
    }
    dismiss.mutate(p.trace_id);
    setRating({ shopId: p.shop_id, name: p.shop_name });
  }

  return (
    <>
      {p && !rating && (
        <div className="fixed inset-x-3 bottom-20 z-[800] mx-auto max-w-md rounded-2xl border border-primary/30 bg-card p-3.5 shadow-xl">
          <button onClick={() => dismiss.mutate(p.trace_id)} className="absolute right-2 top-2 text-muted-foreground" aria-label={v("tr_prompt_later")}><X size={16} /></button>
          <p className="pr-6 text-sm font-bold">{v("tr_prompt_title")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{v("tr_prompt_sub", { shop: p.shop_name })}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {p.product_id && (
              <>
                <button onClick={() => reportExactness(true)} className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-700">{v("tr_prompt_yes")}</button>
                <button onClick={() => reportExactness(false)} className="rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">{v("tr_prompt_no")}</button>
              </>
            )}
            <button onClick={() => { dismiss.mutate(p.trace_id); setRating({ shopId: p.shop_id, name: p.shop_name }); }} className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold">{v("tr_prompt_rate")}</button>
          </div>
        </div>
      )}
      {rating && <ShopReviewSheet open onClose={() => setRating(null)} shopId={rating.shopId} shopName={rating.name} />}
    </>
  );
}
