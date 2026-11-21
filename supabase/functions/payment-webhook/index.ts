// Fonction Edge Supabase — webhook de confirmation de paiement automatique.
// INACTIVE tant que vous n'avez pas de compte marchand : le flux manuel
// (validation admin) reste le fonctionnement par défaut.
//
// SÉCURITÉ (0023) :
//  1. Signature HMAC-SHA256 du CORPS BRUT de la requête, comparée en temps constant.
//  2. Le MONTANT payé est transmis à la base, qui refuse tout paiement inférieur au prix du pack.
//  3. Un même identifiant de transaction ne peut créditer qu'une seule fois.
//  4. Seul le rôle service_role peut appeler `auto_confirm_recharge`.
//
// Déploiement :
//   supabase secrets set PAYMENT_WEBHOOK_SECRET=<secret long et aléatoire>
//   supabase functions deploy payment-webhook --no-verify-jwt
// URL à donner au prestataire : https://VOTRE_PROJET.supabase.co/functions/v1/payment-webhook
//
// À ADAPTER selon le prestataire (CinetPay, Notchpay, Monetbil) : le nom de l'en-tête de
// signature (SIGNATURE_HEADER) et les noms de champs dans `extractFields`. Testez avec le
// mode « sandbox » du prestataire avant d'activer.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SIGNATURE_HEADER = "x-webhook-signature"; // Notchpay : "x-notch-signature"

const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.trim().toLowerCase().replace(/^sha256=/, "");
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

// Comparaison en temps constant (ne s'arrête pas au premier octet différent).
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const provided = hexToBytes(header);
  if (!provided) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody)));
  return timingSafeEqual(expected, provided);
}

// À ADAPTER : champs renvoyés par le prestataire.
function extractFields(p: Record<string, unknown>) {
  const referenceCode = String(p.reference_code ?? p.item_ref ?? p.reference ?? "");
  const transactionId = String(p.transaction_id ?? p.cpm_trans_id ?? p.id ?? "");
  const amount = Number(p.amount ?? p.cpm_amount ?? p.paid_amount);
  const succeeded = p.status === "success" || p.status === "ACCEPTED" || p.cpm_result === "00";
  return { referenceCode, transactionId, amount, succeeded };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  try {
    const secret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");
    if (!secret || secret.length < 16) return json({ error: "Webhook non configuré" }, 503);

    const rawBody = await req.text();
    if (!(await verifySignature(rawBody, req.headers.get(SIGNATURE_HEADER), secret))) {
      return json({ error: "Signature invalide" }, 401);
    }

    const { referenceCode, transactionId, amount, succeeded } = extractFields(JSON.parse(rawBody));
    if (!succeeded) return json({ ok: true, note: "Paiement non confirmé, aucune action" });
    if (!referenceCode || !transactionId || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Champs manquants ou invalides" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: credited, error } = await admin.rpc("auto_confirm_recharge", {
      p_reference_code: referenceCode,
      p_provider_reference: transactionId,
      p_paid_fcfa: Math.round(amount),
    });
    if (error) return json({ error: "Erreur interne" }, 500);
    return json({ ok: true, credited });
  } catch {
    return json({ error: "Requête invalide" }, 400);
  }
});
