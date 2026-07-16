import { Link } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useSuggestions, useAddSuggestion, useVoteSuggestion } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ThumbsUp, Lightbulb, Bug, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-store";
import type { TranslationKey } from "@/lib/i18n";

type SuggestionType = "idee" | "amelioration" | "bug";

const CATS: { id: SuggestionType; key: TranslationKey; icon: React.ComponentType<{ size?: number }>; color: string }[] = [
  { id: "idee", key: "suggestions_typeIdea", icon: Lightbulb, color: "text-primary" },
  { id: "amelioration", key: "suggestions_typeImprovement", icon: Wand2, color: "text-[color:var(--verified)]" },
  { id: "bug", key: "suggestions_typeBug", icon: Bug, color: "text-destructive" },
];

function useMyVotes() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-suggestion-votes", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("suggestion_votes").select("suggestion_id").eq("user_id", session!.user.id);
      return new Set((data ?? []).map((v) => v.suggestion_id));
    },
  });
}

export default function SuggestionsPage() {
  const { t } = useApp();
  const { data: suggestions = [] } = useSuggestions();
  const { data: myVotes = new Set<string>() } = useMyVotes();
  const addSuggestion = useAddSuggestion();
  const voteSuggestion = useVoteSuggestion();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cat, setCat] = useState<SuggestionType>("idee");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error(t("suggestions_titleRequired"));
    const text = body.trim() ? `${title.trim()} — ${body.trim()}` : title.trim();
    try {
      await addSuggestion.mutateAsync({ type: cat, text });
      toast.success(t("suggestions_sent"));
      setTitle("");
      setBody("");
    } catch (err: any) {
      toast.error(t("suggestions_sendFailed"), { description: err.message });
    }
  }

  async function vote(id: string) {
    if (myVotes.has(id)) return toast.info(t("suggestions_alreadyVoted"));
    try {
      await voteSuggestion.mutateAsync(id);
    } catch {
      toast.error(t("suggestions_voteFailed"));
    }
  }

  const sorted = [...suggestions].sort((a: any, b: any) => b.votes_count - a.votes_count);

  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Link to="/compte" className="grid h-9 w-9 place-items-center rounded-full bg-card">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">{t("suggestions_title")}</h1>
      </div>

      <div className="p-4">
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-3 gap-1.5">
            {CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={cn("flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-semibold", cat === c.id ? "border-primary bg-primary/10" : "border-border bg-background")}
              >
                <c.icon size={16} />
                {t(c.key)}
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder={t("suggestions_titlePlaceholder")} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="input" placeholder={t("suggestions_bodyPlaceholder")} />
          <button className="w-full rounded-xl gold-gradient py-2.5 text-sm font-bold">{t("suggestions_submit")}</button>
        </form>

        <h2 className="mb-2 mt-6 text-sm font-semibold">{t("suggestions_communityIdeas")}</h2>
        <div className="space-y-2">
          {sorted.map((s: any) => {
            const catInfo = CATS.find((c) => c.id === s.type)!;
            const voted = myVotes.has(s.id);
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => vote(s.id)}
                    disabled={voted}
                    className={cn(
                      "flex flex-col items-center rounded-lg border px-2 py-1.5 transition-colors",
                      voted ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary hover:text-primary",
                    )}
                  >
                    <ThumbsUp size={14} />
                    <span className="mt-0.5 text-xs font-bold">{s.votes_count}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <catInfo.icon size={12} />
                      <span className={cn("text-[10px] font-bold uppercase tracking-wide", catInfo.color)}>{t(catInfo.key)}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold">{s.text}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{t("suggestions_by")} {s.profiles?.name ?? "—"}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.65rem 0.85rem;font-size:0.9rem;outline:none;color:var(--color-foreground)}`}</style>
    </AppShell>
  );
}
