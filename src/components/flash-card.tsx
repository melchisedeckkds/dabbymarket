import { Link } from "react-router-dom";
import { MapPin, Clock } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { formatFlashRemaining } from "@/lib/flash";
import { SponsoredBadge } from "./sponsored-badge";

/**
 * Carte d'une Vente Flash sur le Marché. Une annonce active y est
 * automatiquement mise en avant (badge « sponsorisé » obligatoire, règle
 * produit) pendant exactement la durée souscrite.
 */
export function FlashCard({ listing }: { listing: any }) {
  const { t } = useApp();
  const remaining = formatFlashRemaining(listing.expires_at, {
    expired: t("flash_expired"),
    hoursLeft: (n) => `${n} ${t("flash_hoursLeft")}`,
    daysLeft: (n) => `${n} ${t("flash_daysLeft")}`,
  });
  return (
    <Link to={`/flash/${listing.id}`} className="block overflow-hidden rounded-2xl border border-primary/40 bg-card">
      <div className="relative aspect-square bg-accent">
        {listing.images?.[0] && <img src={listing.images[0]} alt={listing.title} loading="lazy" className="h-full w-full object-cover" />}
        <SponsoredBadge className="absolute left-2 top-2" />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-semibold">
          <Clock size={10} /> {remaining}
        </span>
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-xs font-semibold">{listing.title}</p>
        <p className="text-sm font-bold text-primary">{listing.price_xaf.toLocaleString("fr-FR")} FCFA</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
          <MapPin size={10} /> {listing.neighborhood}
        </p>
      </div>
    </Link>
  );
}
