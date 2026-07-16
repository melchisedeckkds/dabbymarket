import { cn } from "@/lib/utils";

/**
 * Logo DabbyMarket — un monogramme "D" en dégradé doré, dessiné en pur CSS/SVG.
 * Aucune dépendance à un fichier image externe : fonctionne immédiatement,
 * hors-ligne, et sans risque de lien cassé après le passage hors de Lovable.
 *
 * Pour utiliser ton propre logo (fichier image), remplace le contenu de ce
 * composant par une simple balise <img>, par exemple :
 *
 *   import logo from "@/assets/mon-logo.png";
 *   export function Logo({ size = 32, className }: { size?: number; className?: string }) {
 *     return <img src={logo} alt="DabbyMarket" width={size} height={size} className={className} />;
 *   }
 *
 * Place alors ton fichier "mon-logo.png" dans src/assets/.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-xl gold-gradient font-black text-background", className)}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-label="DabbyMarket"
      role="img"
    >
      D
    </div>
  );
}
