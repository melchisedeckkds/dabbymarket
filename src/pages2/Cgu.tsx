import { Link } from "react-router-dom";
import { ArrowLeft, ScrollText } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function CguPage() {
  return (
    <AppShell>
      {/* Header sticky glassmorphique avec dégradé or */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            to="/compte"
            className="group grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ScrollText size={16} className="text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary/80">Cadre légal</span>
            </div>
            <h1 className="truncate text-base font-black">Conditions Générales d'Utilisation</h1>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      <div className="relative">
        {/* Aura décorative */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(212,175,55,0.08),transparent_70%)]" />

        <div className="relative mx-auto max-w-none space-y-5 px-4 py-6 text-sm leading-relaxed text-foreground">
          <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 shadow-inner">
            <p className="text-xs text-muted-foreground">
              Dernière mise à jour : <span className="font-semibold text-foreground">juillet 2026</span>. Ce document
              est un modèle de référence et ne remplace pas une relecture par un professionnel du droit avant une
              mise en ligne publique définitive.
            </p>
          </div>

          {[
            {
              n: "1",
              title: "Objet",
              body: (
                <p>
                  DabbyMarket est une plateforme numérique de mise en relation entre particuliers et petites
                  entreprises souhaitant vendre ou acheter des produits localement au Cameroun. DabbyMarket agit
                  exclusivement comme <b>intermédiaire technique de mise en relation</b> entre acheteurs et vendeurs.
                </p>
              ),
            },
            {
              n: "2",
              title: "Rôle d'intermédiaire — limitation de responsabilité",
              body: (
                <>
                  <p>
                    DabbyMarket ne vend, n'achète, ne stocke et ne livre aucun produit. Les transactions
                    (paiement, remise du produit, livraison) se déroulent directement et exclusivement entre
                    l'acheteur et le vendeur, en dehors de la plateforme. DabbyMarket ne peut être tenu responsable :
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>de la qualité, conformité, licéité ou description des produits publiés par les vendeurs ;</li>
                    <li>du bon déroulement du paiement, de la livraison ou de la remise en main propre entre utilisateurs ;</li>
                    <li>d'un litige, d'une fraude ou d'un préjudice survenant lors d'une transaction entre utilisateurs.</li>
                  </ul>
                  <p className="mt-2">
                    Chaque utilisateur reste seul responsable des transactions qu'il initie et des informations qu'il publie.
                  </p>
                </>
              ),
            },
            {
              n: "3",
              title: "Inscription et compte utilisateur",
              body: (
                <p>
                  L'inscription se fait par numéro de téléphone. Chaque utilisateur est responsable de la confidentialité de
                  son mot de passe et de l'exactitude des informations fournies. Le badge « boutique vérifiée » atteste
                  uniquement d'une vérification technique du numéro de téléphone et ne constitue pas une garantie de fiabilité
                  commerciale absolue.
                </p>
              ),
            },
            {
              n: "4",
              title: "Les Pépites",
              body: (
                <p>
                  Les Pépites sont une monnaie interne, sans valeur monétaire en dehors de la plateforme, utilisées
                  exclusivement pour accéder à des fonctionnalités de mise en avant (publication commerciale, boost). Les
                  Pépites ne sont ni remboursables ni convertibles en argent réel, sauf erreur avérée imputable à
                  DabbyMarket. Toute demande de recharge fait l'objet d'une vérification manuelle par l'administrateur avant
                  crédit du compte ; DabbyMarket se réserve le droit de refuser une recharge en cas de paiement non confirmé.
                </p>
              ),
            },
            {
              n: "5",
              title: "Contenu publié par les utilisateurs",
              body: (
                <p>
                  Chaque utilisateur est seul responsable du contenu qu'il publie (textes, photos, prix, descriptions).
                  Est interdite la publication de contenu illicite, trompeur, portant atteinte aux droits d'un tiers, ou
                  non conforme à la réglementation camerounaise en vigueur. DabbyMarket se réserve le droit de retirer tout
                  contenu signalé et jugé non conforme, et de suspendre un compte en cas d'abus répétés.
                </p>
              ),
            },
            {
              n: "6",
              title: "Sécurité des transactions",
              body: (
                <p>
                  DabbyMarket recommande, sans pouvoir l'imposer ni le garantir, de privilégier un lieu public pour toute
                  remise en main propre, et de vérifier l'identité et la réputation de son interlocuteur avant toute
                  transaction.
                </p>
              ),
            },
            {
              n: "7",
              title: "Données personnelles",
              body: (
                <p>
                  Les données collectées (numéro de téléphone, localisation des boutiques, messages) sont utilisées
                  uniquement pour le fonctionnement du service. Un utilisateur peut demander la suppression de son compte et
                  de ses données à tout moment en contactant l'administrateur.
                </p>
              ),
            },
            {
              n: "8",
              title: "Modification des présentes conditions",
              body: (
                <p>
                  DabbyMarket peut modifier ces conditions à tout moment ; les utilisateurs seront informés de toute
                  modification substantielle via l'application.
                </p>
              ),
            },
            {
              n: "9",
              title: "Droit applicable",
              body: <p>Les présentes conditions sont soumises au droit camerounais.</p>,
            },
            {
              n: "10",
              title: "Contact",
              body: (
                <p>
                  Pour toute question relative aux présentes conditions, contactez l'administrateur via la page
                  Suggestions de l'application.
                </p>
              ),
            },
          ].map((s) => (
            <section
              key={s.n}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-2 flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full gold-gradient text-xs font-black text-background shadow-md shadow-primary/20">
                  {s.n}
                </span>
                <h2 className="text-[15px] font-bold tracking-tight">{s.title}</h2>
              </div>
              <div className="pl-11 text-[13.5px] leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
