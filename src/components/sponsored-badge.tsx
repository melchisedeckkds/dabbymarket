import { Zap } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";

/**
 * Étiquette visuelle obligatoire sur tout élément mis en avant par un
 * boost — carte, recherche, accueil ou mention du chatbot. Ne doit
 * jamais être omise là où un boost influence l'affichage (règle produit
 * non négociable : un résultat sponsorisé n'est jamais présenté comme
 * une réponse neutre).
 */
export function SponsoredBadge({ className }: { className?: string }) {
  const { t } = useApp();
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full gold-gradient shine px-2 py-0.5 text-[10px] font-bold", className)}>
      <Zap size={10} /> {t("boost_sponsoredLabel")}
    </span>
  );
}
