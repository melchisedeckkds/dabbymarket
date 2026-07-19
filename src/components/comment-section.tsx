import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { useComments, useAddComment } from "@/lib/queries";
import { GuestPrompt } from "./guest-prompt";

export function CommentSection({ productId, postId }: { productId?: string; postId?: string }) {
  const { t } = useApp();
  const { session } = useAuth();
  const { data: comments = [], isLoading } = useComments(productId, postId);
  const addComment = useAddComment();
  const [text, setText] = useState("");
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  async function send() {
    if (!session) {
      setShowGuestPrompt(true);
      return;
    }
    if (!text.trim()) return;
    try {
      await addComment.mutateAsync({ productId, postId, text: text.trim() });
      setText("");
    } catch (err: any) {
      toast.error(t("common_error"), { description: err.message });
    }
  }

  return (
    <div>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {t("comments_title")} {comments.length > 0 && `(${comments.length})`}
      </h2>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("comments_placeholder")}
          className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={send}
          disabled={addComment.isPending}
          aria-label={t("comments_send")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full gold-gradient disabled:opacity-60"
        >
          <Send size={15} />
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        {isLoading ? (
          <div className="h-12 animate-pulse rounded-xl bg-card" />
        ) : comments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {t("comments_empty")}
          </p>
        ) : (
          comments.map((c: any) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold">
                {c.profiles?.avatar_url ? (
                  <img src={c.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  c.profiles?.name?.[0]?.toUpperCase() ?? "?"
                )}
              </div>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-card px-3 py-2">
                <p className="text-xs font-semibold">{c.profiles?.name ?? "—"}</p>
                <p className="mt-0.5 text-sm">{c.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <GuestPrompt open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} />
    </div>
  );
}
