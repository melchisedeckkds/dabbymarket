import { useState } from "react";
import { X, Zap, Store, MapPin as MapPinIcon, Search, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { useBoostCatalog, usePurchaseBoost, useActiveBoosts } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { Pepite } from "./pepite";
import { cn } from "@/lib/utils";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";

const TYPE_ICON: Record<string, any> = { article: Zap, shop: Store, carte: MapPinIcon, recherche: Search, ia: Sparkles, accueil: Star };
const TYPE_LABEL_KEY: Record<string, string> = {
  article: "boost_typeArticle",
  shop: "boost_typeShop",
  carte: "boost_typeCarte",
  recherche: "boost_typeRecherche",
  ia: "boost_typeIA",
  accueil: "boost_typeAccueil",
};

/**
 * Panneau de sélection d'un boost, pour un article ou une boutique. Montre
 * uniquement les types pertinents pour la cible (un article ne propose pas
 * "Boost Carte", réservé aux boutiques). Plusieurs boosts de types
 * différents peuvent être actifs en même temps sur la même cible.
 */
export function BoostPicker({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "product" | "shop";
  targetId: string;
}) {
  const { t } = useApp();
  const { profile } = useAuth();
  const { data: catalog = [] } = useBoostCatalog();
  const { data: activeBoosts = [] } = useActiveBoosts(targetType, targetId);
  const purchase = usePurchaseBoost();
  const [selected, setSelected] = useState<string | null>(null);
  useEscapeToClose(open, onClose);

  if (!open) return null;

  const relevantTypes = targetType === "product" ? ["article", "recherche", "ia"] : ["shop", "carte", "recherche", "ia", "accueil"];
  const groups = relevantTypes
    .map((type) => ({ type, options: catalog.filter((c: any) => c.boost_type === type) }))
    .filter((g) => g.options.length > 0);

  async function confirm() {
    if (!selected) return;
    try {
      await purchase.mutateAsync({ targetType, targetId, boostCatalogId: selected });
      toast.success(t("boost_purchaseSuccess"));
      setSelected(null);
      onClose();
    } catch (e: any) {
      toast.error(t("boost_purchaseFailed"), { description: e.message });
    }
  }

  const selectedOption = catalog.find((c: any) => c.id === selected);

  return (
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">{t("boost_pickerTitle")}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-accent"><X size={16} /></button>
        </div>
        <div className="mb-3 flex items-center justify-between rounded-xl bg-accent px-3 py-2 text-xs font-semibold">
          <span>{t("boost_yourBalance")}</span>
          <span className="flex items-center gap-1 text-primary"><Pepite size={13} /> {profile?.pepites_balance ?? 0}</span>
        </div>

        {activeBoosts.length > 0 && (
          <div className="mb-3 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("boost_alreadyActive")}</p>
            {activeBoosts.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs">
                <span className="font-medium text-primary">{catalog.find((c: any) => c.id === b.boost_catalog_id)?.label ?? b.boost_type}</span>
                <span className="text-muted-foreground">{t("boost_until")} {new Date(b.expires_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        {groups.map((g) => {
          const Icon = TYPE_ICON[g.type];
          return (
            <div key={g.type} className="mb-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Icon size={13} /> {t(TYPE_LABEL_KEY[g.type] as any)}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {g.options.map((o: any) => (
                  <button
                    key={o.id}
                    onClick={() => setSelected(o.id)}
                    className={cn(
                      "rounded-xl border p-2 text-center transition-colors",
                      selected === o.id ? "border-primary bg-primary/15" : "border-border bg-background",
                    )}
                  >
                    <p className="text-[11px] font-semibold">{o.duration_hours < 24 ? `${o.duration_hours}h` : o.duration_hours % 24 === 0 && o.duration_hours / 24 < 30 ? `${o.duration_hours / 24}j` : `${Math.round(o.duration_hours / 24)}j`}</p>
                    <p className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-primary"><Pepite size={10} /> {o.cost_pepites}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <button
          onClick={confirm}
          disabled={!selected || purchase.isPending}
          className="mt-2 w-full rounded-xl gold-gradient shine py-3 text-sm font-bold disabled:opacity-50"
        >
          {selectedOption ? `${t("boost_confirm")} — ${selectedOption.cost_pepites} ${t("pepites")}` : t("boost_choose")}
        </button>
      </div>
    </div>
  );
}
