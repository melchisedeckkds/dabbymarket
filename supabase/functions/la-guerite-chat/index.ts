// Fonction Edge Supabase — relais sécurisé vers l'API Gemini (palier gratuit).
// La clé GEMINI_API_KEY est stockée comme secret Supabase, jamais exposée au client.
// Un quota quotidien réel par utilisateur (40 messages/jour par défaut) protège
// le quota gratuit partagé de Gemini contre les abus — appliqué ici côté
// serveur, donc impossible à contourner depuis le client.
//
// Déploiement :
//   supabase secrets set GEMINI_API_KEY=xxxxx
//   supabase functions deploy la-guerite-chat

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 40;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Connexion requise pour parler à La Guérite." }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Identifie l'utilisateur à partir de son jeton, pour appliquer le quota par personne
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Session invalide." }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Quota quotidien réel, appliqué en base — impossible à contourner côté client
    const { data: allowed, error: rpcError } = await admin.rpc("check_and_increment_ai_usage", {
      p_user_id: userData.user.id,
      p_daily_limit: DAILY_LIMIT,
    });
    if (rpcError) {
      return new Response(JSON.stringify({ error: "Erreur de vérification du quota." }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Limite de ${DAILY_LIMIT} messages/jour atteinte avec La Guérite. Réessayez demain.` }),
        { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const { systemPrompt, messages } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY non configurée côté serveur" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Garde-fou supplémentaire : limite la taille des messages envoyés à Gemini
    const safeMessages = (messages as { role: string; content: string }[])
      .slice(-20)
      .map((m) => ({ ...m, content: String(m.content).slice(0, 2000) }));

    const contents = safeMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: String(systemPrompt).slice(0, 6000) }] },
          contents,
          generationConfig: { temperature: 0.8, maxOutputTokens: 900 },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `Erreur Gemini: ${errText}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    let text = candidate?.content?.parts?.[0]?.text ?? "Je n'ai pas bien saisi votre demande, pourriez-vous reformuler ?";
    // Filet de sécurité : si la réponse a malgré tout été coupée par la
    // limite de tokens, on l'indique clairement plutôt que de laisser une
    // phrase tronquée en plein milieu.
    if (candidate?.finishReason === "MAX_TOKENS" && text) {
      text = text.replace(/[\s,;:*_-]+$/, "") + "…";
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
