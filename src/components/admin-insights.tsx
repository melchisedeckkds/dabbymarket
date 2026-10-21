// Blocs d'administration ajoutés par la mise à jour 0019 :
// archives des Ventes Flash, audit des Pépites, acquisition, candidats au badge.
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { downloadCSV } from "@/lib/csv";
import {
  useAdminFlashArchive, useAdminPepitesAudit, useAdminAcquisitionStats,
  useAdminBadgeCandidates, useSetShopVerified,
} from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  expired: "Expirée", sold: "Vendue", removed: "Retirée", suspended: "Suspendue",
};

export function AdminFlashArchive() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useAdminFlashArchive({ status, search });

  function exportCsv() {
    downloadCSV("archives-ventes-flash.csv", data.map((f: any) => ({
      titre: f.title, vendeur: f.seller_name, telephone: f.seller_phone, categorie: f.category,
      prix_fcfa: f.price_xaf, quartier: f.neighborhood, ville: f.city, statut: f.status,
      duree_h: f.duration_hours, gratuite: f.is_free_listing ? "oui" : "non",
      publiee: f.created_at, fin: f.expires_at, archivee: f.archived_at,
    })));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titre, vendeur, quartier…"
          className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-border bg-card px-2 text-xs">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={exportCsv} disabled={!data.length} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border disabled:opacity-40" aria-label="Exporter en CSV">
          <Download size={15} />
        </button>
      </div>
      {isLoading ? null : data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Aucune annonce archivée.</p>
      ) : (
        data.map((f: any) => (
          <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
            {f.images?.[0] && <img src={f.images[0]} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{f.title} · {f.price_xaf.toLocaleString("fr-FR")} FCFA</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {f.seller_name ?? "—"} · {f.neighborhood} · {STATUS_LABEL[f.status] ?? f.status} · {f.duration_hours} h{f.is_free_listing ? " · offerte" : ""}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">Archivée le {new Date(f.archived_at).toLocaleString("fr-FR")}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function AdminInsights() {
  const qc = useQueryClient();
  const { data: audit = [] } = useAdminPepitesAudit();
  const { data: acq = [] } = useAdminAcquisitionStats();
  const { data: cands = [] } = useAdminBadgeCandidates();
  const setVerified = useSetShopVerified();

  async function toggle(shopId: string, verified: boolean) {
    try {
      await setVerified.mutateAsync({ shopId, verified });
      qc.invalidateQueries({ queryKey: ["admin-badge-candidates"] });
      toast.success(verified ? "Badge attribué" : "Badge retiré");
    } catch (e: any) {
      toast.error("Action impossible", { description: e.message });
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-1 text-sm font-semibold">Audit des Pépites</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">Comptes dont le solde ne correspond pas à la somme des transactions confirmées (ou négatifs).</p>
        {audit.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-[color:var(--verified)]">✓ Aucun écart détecté</p>
        ) : audit.map((a: any) => (
          <div key={a.user_id} className="mb-1 flex justify-between rounded-xl border border-destructive/50 bg-card p-2.5 text-xs">
            <span className="truncate">{a.name}</span>
            <span className="shrink-0 font-mono">solde {a.balance} · journal {a.ledger} · écart {a.gap}</span>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Origine des inscrits</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">Basée sur les liens avec ?utm_source=…&amp;utm_campaign=… (ex. dabbymarket.netlify.app/?utm_source=whatsapp&amp;utm_campaign=etoudi).</p>
        {acq.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Aucune donnée pour l'instant.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {acq.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between border-b border-border bg-card px-3 py-2 text-xs last:border-0">
                <span>{r.source} · {r.campaign}</span>
                <span className="font-bold">{r.users} inscrit(s) · {r.with_shop} boutique(s)</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Candidats au badge « vérifié »</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">Critère d'avis rempli (seuils modifiables dans Économie). Le badge reste attribué par un administrateur après vérification.</p>
        {cands.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Aucune boutique n'atteint encore les seuils.</p>
        ) : cands.map((c: any) => (
          <div key={c.shop_id} className="mb-1 flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{c.shop_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{c.owner_name} · ★ {c.avg_rating} ({c.ratings_count} avis)</p>
            </div>
            <button onClick={() => toggle(c.shop_id, !c.verified)}
              className="shrink-0 rounded-full border border-primary px-2.5 py-1 text-[11px] font-bold text-primary">
              {c.verified ? "Retirer le badge" : "Attribuer le badge"}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
