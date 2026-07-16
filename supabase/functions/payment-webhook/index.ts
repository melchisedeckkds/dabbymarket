// Fonction Edge Supabase — webhook de confirmation de paiement automatique
// (Option B). INACTIVE tant que tu n'as pas de compte marchand : le flux
// manuel (validation admin) reste le fonctionnement par défaut et continue
// de marcher sans cette fonction.
//
// Ce fichier est un GABARIT générique. Chaque prestataire (CinetPay,
// Notchpay, Monetbil) a son propre format de payload et sa propre méthode
// de vérification de signature — adapte les deux sections marquées
// "À ADAPTER" ci-dessous selon le prestataire choisi. Les trois sont
// couramment utilisés au Cameroun pour Orange Money / MTN MoMo.
//
// Déploiement une fois configuré :
//   supabase secrets set PAYMENT_WEBHOOK_SECRET=xxxxx
//   supabase functions deploy payment-webhook --no-verify-jwt
//   (--no-verify-jwt est nécessaire ici : le prestataire de paiement n'a pas
//   de session utilisateur Supabase, il appelle ce endpoint directement)
//
// Puis configure l'URL de webhook dans le tableau de bord du prestataire :
//   https://TON_PROJET.supabase.co/functions/v1/payment-webhook

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  try {
    const payload = await req.json();

    // ============ À ADAPTER : vérification de signature ============
    // CinetPay : vérifier le champ "token" retourné par leur API de
    //   vérification de transaction (voir leur doc "Notification").
    // Notchpay : vérifier l'en-tête "x-notch-signature" (HMAC SHA256 avec
    //   ton secret webhook Notchpay).
    // Monetbil : vérifier le champ "sign" (MD5 des paramètres + clé secrète,
    //   voir leur doc "Notification URL").
    const expectedSecret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret") ?? payload.secret;
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Signature invalide" }), { status: 401 });
    }

    // ============ À ADAPTER : extraction des champs selon le prestataire ============
    // Adapte ces trois lignes au nom exact des champs renvoyés par ton
    // prestataire (ex. Monetbil renvoie "item_ref" et "status"; CinetPay
    // renvoie "cpm_trans_id" et "cpm_result"; Notchpay renvoie "reference"
    // et "status").
    const referenceCode: string = payload.reference_code ?? payload.item_ref ?? payload.reference;
    const providerTransactionId: string = payload.transaction_id ?? payload.cpm_trans_id ?? payload.id;
    const paymentSucceeded: boolean =
      payload.status === "success" || payload.status === "ACCEPTED" || payload.cpm_result === "00";

    if (!paymentSucceeded) {
      return new Response(JSON.stringify({ ok: true, note: "Paiement non confirmé, aucune action" }), { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: credited, error } = await admin.rpc("auto_confirm_recharge", {
      p_reference_code: referenceCode,
      p_provider_reference: providerTransactionId,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, credited }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
