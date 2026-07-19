import { X } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { CommentSection } from "./comment-section";

export function CommentSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { t } = useApp();
  useEscapeToClose(true, onClose);

  return (
    <div className="fixed inset-0 z-[700] flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-bold">{t("comments_title")}</span>
          <button onClick={onClose} aria-label={t("common_close")} className="grid h-8 w-8 place-items-center rounded-full bg-accent">
            <X size={14} />
          </button>
        </div>
        <CommentSection postId={postId} />
      </div>
    </div>
  );
}
