import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { useCreateReport } from "@/lib/queries";
import { useApp } from "@/lib/app-store";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "shop" | "product" | "post" | "user";
  targetId: string;
}) {
  const { t } = useApp();
  const createReport = useCreateReport();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEscapeToClose(open, onClose);

  if (!open) return null;

  async function submit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await createReport.mutateAsync({ targetType, targetId, reason: reason.trim() });
      toast.success(t("report_sent"));
      setReason("");
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
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={t("report_reasonPlaceholder")}
          className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold">
            {t("common_cancel")}
          </button>
          <button onClick={submit} disabled={submitting || !reason.trim()} className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {t("report_submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
