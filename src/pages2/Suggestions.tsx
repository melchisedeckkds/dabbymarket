import { Link } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useSuggestions, useAddSuggestion, useVoteSuggestion } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ThumbsUp, Lightbulb, Bug, Wand2, Sparkles, Users, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-store";
import type { TranslationKey } from "@/lib/i18n";

type SuggestionType = "idee" | "amelioration" | "bug";

const CATS: { id: SuggestionType; key: TranslationKey; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; ring: string; glow: string }[] = [
  { id: "idee", key: "suggestions_typeIdea", icon: Lightbulb, color: "text-primary", ring: "border-primary/50 bg-primary/10", glow: "shadow-primary/20" },
  { id: "amelioration", key: "suggestions_typeImprovement", icon: Wand2, color: "text-[color:var(--verified)]", ring: "border-[color:var(--verified)]/50 bg-[color:var(--verified)]/10", glow: "shadow-[color:var(--verified)]/20" },
  { id: "bug", key: "suggestions_typeBug", icon: Bug, color: "text-destructive", ring: "border-destructive/50 bg-destructive/10", glow: "shadow-destructive/20" },
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
  const totalVotes = sorted.reduce((sum: number, s: any) => sum + (s.votes_count || 0), 0);

  return (
    <AppShell>
      {/* Header sticky */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/compte" className="group grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40">
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary/80">Communauté</span>
            </div>
            <h1 className="truncate text-base font-black">{t("suggestions_title")}</h1>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      <div className="relative p-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(212,175,55,0.10),transparent_70%)]" />

        {/* Hero résumé */}
        <div className="relative mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-3">
            <Lightbulb size={18} className="text-primary" />
            <p className="mt-1 text-lg font-black">{sorted.length}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Idées</p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-3">
            <Users size={18} className="text-primary" />
            <p className="mt-1 text-lg font-black">{totalVotes}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Votes cumulés</p>
          </div>
        </div>

        <form onSubmit={submit} className="relative space-y-3 overflow-hidden rounded-3xl border border-border bg-card/90 p-4 shadow-lg backdrop-blur">
          <span className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />

          <div className="relative">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Catégorie
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {CATS.map((c) => {
                const active = cat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCat(c.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-[11px] font-semibold transition-all active:scale-95",
                      active ? `${c.ring} shadow-lg ${c.glow}` : "border-border bg-background hover:border-primary/30",
                    )}
                  >
                    <c.icon size={18} className={active ? c.color : "text-muted-foreground"} />
                    <span className={active ? c.color : "text-muted-foreground"}>{t(c.key)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder={t("suggestions_titlePlaceholder")}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="input"
              placeholder={t("suggestions_bodyPlaceholder")}
            />
          </div>

          <button className="shine relative flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3 text-sm font-black text-background shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]">
            <Send size={15} />
            {t("suggestions_submit")}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-2">
          <Users size={15} className="text-primary" />
          <h2 className="text-sm font-black">{t("suggestions_communityIdeas")}</h2>
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {sorted.length}
          </span>
        </div>

        <div className="mt-2 space-y-2">
          {sorted.map((s: any, i: number) => {
            const catInfo = CATS.find((c) => c.id === s.type)!;
            const voted = myVotes.has(s.id);
            const podium = i < 3;
            return (
              <div
                key={s.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg",
                  podium ? "border-primary/40 hover:shadow-primary/10" : "border-border hover:border-primary/25",
                )}
              >
                {podium && (
                  <span className="absolute left-0 top-0 h-full w-1 gold-gradient" />
                )}
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => vote(s.id)}
                    disabled={voted}
                    className={cn(
                      "flex min-w-[46px] flex-col items-center rounded-xl border px-2 py-2 transition-all",
                      voted
                        ? "border-primary bg-primary/15 text-primary shadow-sm shadow-primary/20"
                        : "border-border bg-background hover:-translate-y-0.5 hover:border-primary hover:text-primary hover:shadow",
                    )}
                  >
                    <ThumbsUp size={14} fill={voted ? "currentColor" : "none"} />
                    <span className="mt-0.5 text-xs font-black">{s.votes_count}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <catInfo.icon size={12} className={catInfo.color} />
                      <span className={cn("text-[10px] font-bold uppercase tracking-wide", catInfo.color)}>
                        {t(catInfo.key)}
                      </span>
                      {podium && (
                        <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-black text-primary">
                          TOP #{i + 1}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-snug">{s.text}</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {t("suggestions_by")} <span className="font-medium text-foreground/70">{s.profiles?.name ?? "—"}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`.input{width:100%;border-radius:0.85rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.75rem 0.9rem;font-size:0.9rem;outline:none;color:var(--color-foreground);transition:all .2s}
      .input:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px color-mix(in oklab,var(--color-primary) 15%,transparent)}`}</style>
    </AppShell>
  );
}
