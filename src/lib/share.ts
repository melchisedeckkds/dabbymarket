import { toast } from "sonner";
import type { TranslationKey } from "./i18n";

/**
 * Ouvre le sélecteur de partage natif du téléphone (WhatsApp, Facebook,
 * Instagram, Messenger, SMS, etc.) via l'API Web Share, disponible sur la
 * quasi-totalité des navigateurs mobiles et dans l'app Android empaquetée.
 * Sur un navigateur de bureau qui ne la supporte pas, copie le lien dans
 * le presse-papiers à la place.
 */
export async function shareContent(
  data: { title: string; text: string; url: string },
  t: (key: TranslationKey) => string,
) {
  if (navigator.share) {
    try {
      await navigator.share(data);
    } catch {
      /* l'utilisateur a simplement annulé le partage — rien à faire */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(data.url);
    toast.success(t("produit_linkCopied"));
  } catch {
    toast.error(t("common_error"));
  }
}
