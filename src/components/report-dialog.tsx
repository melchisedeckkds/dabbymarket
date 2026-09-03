import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { useCreateReport } from "@/lib/queries";
import { useApp } from "@/lib/app-store";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { cn } from "@/lib/utils";

const REASON_KEYS = [
  "report_reasonScam",
  "report_reasonForbidden",
  "report_reasonMisleadingInfo",
  "report_reasonMisleadingPhotos",
  "report_reasonMisleadingPrice",
  "report_reasonWrongCategory",
  "report_reasonFakeProfile",
  "report_reasonFakeShop",
  "report_reasonInappropriate",
  "report_reasonCounterfeit",
  "report_reasonOther",
] as const;

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "shop" | "product" | "post" | "user" | "flash_listing";
  targetId: string;
}) {
  const { t } = useApp();
  const createReport = useCreateReport();
  const [selectedReason, setSelectedReason] = useState<(typeof REASON_KEYS)[number] | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEscapeToClose(open, onClose);

  if (!open) return null;

  const isOther = selectedReason === "report_reasonOther";
  const canSubmit = selectedReason && (!isOther || details.trim());

  async function submit() {
    if (!canSubmit || !selectedReason) return;
    const reason = isOther ? details.trim() : t(selectedReason);
    setSubmitting(true);
    try {
      await createReport.mutateAsync({ targetType, targetId, reason });
      toast.success(t("report_sent"));
      setSelectedReason(null);
      setDetails("");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[850] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/15 text-destructive">
          <Flag size={20} />
        </div>
        <h2 className="mt-3 text-center text-base font-bold">{t("report_title")}</h2>

        <p className="mt-3 text-xs font-semibold text-muted-foreground">{t("report_reasonLabel")}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {REASON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedReason(key)}
              className={cn(
                "rounded-full border px-2.5 py-1.5 text-[11px] font-semibold",
                selectedReason === key ? "border-destructive bg-destructive/15 text-destructive" : "border-border bg-background text-muted-foreground",
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>

        {(isOther || selectedReason) && (
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder={isOther ? t("report_otherPlaceholder") : t("report_reasonPlaceholder")}
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold">
            {t("common_cancel")}
          </button>
          <button onClick={submit} disabled={submitting || !canSubmit} className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {t("report_submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
