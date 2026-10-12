import { useState } from "react";
import { X, CheckCircle2, PackageX, Tag, DoorClosed, MapPinOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useDt } from "@/lib/availability-i18n";
import { useReportAvailability, type ReportKind } from "@/lib/availability-queries";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { GuestPrompt } from "./guest-prompt";
import { cn } from "@/lib/utils";

const KINDS: { kind: ReportKind; icon: typeof X; key: "rep_found" | "rep_out" | "rep_price" | "rep_closed" | "rep_address" }[] = [
  { kind: "found", icon: CheckCircle2, key: "rep_found" },
  { kind: "out_of_stock", icon: PackageX, key: "rep_out" },
  { kind: "price_different", icon: Tag, key: "rep_price" },
  { kind: "shop_closed", icon: DoorClosed, key: "rep_closed" },
  { kind: "wrong_address", icon: MapPinOff, key: "rep_address" },
];

/** Signalement communautaire : l'identité du signalant n'est jamais exposée. */
export function AvailabilityReportSheet({ open, onClose, productId, shopId }: { open: boolean; onClose: () => void; productId: string; shopId: string }) {
  const dt = useDt();
  const { session } = useAuth();
  const report = useReportAvailability();
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [price, setPrice] = useState("");
  useEscapeToClose(open, onClose);

  if (!open) return null;
  if (!session) return <GuestPrompt open onClose={onClose} />;

  async function submit() {
    if (!kind) return;
    try {
      await report.mutateAsync({ productId, shopId, kind, price: kind === "price_different" ? Number(price) || null : null });
      toast.success(dt("rep_thanks"));
      setKind(null);
      setPrice("");
      onClose();
    } catch (e: any) {
      toast.error(dt("c_error"), { description: e.message });
    }
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-md rounded-t-3xl border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">{dt("rep_title")}</h3>
          <button onClick={onClose} aria-label={dt("a_close")} className="grid h-8 w-8 place-items-center rounded-full bg-accent"><X size={15} /></button>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {KINDS.map(({ kind: k, icon: Icon, key }) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold", kind === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-background")}
            >
              <Icon size={16} /> {dt(key)}
            </button>
          ))}
        </div>
        {kind === "price_different" && (
          <input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
            placeholder={dt("rep_priceAsk")}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
          />
        )}
        <p className="mt-3 text-[10px] text-muted-foreground">{dt("rep_rules")}</p>
        <button
          onClick={submit}
          disabled={!kind || report.isPending || (kind === "price_different" && !price)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3 text-sm font-bold disabled:opacity-40"
        >
          {report.isPending && <Loader2 size={15} className="animate-spin" />} {dt("rep_send")}
        </button>
      </div>
    </div>
  );
}
