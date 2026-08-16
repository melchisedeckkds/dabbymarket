import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const TOKEN_RE = /([#@][\p{L}0-9_]+)/gu;

/**
 * Découpe une légende en texte normal + hashtags (#tag) + mentions
 * (@nom) cliquables, avec une typographie soignée : interlignage plus
 * aéré, chasse légèrement resserrée, couleur dorée discrète sur les
 * tokens pour rester sobre et élégant.
 */
export function HashtagText({ text, className }: { text: string; className?: string }) {
  const navigate = useNavigate();

  async function onMention(handle: string) {
    const name = handle.slice(1);
    const { data } = await supabase.from("profiles").select("id").ilike("name", name).limit(1).maybeSingle();
    if (data?.id) navigate(`/profil/${data.id}`);
    else toast.info(`@${name}`, { description: "Profil introuvable" });
  }

  function onHashtag(handle: string) {
    navigate(`/?q=${encodeURIComponent(handle)}`);
  }

  const parts = text.split(TOKEN_RE);

  return (
    <span className={className} style={{ letterSpacing: "-0.01em", lineHeight: 1.6 }}>
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          return (
            <button key={i} onClick={() => onHashtag(part)} className="font-medium text-primary hover:underline">
              {part}
            </button>
          );
        }
        if (part.startsWith("@")) {
          return (
            <button key={i} onClick={() => onMention(part)} className="font-medium text-[color:var(--verified)] hover:underline">
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
