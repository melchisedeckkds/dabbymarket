import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function CguPage() {
  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Link to="/compte" className="grid h-9 w-9 place-items-center rounded-full bg-card">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Conditions Générales d'Utilisation</h1>
      </div>

      <div className="prose prose-sm prose-invert max-w-none space-y-4 p-4 text-sm leading-relaxed text-foreground">
        <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          Dernière mise à jour : juillet 2026. Ce document est un modèle de référence et ne remplace pas une relecture
          par un professionnel du droit avant une mise en ligne publique définitive.
        </p>

        <h2 className="text-base font-bold">1. Objet</h2>
        <p>
          DabbyMarket est une plateforme numérique de mise en relation entre particuliers et petites entreprises
          souhaitant vendre ou acheter des produits localement au Cameroun. DabbyMarket agit exclusivement comme
          <b> intermédiaire technique de mise en relation</b> entre acheteurs et vendeurs.
        </p>

        <h2 className="text-base font-bold">2. Rôle d'intermédiaire — limitation de responsabilité</h2>
        <p>
          DabbyMarket ne vend, n'achète, ne stocke et ne livre aucun produit. Les transactions (paiement, remise du
          produit, livraison) se déroulent directement et exclusivement entre l'acheteur et le vendeur, en dehors de
          la plateforme. DabbyMarket ne peut être tenu responsable :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>de la qualité, conformité, licéité ou description des produits publiés par les vendeurs ;</li>
          <li>du bon déroulement du paiement, de la livraison ou de la remise en main propre entre utilisateurs ;</li>
          <li>d'un litige, d'une fraude ou d'un préjudice survenant lors d'une transaction entre utilisateurs.</li>
        </ul>
        <p>
          Chaque utilisateur reste seul responsable des transactions qu'il initie et des informations qu'il publie.
        </p>

        <h2 className="text-base font-bold">3. Inscription et compte utilisateur</h2>
        <p>
          L'inscription se fait par numéro de téléphone. Chaque utilisateur est responsable de la confidentialité de
          son mot de passe et de l'exactitude des informations fournies. Le badge « boutique vérifiée » atteste
          uniquement d'une vérification technique du numéro de téléphone et ne constitue pas une garantie de fiabilité
          commerciale absolue.
        </p>

        <h2 className="text-base font-bold">4. Les Pépites</h2>
        <p>
          Les Pépites sont une monnaie interne, sans valeur monétaire en dehors de la plateforme, utilisées
          exclusivement pour accéder à des fonctionnalités de mise en avant (publication commerciale, boost). Les
          Pépites ne sont ni remboursables ni convertibles en argent réel, sauf erreur avérée imputable à
          DabbyMarket. Toute demande de recharge fait l'objet d'une vérification manuelle par l'administrateur avant
          crédit du compte ; DabbyMarket se réserve le droit de refuser une recharge en cas de paiement non confirmé.
        </p>

        <h2 className="text-base font-bold">5. Contenu publié par les utilisateurs</h2>
        <p>
          Chaque utilisateur est seul responsable du contenu qu'il publie (textes, photos, prix, descriptions).
          Est interdite la publication de contenu illicite, trompeur, portant atteinte aux droits d'un tiers, ou
          non conforme à la réglementation camerounaise en vigueur. DabbyMarket se réserve le droit de retirer tout
          contenu signalé et jugé non conforme, et de suspendre un compte en cas d'abus répétés.
        </p>

        <h2 className="text-base font-bold">6. Sécurité des transactions</h2>
        <p>
          DabbyMarket recommande, sans pouvoir l'imposer ni le garantir, de privilégier un lieu public pour toute
          remise en main propre, et de vérifier l'identité et la réputation de son interlocuteur avant toute
          transaction.
        </p>

        <h2 className="text-base font-bold">7. Données personnelles</h2>
        <p>
          Les données collectées (numéro de téléphone, localisation des boutiques, messages) sont utilisées
          uniquement pour le fonctionnement du service. Un utilisateur peut demander la suppression de son compte et
          de ses données à tout moment en contactant l'administrateur.
        </p>

        <h2 className="text-base font-bold">8. Modification des présentes conditions</h2>
        <p>
          DabbyMarket peut modifier ces conditions à tout moment ; les utilisateurs seront informés de toute
          modification substantielle via l'application.
        </p>

        <h2 className="text-base font-bold">9. Droit applicable</h2>
        <p>Les présentes conditions sont soumises au droit camerounais.</p>

        <h2 className="text-base font-bold">10. Contact</h2>
        <p>Pour toute question relative aux présentes conditions, contactez l'administrateur via la page Suggestions de l'application.</p>
      </div>
    </AppShell>
  );
}
